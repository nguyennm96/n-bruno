import { BrunoApiClient } from '../client';
import type { GenerateDocsRequest, GenerateDocsResponse } from '../types';

export class AiService {
  constructor(private client: BrunoApiClient) {}

  /**
   * Generate Markdown documentation for a request using the server-side LLM.
   * The server must be configured with OPENAI_API_KEY or ANTHROPIC_API_KEY.
   */
  async generateDocs(request: GenerateDocsRequest): Promise<GenerateDocsResponse> {
    const response = await this.client.getClient().post<GenerateDocsResponse>('/api/ai/generate-docs', request);
    return response.data;
  }
}
