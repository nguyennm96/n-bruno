/// Custom serde helpers for DateTime<Utc> that are backward-compatible with
/// both BSON DateTime objects (new format) and RFC 3339 strings (old format).
///
/// - **Serialize**: always writes a proper BSON DateTime
/// - **Deserialize**: accepts either a BSON DateTime or an RFC 3339 string

pub mod flexible_bson_datetime {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(dt: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        bson::serde_helpers::chrono_datetime_as_bson_datetime::serialize(dt, serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::Error;
        let bson = bson::Bson::deserialize(deserializer)?;
        match bson {
            bson::Bson::DateTime(dt) => Ok(dt.to_chrono()),
            bson::Bson::String(s) => DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| D::Error::custom(format!("invalid datetime string: {e}"))),
            other => Err(D::Error::custom(format!(
                "expecting DateTime or RFC3339 string, got: {other:?}"
            ))),
        }
    }
}

pub mod flexible_bson_datetime_optional {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(dt: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        bson::serde_helpers::chrono_datetime_as_bson_datetime_optional::serialize(dt, serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::Error;
        let bson = Option::<bson::Bson>::deserialize(deserializer)?;
        match bson {
            None => Ok(None),
            Some(bson::Bson::Null) => Ok(None),
            Some(bson::Bson::DateTime(dt)) => Ok(Some(dt.to_chrono())),
            Some(bson::Bson::String(s)) => DateTime::parse_from_rfc3339(&s)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(|e| D::Error::custom(format!("invalid datetime string: {e}"))),
            Some(other) => Err(D::Error::custom(format!(
                "expecting DateTime, RFC3339 string, or null, got: {other:?}"
            ))),
        }
    }
}
