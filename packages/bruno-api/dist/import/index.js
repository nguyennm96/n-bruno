"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
class ImportService {
    constructor(client) {
        this.client = client;
    }
    async importPostman(workspaceUid, json, conflict = 'error') {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceUid}/import/postman`, { json, conflict });
        const d = response.data?.data;
        return {
            collectionUid: d.collectionUid,
            collectionName: d.collection_name,
            imported: d.imported,
            warnings: d.warnings || []
        };
    }
    async importInsomnia(workspaceUid, json) {
        const response = await this.client.getClient().post(`/api/workspaces/${workspaceUid}/import/insomnia`, { json });
        const d = response.data?.data;
        return {
            collectionUid: d.collectionUid,
            collectionName: d.collection_name,
            imported: d.imported,
            warnings: d.warnings || []
        };
    }
}
exports.ImportService = ImportService;
