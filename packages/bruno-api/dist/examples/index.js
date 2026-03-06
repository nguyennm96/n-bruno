"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleService = void 0;
class ExampleService {
    constructor(client) {
        this.client = client;
    }
    async create(itemUid, data) {
        const res = await this.client.getClient().post(`/api/items/${itemUid}/examples`, data);
        return res.data.data;
    }
    async list(itemUid) {
        const res = await this.client.getClient().get(`/api/items/${itemUid}/examples`);
        return res.data.data;
    }
    async listForCollection(collectionUid) {
        const res = await this.client.getClient().get(`/api/collections/${collectionUid}/examples`);
        return res.data.data;
    }
    async update(exampleUid, data) {
        const res = await this.client.getClient().patch(`/api/examples/${exampleUid}`, data);
        return res.data.data;
    }
    async delete(exampleUid) {
        await this.client.getClient().delete(`/api/examples/${exampleUid}`);
    }
}
exports.ExampleService = ExampleService;
