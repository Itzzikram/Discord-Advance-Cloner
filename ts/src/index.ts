import { Client } from 'discord.js-selfbot-v13';
import { loadConfig } from './config';
import { logger } from './utils/logger';
import { spawnRustClient, stopRustClient } from './utils/client';
import { spawnRustProxy, stopProxy } from './utils/proxy';
import { cloneGuild } from './services/cloner';

async function main() {
  try {
    const config = loadConfig();
    logger.info('Starting Discord Cloner Hybrid...');

    const client = new Client();

    client.on('ready', async () => {
      logger.info(`Logged in as ${client.user?.tag}`);

      try {
        // Rust components are optional - if they fail, we'll use TypeScript fallback
        if (config.proxyHost && config.proxyPort) {
          try {
            logger.info('Attempting to spawn Rust proxy...');
            spawnRustProxy();
            logger.info('Rust proxy started successfully');
          } catch (error) {
            // Error already logged in spawnRustProxy with info level
            // Just continue without proxy
          }
        }

        try {
          logger.info('Attempting to spawn Rust client...');
          spawnRustClient(config.token);
          logger.info('Rust client started successfully');
        } catch (error) {
          // Error already logged in spawnRustClient with info level
          // Just continue without Rust client - TypeScript fallback will be used
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));

        logger.info('Starting clone process...');
        await cloneGuild(
          client,
          config.sourceGuildId,
          config.targetGuildId,
          {
            cloneGuilds: config.cloneGuilds,
            cloneChannels: config.cloneChannels,
            cloneRoles: config.cloneRoles,
            cloneMembers: config.cloneMembers,
            cloneMessages: config.cloneMessages,
            cloneEmojis: config.cloneEmojis,
            cloneWebhooks: config.cloneWebhooks,
            cloneThreads: config.cloneThreads,
            messageLimit: config.messageLimit,
          }
        );

        logger.info('Clone process completed!');
      } catch (error) {
        logger.error(`Error during clone: ${error}`);
      } finally {
        stopRustClient();
        stopProxy();
        await client.destroy();
        process.exit(0);
      }
    });

    client.on('error', (error) => {
      logger.error(`Client error: ${error}`);
    });

    await client.login(config.token);
  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  stopRustClient();
  stopProxy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  stopRustClient();
  stopProxy();
  process.exit(0);
});

main().catch((error) => {
  logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});

