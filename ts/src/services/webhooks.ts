import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { callRustClient, isRustClientAvailable } from '../utils/client';
import { Client } from 'discord.js-selfbot-v13';

const webhookCache = new Map<string, string>();

export async function cloneWebhooks(
  client: Client,
  sourceGuildId: string,
  channelMap: Map<string, string>
): Promise<void> {
  logger.info('Starting webhook cloning...');

  try {
    const sourceGuild = await client.guilds.fetch(sourceGuildId);
    const sourceChannels = await retry(() => sourceGuild.channels.fetch());

    let clonedCount = 0;

    for (const [sourceChannelId, targetChannelId] of channelMap.entries()) {
      const sourceChannel = sourceChannels.get(sourceChannelId);
      if (!sourceChannel || !('fetchWebhooks' in sourceChannel)) {
        continue;
      }

      try {
        const webhooks = await retry(() => sourceChannel.fetchWebhooks());

        for (const webhook of webhooks.values()) {
          try {
            logger.info(`Cloning webhook: ${webhook.name} (${sourceChannel.name})`);

            const targetChannel = await client.channels.fetch(targetChannelId);
            if (!targetChannel || !('createWebhook' in targetChannel)) {
              continue;
            }

            const createdWebhook = await retry(async () => {
              // Try Rust client if available, otherwise use TypeScript fallback
              if (isRustClientAvailable()) {
                try {
                  const result = await callRustClient('create_webhook', {
                    channel_id: targetChannelId,
                    name: webhook.name,
                    avatar: webhook.avatar || undefined,
                  });
                  return result;
                } catch (error) {
                  logger.debug(`Rust client failed, falling back to TS: ${error}`);
                }
              }
              // TypeScript fallback
              return await targetChannel.createWebhook(webhook.name, {
                avatar: webhook.avatar || undefined,
              });
            });

            const webhookId = createdWebhook.id || createdWebhook.webhook?.id || '';
            webhookCache.set(webhook.id, webhookId);
            clonedCount++;

            logger.info(`✓ Cloned webhook: ${webhook.name} (${webhookId})`);
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            logger.error(`Failed to clone webhook ${webhook.name}: ${error}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch webhooks for channel ${sourceChannel.name}: ${error}`);
      }
    }

    logger.info(`Webhook cloning complete. Cloned ${clonedCount} webhooks`);
  } catch (error) {
    logger.error(`Error during webhook cloning: ${error}`);
    throw error;
  }
}

export function getWebhookCache(): Map<string, string> {
  return webhookCache;
}

