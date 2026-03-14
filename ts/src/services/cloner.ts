import { Client } from 'discord.js-selfbot-v13';
import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { cloneRoles } from './roles';
import { cloneChannels } from './channels';
import { cloneWebhooks } from './webhooks';
import { cloneMessages } from './messages';
import { cloneThreads } from './threads';
import { cloneEmojis } from './emojis';
import { cloneMembers } from './members';

export interface CloneOptions {
  cloneGuilds?: boolean;
  cloneRoles?: boolean;
  cloneChannels?: boolean;
  cloneWebhooks?: boolean;
  cloneMessages?: boolean;
  cloneThreads?: boolean;
  cloneEmojis?: boolean;
  cloneMembers?: boolean;
  messageLimit?: number;
}

async function deleteAllChannels(client: Client, targetGuildId: string): Promise<void> {
  logger.info('Deleting all existing channels...');
  try {
    const targetGuild = await client.guilds.fetch(targetGuildId);
    const channels = await retry(() => targetGuild.channels.fetch());
    
    const channelsToDelete = Array.from(channels.values()).filter((ch): ch is NonNullable<typeof ch> => ch !== null);
    
    logger.info(`Found ${channelsToDelete.length} channels to delete`);
    
    for (const channel of channelsToDelete) {
      try {
        await retry(async () => {
          await channel.delete('Preparing for clone - deleting existing channels');
        }, { maxAttempts: 2, delayMs: 500 });
        logger.info(`✓ Deleted channel: ${channel.name || channel.id}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error: any) {
        logger.warn(`Failed to delete channel ${channel.name || channel.id}: ${error?.message || error}`);
        // Continue with other channels even if one fails
      }
    }
    
    logger.info('Channel deletion complete');
  } catch (error: any) {
    logger.warn(`Error during channel deletion (continuing anyway): ${error?.message || error}`);
    // Don't throw - continue with cloning even if deletion fails
  }
}

async function deleteAllRoles(client: Client, targetGuildId: string): Promise<void> {
  logger.info('Deleting all existing roles...');
  try {
    const targetGuild = await client.guilds.fetch(targetGuildId);
    const roles = await retry(() => targetGuild.roles.fetch());
    
    const rolesToDelete = Array.from(roles.values())
      .filter((role) => !role.managed && role.name !== '@everyone')
      .sort((a, b) => a.position - b.position); // Delete from lowest to highest position
    
    logger.info(`Found ${rolesToDelete.length} roles to delete`);
    
    for (const role of rolesToDelete) {
      try {
        await retry(async () => {
          await role.delete('Preparing for clone - deleting existing roles');
        });
        logger.info(`✓ Deleted role: ${role.name}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.warn(`Failed to delete role ${role.name}: ${error}`);
      }
    }
    
    logger.info('Role deletion complete');
  } catch (error) {
    logger.error(`Error during role deletion: ${error}`);
    throw error;
  }
}

async function deleteAllEmojis(client: Client, targetGuildId: string): Promise<void> {
  logger.info('Deleting all existing emojis...');
  try {
    const targetGuild = await client.guilds.fetch(targetGuildId);
    const emojis = await retry(() => targetGuild.emojis.fetch());
    
    logger.info(`Found ${emojis.size} emojis to delete`);
    
    for (const emoji of emojis.values()) {
      try {
        await retry(async () => {
          await emoji.delete('Preparing for clone - deleting existing emojis');
        });
        logger.info(`✓ Deleted emoji: ${emoji.name || emoji.id}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.warn(`Failed to delete emoji ${emoji.name || emoji.id}: ${error}`);
      }
    }
    
    logger.info('Emoji deletion complete');
  } catch (error) {
    logger.error(`Error during emoji deletion: ${error}`);
    throw error;
  }
}

async function deleteAllWebhooks(client: Client, targetGuildId: string): Promise<void> {
  logger.info('Deleting all existing webhooks...');
  try {
    const targetGuild = await client.guilds.fetch(targetGuildId);
    const channels = await retry(() => targetGuild.channels.fetch());
    
    let deletedCount = 0;
    
    for (const channel of channels.values()) {
      if (!channel || !('fetchWebhooks' in channel)) {
        continue;
      }
      
      try {
        const webhooks = await retry(() => channel.fetchWebhooks());
        
        for (const webhook of webhooks.values()) {
          try {
            await retry(async () => {
              await webhook.delete('Preparing for clone - deleting existing webhooks');
            });
            logger.info(`✓ Deleted webhook: ${webhook.name || webhook.id}`);
            deletedCount++;
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            logger.warn(`Failed to delete webhook ${webhook.name || webhook.id}: ${error}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch webhooks for channel ${channel.name || channel.id}: ${error}`);
      }
    }
    
    logger.info(`Webhook deletion complete. Deleted ${deletedCount} webhooks`);
  } catch (error) {
    logger.error(`Error during webhook deletion: ${error}`);
    throw error;
  }
}

export async function cloneGuild(
  client: Client,
  sourceGuildId: string,
  targetGuildId: string,
  options: CloneOptions = {}
): Promise<void> {
  const {
    cloneGuilds: shouldCloneGuilds = true,
    cloneRoles: shouldCloneRoles = true,
    cloneChannels: shouldCloneChannels = true,
    cloneWebhooks: shouldCloneWebhooks = true,
    cloneMessages: shouldCloneMessages = false,
    cloneThreads: shouldCloneThreads = false,
    cloneEmojis: shouldCloneEmojis = true,
    cloneMembers: shouldCloneMembers = false,
    messageLimit = 50,
  } = options;

  logger.info(`Starting guild clone from ${sourceGuildId} to ${targetGuildId}`);
  logger.info(`Clone settings: Guilds=${shouldCloneGuilds}, Channels=${shouldCloneChannels}, Roles=${shouldCloneRoles}, Emojis=${shouldCloneEmojis}, Webhooks=${shouldCloneWebhooks}, Messages=${shouldCloneMessages}, Threads=${shouldCloneThreads}, Members=${shouldCloneMembers}`);

  try {
    // Delete all existing content before cloning
    logger.info('=== DELETION PHASE: Removing all existing content from target guild ===');
    
    // Delete webhooks first (they're associated with channels)
    if (shouldCloneWebhooks) {
      await deleteAllWebhooks(client, targetGuildId);
    }
    
    // Delete channels (must be after webhooks since webhooks are in channels)
    if (shouldCloneChannels) {
      await deleteAllChannels(client, targetGuildId);
    }
    
    // Delete roles
    if (shouldCloneRoles) {
      await deleteAllRoles(client, targetGuildId);
    }
    
    // Delete emojis
    if (shouldCloneEmojis) {
      await deleteAllEmojis(client, targetGuildId);
    }
    
    logger.info('=== DELETION PHASE COMPLETE ===');
    logger.info('=== CLONING PHASE: Starting to clone from source guild ===');
    
    let roleMap = new Map<string, string>();
    let channelMap = new Map<string, string>();

    if (shouldCloneGuilds) {
      logger.info('Guild cloning is enabled (this is the main clone operation)');
    }

    if (shouldCloneRoles) {
      roleMap = await cloneRoles(client, sourceGuildId, targetGuildId);
    }

    if (shouldCloneEmojis) {
      await cloneEmojis(client, sourceGuildId, targetGuildId);
    }

    if (shouldCloneChannels) {
      channelMap = await cloneChannels(client, sourceGuildId, targetGuildId, roleMap);
    }

    if (shouldCloneWebhooks) {
      await cloneWebhooks(client, sourceGuildId, channelMap);
    }

    if (shouldCloneThreads) {
      for (const [sourceChannelId, targetChannelId] of channelMap.entries()) {
        try {
          await cloneThreads(client, sourceChannelId, targetChannelId);
        } catch (error) {
          logger.warn(`Failed to clone threads for channel ${sourceChannelId}: ${error}`);
        }
      }
    }

    if (shouldCloneMessages) {
      for (const [sourceChannelId, targetChannelId] of channelMap.entries()) {
        try {
          await cloneMessages(client, sourceChannelId, targetChannelId, messageLimit);
        } catch (error) {
          logger.warn(`Failed to clone messages for channel ${sourceChannelId}: ${error}`);
        }
      }
    }

    if (shouldCloneMembers) {
      await cloneMembers(client, sourceGuildId, targetGuildId, roleMap);
    }

    logger.info('Guild clone completed successfully!');
  } catch (error) {
    logger.error(`Error during guild clone: ${error}`);
    throw error;
  }
}

