import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { Client } from 'discord.js-selfbot-v13';

// Channel type constants
const ChannelType = {
  GuildPublicThread: 11,
  GuildPrivateThread: 12,
} as const;

export async function cloneThreads(
  client: Client,
  sourceChannelId: string,
  targetChannelId: string
): Promise<void> {
  logger.info(`Starting thread cloning for channel ${sourceChannelId}...`);

  try {
    const sourceChannel = await client.channels.fetch(sourceChannelId);
    const targetChannel = await client.channels.fetch(targetChannelId);

    if (!sourceChannel || !('threads' in sourceChannel)) {
      logger.warn(`Source channel ${sourceChannelId} does not support threads`);
      return;
    }

    if (!targetChannel || !('threads' in targetChannel)) {
      logger.warn(`Target channel ${targetChannelId} does not support threads`);
      return;
    }

    const activeThreads = await retry(() => sourceChannel.threads.fetchActive());
    const archivedThreads = await retry(() => sourceChannel.threads.fetchArchived());

    const allThreads = [
      ...Array.from(activeThreads.threads.values()),
      ...Array.from(archivedThreads.threads.values()),
    ];

    logger.info(`Found ${allThreads.length} threads to clone`);

    for (const thread of allThreads) {
      try {
        logger.info(`Creating thread: ${thread.name}`);

        const createdThread = await retry(async () => {
          const threadType = typeof thread.type === 'string' ? parseInt(thread.type) : thread.type;
          
          if (threadType === ChannelType.GuildPublicThread) {
            // For public threads, we need a message to start from
            // Try to get the first message or create a starter message
            if ('send' in targetChannel) {
              const starterMessage = await targetChannel.send('Thread starter message');
              return await starterMessage.startThread({
                name: thread.name || 'Unnamed Thread',
                autoArchiveDuration: thread.autoArchiveDuration || 60,
              });
            }
            throw new Error('Cannot create public thread without a message');
          } else if (threadType === ChannelType.GuildPrivateThread) {
            if ('threads' in targetChannel) {
              const createOptions: any = {
                name: thread.name || 'Unnamed Thread',
                autoArchiveDuration: thread.autoArchiveDuration || 60,
              };
              // Type is required for private threads but may not be in the type definition
              (createOptions as any).type = ChannelType.GuildPrivateThread;
              return await targetChannel.threads.create(createOptions);
            }
            throw new Error('Cannot create private thread');
          }
          throw new Error(`Unsupported thread type: ${threadType}`);
        });

        logger.info(`✓ Created thread: ${thread.name} (${createdThread.id})`);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to clone thread ${thread.name}: ${error}`);
      }
    }

    logger.info(`Thread cloning complete for channel ${sourceChannelId}`);
  } catch (error) {
    logger.error(`Error during thread cloning: ${error}`);
    throw error;
  }
}

