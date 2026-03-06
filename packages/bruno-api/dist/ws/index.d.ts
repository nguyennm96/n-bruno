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
export declare class WsService {
    private ws;
    private url;
    private token;
    private subscribedWorkspaces;
    private listeners;
    private reconnectTimer;
    private pingTimer;
    private reconnectDelay;
    private readonly MAX_RECONNECT_DELAY;
    private intentionalClose;
    connect(serverUrl: string, token: string): void;
    private _connect;
    subscribe(workspaceUid: string): void;
    unsubscribe(workspaceUid: string): void;
    on(event: WsEventType | '__connected__' | '__disconnected__' | '*', cb: EventCallback): void;
    off(event: string, cb: EventCallback): void;
    disconnect(): void;
    get isConnected(): boolean;
    private _send;
    private _emit;
    private _startPing;
    private _stopPing;
}
export {};
