import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { Client } from 'discord.js-selfbot-v13';

export async function cloneEmojis(
  client: Client,
  sourceGuildId: string,
  targetGuildId: string
): Promise<void> {
  logger.info('Starting emoji cloning...');

  try {
    const sourceGuild = await client.guilds.fetch(sourceGuildId);
    const targetGuild = await client.guilds.fetch(targetGuildId);

    const sourceEmojis = await retry(() => sourceGuild.emojis.fetch());
    const targetEmojis = await retry(() => targetGuild.emojis.fetch());

    const existingEmojiNames = new Set(Array.from(targetEmojis.values()).map(e => e.name?.toLowerCase()));

    logger.info(`Found ${sourceEmojis.size} emojis to clone`);

    let clonedCount = 0;
    let skippedCount = 0;

    for (const emoji of sourceEmojis.values()) {
      try {
        if (!emoji.name) {
          logger.warn(`Skipping emoji ${emoji.id} (no name)`);
          skippedCount++;
          continue;
        }

        if (existingEmojiNames.has(emoji.name.toLowerCase())) {
          logger.debug(`Skipping emoji ${emoji.name} (already exists)`);
          skippedCount++;
          continue;
        }

        if (emoji.animated) {
          logger.info(`Creating animated emoji: ${emoji.name}`);
        } else {
          logger.info(`Creating emoji: ${emoji.name}`);
        }

        const emojiUrl = emoji.url;
        if (!emojiUrl) {
          logger.warn(`Skipping emoji ${emoji.name} (no image URL)`);
          skippedCount++;
          continue;
        }

        const response = await fetch(emojiUrl);
        if (!response.ok) {
          logger.warn(`Failed to fetch emoji image for ${emoji.name}`);
          skippedCount++;
          continue;
        }

        const buffer = await response.arrayBuffer();
        const emojiData = Buffer.from(buffer);

        await retry(async () => {
          return await targetGuild.emojis.create(emojiData, emoji.name!, {
            reason: `Cloned from ${sourceGuild.name}`,
          });
        });

        clonedCount++;
        logger.info(`✓ Created emoji: ${emoji.name}`);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to clone emoji ${emoji.name}: ${error}`);
      }
    }

    logger.info(`Emoji cloning complete. Cloned ${clonedCount}, skipped ${skippedCount}`);
  } catch (error) {
    logger.error(`Error during emoji cloning: ${error}`);
    throw error;
  }
}

