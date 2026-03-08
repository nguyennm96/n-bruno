use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::sync::broadcast;

use crate::state::AppState;

/// Maximum connections per workspace
#[allow(dead_code)]
const MAX_CONNECTIONS_PER_WORKSPACE: usize = 100;

/// Channel capacity
const CHANNEL_CAPACITY: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsEvent {
    CollectionChanged { action: String, collection_uid: String, data: Value },
    ItemChanged { action: String, item_uid: String, data: Value },
    EnvironmentChanged { action: String, environment_uid: String, data: Value },
    ExampleChanged { action: String, example_uid: String, data: Value },
}

#[derive(Debug, Clone)]
struct WorkspaceChannel {
    sender: broadcast::Sender<(String, WsEvent)>, // (sender_user_id, event)
}

/// Manages in-memory WebSocket connections per workspace.
#[derive(Clone)]
pub struct WsManager {
    channels: Arc<Mutex<HashMap<String, WorkspaceChannel>>>,
}

impl WsManager {
    pub fn new() -> Self {
        Self {
            channels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get or create a broadcast channel for a workspace
    fn get_or_create_channel(&self, workspace_id: &str) -> broadcast::Sender<(String, WsEvent)> {
        let mut channels = self.channels.lock().unwrap();
        channels
            .entry(workspace_id.to_string())
            .or_insert_with(|| WorkspaceChannel {
                sender: broadcast::channel(CHANNEL_CAPACITY).0,
            })
            .sender
            .clone()
    }

    /// Broadcast an event to all subscribers in a workspace (excluding sender)
    pub fn broadcast(&self, workspace_id: &str, sender_user_id: &str, event: WsEvent) {
        let sender = self.get_or_create_channel(workspace_id);
        let _ = sender.send((sender_user_id.to_string(), event));
    }

    pub fn subscribe(&self, workspace_id: &str) -> broadcast::Receiver<(String, WsEvent)> {
        self.get_or_create_channel(workspace_id).subscribe()
    }
}

impl Default for WsManager {
    fn default() -> Self {
        Self::new()
    }
}

// ── Inbound WS messages ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    Subscribe { workspace_id: String },
    Unsubscribe { workspace_id: String },
    Ping,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    Pong,
    Error { message: String },
    Event { workspace_id: String, event: WsEvent },
}

// ── WebSocket upgrade handler ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(state): State<AppState>,
) -> Response {
    // Validate JWT before upgrading
    match state.auth_service.verify_access_token(&params.token) {
        Ok(claims) => ws.on_upgrade(move |socket| handle_socket(socket, claims.sub, state)),
        Err(e) => {
            tracing::warn!("WS connection rejected: {}", e);
            // Upgrade anyway but immediately close – or return HTTP 401
            ws.on_upgrade(|mut socket| async move {
                let _ = socket.send(Message::Text(
                    serde_json::to_string(&ServerMessage::Error { message: "Unauthorized".into() }).unwrap().into(),
                )).await;
                let _ = socket.close().await;
            })
        }
    }
}

async fn handle_socket(socket: WebSocket, user_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Track active subscriptions for this connection
    let subscriptions: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let subs_clone = subscriptions.clone();
    let _state_clone = state.clone();
    let _user_id_clone = user_id.clone();

    // Spawn task to forward sender (we need ownership)
    // Use mpsc to forward messages to the WS sender
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(64);

    // Forward task
    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Process incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(ClientMessage::Subscribe { workspace_id }) => {
                        // Verify user has access to workspace
                        let user_oid = match bson::oid::ObjectId::parse_str(&user_id) {
                            Ok(oid) => oid,
                            Err(_) => break,
                        };

                        if state.workspace_service.get_with_role(&workspace_id, user_oid).await.is_err() {
                            let _ = tx.send(serde_json::to_string(&ServerMessage::Error {
                                message: format!("No access to workspace {}", workspace_id),
                            }).unwrap()).await;
                            continue;
                        }

                        // Subscribe to broadcasts for this workspace
                        let mut rx = state.ws_manager.subscribe(&workspace_id);
                        let ws_id = workspace_id.clone();
                        let uid = user_id.clone();
                        let tx2 = tx.clone();

                        let handle = tokio::spawn(async move {
                            while let Ok((sender_id, event)) = rx.recv().await {
                                // Don't echo back to sender
                                if sender_id == uid { continue; }
                                let msg = ServerMessage::Event {
                                    workspace_id: ws_id.clone(),
                                    event,
                                };
                                if tx2.send(serde_json::to_string(&msg).unwrap()).await.is_err() {
                                    break;
                                }
                            }
                        });

                        subs_clone.lock().unwrap().insert(workspace_id, handle);
                    }
                    Ok(ClientMessage::Unsubscribe { workspace_id }) => {
                        if let Some(handle) = subs_clone.lock().unwrap().remove(&workspace_id) {
                            handle.abort();
                        }
                    }
                    Ok(ClientMessage::Ping) => {
                        let _ = tx.send(serde_json::to_string(&ServerMessage::Pong).unwrap()).await;
                    }
                    Err(e) => {
                        tracing::debug!("WS parse error: {}", e);
                    }
                }
            }
            Message::Close(_) => break,
            Message::Ping(_data) => {
                // Handled by axum automatically
            }
            _ => {}
        }
    }

    // Cleanup all subscriptions
    let mut subs = subscriptions.lock().unwrap();
    for (_, handle) in subs.drain() {
        handle.abort();
    }
    forward_task.abort();
    tracing::debug!("WS connection closed for user {}", user_id);
}
