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

export class ExampleService {
  constructor(private client: BrunoApiClient) {}

  async create(itemUid: string, data: CloudExampleRequest): Promise<CloudExample> {
    const res = await this.client.getClient().post<{ data: CloudExample }>(`/api/items/${itemUid}/examples`, data);
    return res.data.data;
  }

  async get(exampleUid: string): Promise<CloudExample> {
    const res = await this.client.getClient().get<{ data: CloudExample }>(`/api/examples/${exampleUid}`);
    return res.data.data;
  }

  async list(itemUid: string): Promise<CloudExample[]> {
    const res = await this.client.getClient().get<{ data: CloudExample[] }>(`/api/items/${itemUid}/examples`);
    return res.data.data;
  }

  async listForCollection(collectionUid: string): Promise<CloudExample[]> {
    const res = await this.client.getClient().get<{ data: CloudExample[] }>(`/api/collections/${collectionUid}/examples`);
    return res.data.data;
  }

  async update(exampleUid: string, data: CloudExampleUpdate): Promise<CloudExample> {
    const res = await this.client.getClient().patch<{ data: CloudExample }>(`/api/examples/${exampleUid}`, data);
    return res.data.data;
  }

  async delete(exampleUid: string): Promise<void> {
    await this.client.getClient().delete(`/api/examples/${exampleUid}`);
  }
}
