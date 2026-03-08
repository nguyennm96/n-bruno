use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::Config;
use crate::errors::{AppError, AppResult};

// ── Context sent from the client ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocKeyValue {
    pub name: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocBody {
    pub mode: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocExampleResponse {
    pub status: Option<u16>,
    pub status_text: Option<String>,
    pub headers: Option<Vec<DocKeyValue>>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocExample {
    pub name: String,
    pub description: Option<String>,
    pub request: Option<DocExampleRequest>,
    pub response: Option<DocExampleResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocExampleRequest {
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<DocKeyValue>>,
    pub body: Option<DocBody>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocGenerationContext {
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Option<Vec<DocKeyValue>>,
    pub params: Option<Vec<DocKeyValue>>,
    pub body: Option<DocBody>,
    pub auth_type: Option<String>,
    pub examples: Option<Vec<DocExample>>,
}

// ── Service ──────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AiService {
    openai_api_key: Option<String>,
    anthropic_api_key: Option<String>,
    ai_provider: String,
    http: reqwest::Client,
}

impl AiService {
    pub fn new(config: &Config) -> Self {
        Self {
            openai_api_key: config.openai_api_key.clone(),
            anthropic_api_key: config.anthropic_api_key.clone(),
            ai_provider: config.ai_provider.clone(),
            http: reqwest::Client::new(),
        }
    }

    pub fn is_configured(&self) -> bool {
        match self.ai_provider.as_str() {
            "anthropic" => self.anthropic_api_key.is_some(),
            _ => self.openai_api_key.is_some() || self.anthropic_api_key.is_some(),
        }
    }

    /// Generate Markdown documentation for a request from the given context.
    pub async fn generate_docs(&self, ctx: DocGenerationContext) -> AppResult<String> {
        if !self.is_configured() {
            return Err(AppError::ServiceUnavailable(
                "AI documentation generation is not configured on this server".to_string(),
            ));
        }

        let prompt = build_prompt(&ctx);

        match self.ai_provider.as_str() {
            "anthropic" => self.call_anthropic(&prompt).await,
            _ => {
                // Default to OpenAI; fall back to Anthropic if OpenAI key missing
                if self.openai_api_key.is_some() {
                    self.call_openai(&prompt).await
                } else {
                    self.call_anthropic(&prompt).await
                }
            }
        }
    }

    async fn call_openai(&self, prompt: &str) -> AppResult<String> {
        let api_key = self.openai_api_key.as_ref().ok_or_else(|| {
            AppError::ServiceUnavailable("OpenAI API key not configured".to_string())
        })?;

        let body = json!({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a technical writer specializing in API documentation. Generate clear, concise Markdown documentation for API endpoints. Focus on what the endpoint does, its parameters, request/response examples, and any important notes. Use proper Markdown formatting with headings, tables, and code blocks."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 2048,
            "temperature": 0.3
        });

        let resp = self
            .http
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("OpenAI request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "OpenAI API error {status}: {text}"
            )));
        }

        let json: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("OpenAI response parse error: {e}")))?;

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Unexpected OpenAI response shape".to_string()))?
            .to_string();

        Ok(content)
    }

    async fn call_anthropic(&self, prompt: &str) -> AppResult<String> {
        let api_key = self.anthropic_api_key.as_ref().ok_or_else(|| {
            AppError::ServiceUnavailable("Anthropic API key not configured".to_string())
        })?;

        let body = json!({
            "model": "claude-opus-4-5",
            "max_tokens": 2048,
            "system": "You are a technical writer specializing in API documentation. Generate clear, concise Markdown documentation for API endpoints. Focus on what the endpoint does, its parameters, request/response examples, and any important notes. Use proper Markdown formatting with headings, tables, and code blocks.",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        });

        let resp = self
            .http
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Anthropic request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "Anthropic API error {status}: {text}"
            )));
        }

        let json: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Anthropic response parse error: {e}")))?;

        let content = json["content"][0]["text"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Unexpected Anthropic response shape".to_string()))?
            .to_string();

        Ok(content)
    }
}

// ── Prompt builder ───────────────────────────────────────────────────────────

fn build_prompt(ctx: &DocGenerationContext) -> String {
    let mut parts: Vec<String> = vec![];

    parts.push(format!(
        "Generate Markdown API documentation for the following API endpoint:\n\n**Name**: {}\n**Method**: {}\n**URL**: {}",
        ctx.name, ctx.method, ctx.url
    ));

    if let Some(headers) = &ctx.headers {
        let enabled: Vec<_> = headers.iter().filter(|h| h.enabled).collect();
        if !enabled.is_empty() {
            let rows: Vec<String> = enabled
                .iter()
                .map(|h| format!("- `{}`: `{}`", h.name, h.value))
                .collect();
            parts.push(format!("**Headers**:\n{}", rows.join("\n")));
        }
    }

    if let Some(params) = &ctx.params {
        let enabled: Vec<_> = params.iter().filter(|p| p.enabled).collect();
        if !enabled.is_empty() {
            let rows: Vec<String> = enabled
                .iter()
                .map(|p| format!("- `{}`: `{}`", p.name, p.value))
                .collect();
            parts.push(format!("**Query Parameters**:\n{}", rows.join("\n")));
        }
    }

    if let Some(body) = &ctx.body {
        if body.mode != "none" {
            let content_str = body.content.as_deref().unwrap_or("");
            parts.push(format!(
                "**Request Body** (mode: `{}`):\n```\n{}\n```",
                body.mode, content_str
            ));
        }
    }

    if let Some(auth) = &ctx.auth_type {
        if auth != "none" && !auth.is_empty() {
            parts.push(format!("**Authentication**: `{}`", auth));
        }
    }

    if let Some(examples) = &ctx.examples {
        if !examples.is_empty() {
            parts.push("**Response Examples**:".to_string());
            for ex in examples {
                let mut ex_parts = vec![format!("### Example: {}", ex.name)];
                if let Some(desc) = &ex.description {
                    if !desc.is_empty() {
                        ex_parts.push(desc.clone());
                    }
                }
                if let Some(resp) = &ex.response {
                    let status = resp.status.map(|s| s.to_string()).unwrap_or_default();
                    let status_text = resp.status_text.as_deref().unwrap_or("");
                    ex_parts.push(format!("**Status**: `{} {}`", status, status_text));
                    if let Some(body) = &resp.body {
                        ex_parts.push(format!("**Response Body**:\n```json\n{}\n```", body));
                    }
                }
                parts.push(ex_parts.join("\n"));
            }
        }
    }

    parts.push("\nPlease write clear, professional Markdown documentation for this endpoint. Include a brief description, parameter descriptions, request/response details, and any relevant notes. Output ONLY the Markdown content — no preamble, no explanation.".to_string());

    parts.join("\n\n")
}
