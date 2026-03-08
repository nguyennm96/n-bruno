import { BrunoApiClient } from '../client';
import type { GenerateDocsRequest, GenerateDocsResponse } from '../types';
export declare class AiService {
    private client;
    constructor(client: BrunoApiClient);
    /**
     * Generate Markdown documentation for a request using the server-side LLM.
     * The server must be configured with OPENAI_API_KEY or ANTHROPIC_API_KEY.
     */
    generateDocs(request: GenerateDocsRequest): Promise<GenerateDocsResponse>;
}
