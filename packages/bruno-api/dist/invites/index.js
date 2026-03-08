"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteService = void 0;
class InviteService {
    constructor(client) {
        this.client = client;
    }
    async validateToken(token) {
        const response = await this.client.getClient().get('/api/invites/validate', { params: { token } });
        return response.data.data;
    }
    async acceptInvite(token) {
        const response = await this.client.getClient().post('/api/invites/accept', { token });
        return { workspaceUid: response.data.data.workspace_uid };
    }
}
exports.InviteService = InviteService;
