import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { Client } from 'discord.js-selfbot-v13';
import { getWebhookCache } from './webhooks';

export async function cloneMessages(
  client: Client,
  sourceChannelId: string,
  targetChannelId: string,
  limit: number = 50
): Promise<void> {
  logger.info(`Starting message cloning for channel ${sourceChannelId}...`);

  try {
    const sourceChannel = await client.channels.fetch(sourceChannelId);
    const targetChannel = await client.channels.fetch(targetChannelId);

    if (!sourceChannel || !('messages' in sourceChannel)) {
      logger.warn(`Source channel ${sourceChannelId} is not a text channel`);
      return;
    }

    if (!targetChannel || !('send' in targetChannel)) {
      logger.warn(`Target channel ${targetChannelId} is not a text channel`);
      return;
    }

    const messages = await retry(() => sourceChannel.messages.fetch({ limit }));

    const sortedMessages = Array.from(messages.values()).reverse();

    logger.info(`Found ${sortedMessages.length} messages to clone`);

    for (const message of sortedMessages) {
      try {
        if (message.author.bot) {
          const webhookCache = getWebhookCache();
          const webhookId = webhookCache.get(message.author.id);
          
          if (webhookId && 'fetchWebhooks' in targetChannel) {
            const webhooks = await retry(() => targetChannel.fetchWebhooks());
            const webhook = webhooks.get(webhookId);
            
            if (webhook) {
              await retry(() => webhook.send({
                content: message.content || undefined,
                embeds: message.embeds.length > 0 ? message.embeds : undefined,
                files: message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined,
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL(),
              }));
              continue;
            }
          }
        }

        const content = message.content || '';
        const embeds = message.embeds.length > 0 ? message.embeds : undefined;
        const files = message.attachments.size > 0 ? Array.from(message.attachments.values()) : undefined;

        if (content || embeds || files) {
          await retry(() => targetChannel.send({
            content: content || undefined,
            embeds: embeds,
            files: files,
          }));

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Failed to clone message ${message.id}: ${error}`);
      }
    }

    logger.info(`Message cloning complete for channel ${sourceChannelId}`);
  } catch (error) {
    logger.error(`Error during message cloning: ${error}`);
    throw error;
  }
}

