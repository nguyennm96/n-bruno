"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
class UserService {
    constructor(client) {
        this.client = client;
    }
    async searchByEmail(email) {
        const response = await this.client.getClient().get('/api/users/search', { params: { email } });
        return response.data.data;
    }
}
exports.UserService = UserService;
