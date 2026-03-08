use serde_json::json;

use crate::config::Config;
use crate::errors::{AppError, AppResult};

#[derive(Clone)]
pub struct MailerService {
    api_key: Option<String>,
    from_email: String,
    from_name: String,
    http: reqwest::Client,
}

impl MailerService {
    pub fn new(config: &Config) -> Self {
        Self {
            api_key: config.sendgrid_api_key.clone(),
            from_email: config.sendgrid_from_email.clone(),
            from_name: config.sendgrid_from_name.clone(),
            http: reqwest::Client::new(),
        }
    }

    pub fn is_configured(&self) -> bool {
        self.api_key.is_some()
    }

    /// Build a no-op mailer for tests (no API key, no HTTP calls).
    #[cfg(test)]
    pub fn for_test() -> Self {
        Self {
            api_key: None,
            from_email: "test@example.com".into(),
            from_name: "Test".into(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn send_email(&self, to_email: &str, subject: &str, html_body: &str) -> AppResult<()> {
        let api_key = match &self.api_key {
            Some(k) => k.clone(),
            None => {
                tracing::error!(
                    "Email delivery failed: SENDGRID_API_KEY is not configured. \
                     Set the SENDGRID_API_KEY environment variable to enable email sending."
                );
                return Err(AppError::Internal(
                    "Email service is not configured. Please contact your administrator.".to_string()
                ));
            }
        };

        let payload = json!({
            "personalizations": [{ "to": [{ "email": to_email }] }],
            "from": { "email": self.from_email, "name": self.from_name },
            "subject": subject,
            "content": [{ "type": "text/html", "value": html_body }]
        });

        let resp = self.http
            .post("https://api.sendgrid.com/v3/mail/send")
            .bearer_auth(&api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Email send failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::error!("SendGrid error {status}: {body}");
            return Err(AppError::Internal(format!("Email delivery failed ({status})")));
        }

        tracing::info!("Email sent to {to_email}: {subject}");
        Ok(())
    }
}
