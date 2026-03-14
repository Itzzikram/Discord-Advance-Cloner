use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::time::{sleep, Duration};
use tokio_retry::{
    strategy::{jitter, ExponentialBackoff},
    Retry,
};
use twilight_http::Client as HttpClient;
use twilight_model::{
    channel::{Channel, ChannelType, Message},
    guild::{Permissions, Role},
    id::{
        marker::{ChannelMarker, GuildMarker, RoleMarker, UserMarker},
        Id,
    },
};

#[derive(Debug, Clone)]
pub struct CloneClient {
    http: HttpClient,
    token: String,
    retry_strategy: ExponentialBackoff,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub color: Option<u32>,
    pub hoist: Option<bool>,
    pub mentionable: Option<bool>,
    pub permissions: Option<u64>,
    pub position: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub channel_type: u8,
    pub topic: Option<String>,
    pub bitrate: Option<u32>,
    pub user_limit: Option<u16>,
    pub rate_limit_per_user: Option<u16>,
    pub position: Option<i64>,
    pub parent_id: Option<String>,
    pub nsfw: Option<bool>,
}

impl CloneClient {
    pub fn new(token: String) -> Self {
        let http = HttpClient::new(token.clone());
        let retry_strategy = ExponentialBackoff::from_millis(100)
            .max_delay(Duration::from_secs(5))
            .take(3);

        Self {
            http,
            token,
            retry_strategy,
        }
    }

    async fn execute_with_retry<F, T>(&self, f: F) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T>> + Send>> + Send + Sync,
    {
        Retry::spawn(self.retry_strategy.clone(), move || {
            let fut = f();
            async move {
                fut.await.map_err(|e| {
                    tracing::warn!("Request failed, retrying: {}", e);
                    e
                })
            }
        })
        .await
        .context("Request failed after retries")
    }

    pub async fn get_guild(&self, guild_id: Id<GuildMarker>) -> Result<twilight_model::guild::Guild> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let response = self.http.guild(guild_id).await?;
                response.model().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn get_roles(&self, guild_id: Id<GuildMarker>) -> Result<Vec<Role>> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let response = self.http.roles(guild_id).await?;
                response.models().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn create_role(
        &self,
        guild_id: Id<GuildMarker>,
        request: CreateRoleRequest,
    ) -> Result<Role> {
        self.execute_with_retry(|| {
            let req = request.clone();
            Box::pin(async move {
                let mut builder = self.http.create_role(guild_id).name(&req.name);

                if let Some(color) = req.color {
                    builder = builder.color(color);
                }
                if let Some(hoist) = req.hoist {
                    builder = builder.hoist(hoist);
                }
                if let Some(mentionable) = req.mentionable {
                    builder = builder.mentionable(mentionable);
                }
                if let Some(permissions) = req.permissions {
                    builder = builder.permissions(Permissions::from_bits_truncate(permissions));
                }
                if let Some(position) = req.position {
                    builder = builder.position(position);
                }

                let response = builder.await?;
                response.model().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn get_channels(&self, guild_id: Id<GuildMarker>) -> Result<Vec<Channel>> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let response = self.http.guild_channels(guild_id).await?;
                response.models().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn create_channel(
        &self,
        guild_id: Id<GuildMarker>,
        request: CreateChannelRequest,
    ) -> Result<Channel> {
        self.execute_with_retry(|| {
            let req = request.clone();
            Box::pin(async move {
                let channel_type = ChannelType::from(req.channel_type);
                let mut builder = self.http.create_guild_channel(guild_id, &req.name)?;

                builder = builder.kind(channel_type);

                if let Some(topic) = req.topic {
                    builder = builder.topic(&topic);
                }
                if let Some(bitrate) = req.bitrate {
                    builder = builder.bitrate(bitrate);
                }
                if let Some(user_limit) = req.user_limit {
                    builder = builder.user_limit(user_limit);
                }
                if let Some(rate_limit) = req.rate_limit_per_user {
                    builder = builder.rate_limit_per_user(rate_limit);
                }
                if let Some(position) = req.position {
                    builder = builder.position(position);
                }
                if let Some(parent_id) = req.parent_id {
                    if let Ok(id) = parent_id.parse::<u64>() {
                        builder = builder.parent_id(Id::new(id));
                    }
                }
                if let Some(nsfw) = req.nsfw {
                    builder = builder.nsfw(nsfw);
                }

                let response = builder.await?;
                response.model().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn get_messages(
        &self,
        channel_id: Id<ChannelMarker>,
        limit: Option<u16>,
    ) -> Result<Vec<Message>> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let mut builder = self.http.messages(channel_id);
                if let Some(limit) = limit {
                    builder = builder.limit(limit)?;
                }
                let response = builder.await?;
                response.models().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn get_webhooks(&self, channel_id: Id<ChannelMarker>) -> Result<Vec<twilight_model::channel::Webhook>> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let response = self.http.channel_webhooks(channel_id).await?;
                response.models().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn create_webhook(
        &self,
        channel_id: Id<ChannelMarker>,
        name: &str,
        avatar: Option<&str>,
    ) -> Result<twilight_model::channel::Webhook> {
        self.execute_with_retry(|| {
            let name = name.to_string();
            let avatar = avatar.map(|s| s.to_string());
            Box::pin(async move {
                let mut builder = self.http.create_webhook(channel_id, &name)?;
                if let Some(avatar) = avatar {
                    builder = builder.avatar(Some(&avatar))?;
                }
                let response = builder.await?;
                response.model().await.map_err(Into::into)
            })
        })
        .await
    }

    pub async fn get_threads(&self, channel_id: Id<ChannelMarker>) -> Result<Vec<Channel>> {
        self.execute_with_retry(|| {
            Box::pin(async move {
                let response = self.http.threads_archived_public(channel_id, None).await?;
                response.model().await.map(|r| r.threads).map_err(Into::into)
            })
        })
        .await
    }

    pub fn get_token(&self) -> &str {
        &self.token
    }
}

