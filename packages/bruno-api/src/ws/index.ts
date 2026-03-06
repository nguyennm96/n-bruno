/**
 * WebSocket service for real-time cloud sync events.
 * Manages connection, auto-reconnect, subscribe/unsubscribe, and event dispatch.
 */

type WsEventType = 'ItemChanged' | 'CollectionChanged' | 'EnvironmentChanged' | 'ExampleChanged';

export interface WsEventPayload {
  type: WsEventType;
  payload: {
    action: 'created' | 'updated' | 'deleted';
    item_uid?: string;
    collection_uid?: string;
    environment_uid?: string;
    example_uid?: string;
    data: any;
  };
  workspace_id: string;
}

type EventCallback = (event: WsEventPayload) => void;

export class WsService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private subscribedWorkspaces = new Set<string>();
  private listeners = new Map<string, Set<EventCallback>>(); // eventType → callbacks
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = 1000; // ms, doubles on each failure up to 30s
  private readonly MAX_RECONNECT_DELAY = 30000;
  private intentionalClose = false;

  connect(serverUrl: string, token: string): void {
    this.url = serverUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
    this.token = token;
    this.intentionalClose = false;
    this._connect();
  }

  private _connect(): void {
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
      this._emit('__connected__', { type: '__connected__', payload: { action: 'created', data: {} }, workspace_id: '' } as any);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'Pong') return;
        if (msg.type === 'Event') {
          this._emit(msg.event.type, msg as WsEventPayload);
          this._emit('*', msg as WsEventPayload); // wildcard listener
        }
      } catch (e) {
        console.warn('[WsService] parse error', e);
      }
    };

    this.ws.onclose = () => {
      this._stopPing();
      if (!this.intentionalClose) {
        console.log(`☁️  [WsService] Disconnected. Reconnecting in ${this.reconnectDelay}ms...`);
        this._emit('__disconnected__', { type: '__disconnected__', payload: { action: 'created', data: {} }, workspace_id: '' } as any);
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

  subscribe(workspaceUid: string): void {
    this.subscribedWorkspaces.add(workspaceUid);
    if (this.isConnected) {
      this._send({ type: 'Subscribe', workspace_id: workspaceUid });
    }
  }

  unsubscribe(workspaceUid: string): void {
    this.subscribedWorkspaces.delete(workspaceUid);
    if (this.isConnected) {
      this._send({ type: 'Unsubscribe', workspace_id: workspaceUid });
    }
  }

  on(event: WsEventType | '__connected__' | '__disconnected__' | '*', cb: EventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: EventCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.subscribedWorkspaces.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _send(msg: object): void {
    if (this.isConnected) {
      this.ws!.send(JSON.stringify(msg));
    }
  }

  private _emit(event: string, payload: WsEventPayload): void {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  private _startPing(): void {
    this.pingTimer = setInterval(() => {
      this._send({ type: 'Ping' });
    }, 30000);
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
