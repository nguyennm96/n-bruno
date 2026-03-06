"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
class SyncService {
    constructor(client) {
        this.client = client;
    }
    async getChanges(workspaceUid, since) {
        const params = since ? `?since=${encodeURIComponent(since)}` : '';
        const response = await this.client.getClient().get(`/api/workspaces/${workspaceUid}/changes${params}`);
        return response.data.data;
    }
}
exports.SyncService = SyncService;
