"use strict";
/**
 * WebSocket service for real-time cloud sync events.
 * Manages connection, auto-reconnect, subscribe/unsubscribe, and event dispatch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsService = void 0;
class WsService {
    constructor() {
        this.ws = null;
        this.url = '';
        this.token = '';
        this.subscribedWorkspaces = new Set();
        this.listeners = new Map(); // eventType → callbacks
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.reconnectDelay = 1000; // ms, doubles on each failure up to 30s
        this.MAX_RECONNECT_DELAY = 30000;
        this.intentionalClose = false;
    }
    connect(serverUrl, token) {
        this.url = serverUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
        this.token = token;
        this.intentionalClose = false;
        this._connect();
    }
    _connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
            console.log('☁️  [WsService] Connected');
            this.reconnectDelay = 1000; // Reset backoff
            this._startPing();
            // Re-subscribe to all workspaces
            this.subscribedWorkspaces.forEach((wsId) => this._send({ type: 'Subscribe', workspace_id: wsId }));
            this._emit('__connected__', { type: '__connected__', payload: { action: 'created', data: {} }, workspace_id: '' });
        };
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'Pong')
                    return;
                if (msg.type === 'Event') {
                    this._emit(msg.event.type, msg);
                    this._emit('*', msg); // wildcard listener
                }
            }
            catch (e) {
                console.warn('[WsService] parse error', e);
            }
        };
        this.ws.onclose = () => {
            this._stopPing();
            if (!this.intentionalClose) {
                console.log(`☁️  [WsService] Disconnected. Reconnecting in ${this.reconnectDelay}ms...`);
                this._emit('__disconnected__', { type: '__disconnected__', payload: { action: 'created', data: {} }, workspace_id: '' });
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
                    this._connect();
                }, this.reconnectDelay);
            }
        };
        this.ws.onerror = (err) => {
            console.warn('[WsService] Error', err);
        };
    }
    subscribe(workspaceUid) {
        this.subscribedWorkspaces.add(workspaceUid);
        if (this.isConnected) {
            this._send({ type: 'Subscribe', workspace_id: workspaceUid });
        }
    }
    unsubscribe(workspaceUid) {
        this.subscribedWorkspaces.delete(workspaceUid);
        if (this.isConnected) {
            this._send({ type: 'Unsubscribe', workspace_id: workspaceUid });
        }
    }
    on(event, cb) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(cb);
    }
    off(event, cb) {
        this.listeners.get(event)?.delete(cb);
    }
    disconnect() {
        this.intentionalClose = true;
        this._stopPing();
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
        this.subscribedWorkspaces.clear();
    }
    get isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    _send(msg) {
        if (this.isConnected) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    _emit(event, payload) {
        this.listeners.get(event)?.forEach((cb) => cb(payload));
    }
    _startPing() {
        this.pingTimer = setInterval(() => {
            this._send({ type: 'Ping' });
        }, 30000);
    }
    _stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
}
exports.WsService = WsService;
