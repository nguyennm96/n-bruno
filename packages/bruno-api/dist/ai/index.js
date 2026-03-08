"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
class AiService {
    constructor(client) {
        this.client = client;
    }
    /**
     * Generate Markdown documentation for a request using the server-side LLM.
     * The server must be configured with OPENAI_API_KEY or ANTHROPIC_API_KEY.
     */
    async generateDocs(request) {
        const response = await this.client.getClient().post('/api/ai/generate-docs', request);
        return response.data;
    }
}
exports.AiService = AiService;
