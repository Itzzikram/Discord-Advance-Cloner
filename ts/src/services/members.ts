import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { Client } from 'discord.js-selfbot-v13';

export async function cloneMembers(
  client: Client,
  sourceGuildId: string,
  targetGuildId: string,
  roleMap: Map<string, string>
): Promise<void> {
  logger.info('Starting member cloning...');

  try {
    const sourceGuild = await client.guilds.fetch(sourceGuildId);
    const targetGuild = await client.guilds.fetch(targetGuildId);

    const sourceMembers = await retry(() => sourceGuild.members.fetch());
    const targetMembers = await retry(() => targetGuild.members.fetch());

    const existingMemberIds = new Set(Array.from(targetMembers.keys()));

    logger.info(`Found ${sourceMembers.size} members in source guild`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const member of sourceMembers.values()) {
      try {
        if (member.user.bot) {
          logger.debug(`Skipping bot member: ${member.user.tag}`);
          skippedCount++;
          continue;
        }

        if (existingMemberIds.has(member.id)) {
          logger.debug(`Member ${member.user.tag} already exists in target guild`);
          skippedCount++;
          continue;
        }

        logger.info(`Processing member: ${member.user.tag}`);

        const memberRoles = Array.from(member.roles.cache.values())
          .filter(role => !role.managed && role.name !== '@everyone')
          .map(role => roleMap.get(role.id))
          .filter((id): id is string => id !== undefined);

        if (memberRoles.length > 0) {
          logger.debug(`Member ${member.user.tag} has ${memberRoles.length} roles to map`);
        }

        processedCount++;

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`Failed to process member ${member.user.tag}: ${error}`);
      }
    }

    logger.info(`Member cloning complete. Processed ${processedCount}, skipped ${skippedCount}`);
    logger.warn('Note: Member cloning only processes member data. Actual member invites require manual intervention.');
  } catch (error) {
    logger.error(`Error during member cloning: ${error}`);
    throw error;
  }
}

