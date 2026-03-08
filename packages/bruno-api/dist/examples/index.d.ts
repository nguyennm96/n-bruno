import type { BrunoApiClient } from '../client';
export interface CloudExampleRequest {
    uid?: string;
    name: string;
    description?: string;
    status_code: number;
    status_text?: string;
    headers?: Record<string, string>;
    body?: string;
    request_snapshot?: Record<string, unknown>;
    response_time?: number;
    response_size?: number;
}
export interface CloudExampleUpdate {
    name?: string;
    description?: string;
    status_code?: number;
    status_text?: string;
    headers?: Record<string, string>;
    body?: string;
    request_snapshot?: Record<string, unknown>;
    response_time?: number;
    response_size?: number;
}
export interface CloudExample {
    uid: string;
    name: string;
    description?: string;
    requestUid: string;
    status_code: number;
    status_text?: string;
    headers: Record<string, string>;
    /** Populated only by the full get() endpoint; absent in list responses. */
    body?: string;
    /** Populated only by the full get() endpoint; absent in list responses. */
    requestSnapshot?: Record<string, unknown>;
    responseTime?: number;
    responseSize?: number;
    created_at: string;
    updated_at: string;
}
export declare class ExampleService {
    private client;
    constructor(client: BrunoApiClient);
    create(itemUid: string, data: CloudExampleRequest): Promise<CloudExample>;
    get(exampleUid: string): Promise<CloudExample>;
    list(itemUid: string): Promise<CloudExample[]>;
    listForCollection(collectionUid: string): Promise<CloudExample[]>;
    update(exampleUid: string, data: CloudExampleUpdate): Promise<CloudExample>;
    delete(exampleUid: string): Promise<void>;
}
