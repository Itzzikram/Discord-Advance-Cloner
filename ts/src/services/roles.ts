import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { callRustClient, isRustClientAvailable } from '../utils/client';
import { Client } from 'discord.js-selfbot-v13';

export interface RoleData {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
}

export async function cloneRoles(
  client: Client,
  sourceGuildId: string,
  targetGuildId: string
): Promise<Map<string, string>> {
  logger.info('Starting role cloning...');
  const roleMap = new Map<string, string>();

  try {
    const sourceGuild = await client.guilds.fetch(sourceGuildId);
    const targetGuild = await client.guilds.fetch(targetGuildId);

    const sourceRoles = await retry(() => sourceGuild.roles.fetch());
    const targetRoles = await retry(() => targetGuild.roles.fetch());

    const sortedRoles = Array.from(sourceRoles.values())
      .filter((role) => !role.managed && role.name !== '@everyone')
      .sort((a, b) => b.position - a.position);

    logger.info(`Found ${sortedRoles.length} roles to clone`);

    for (const sourceRole of sortedRoles) {
      try {
        const roleData: RoleData = {
          id: sourceRole.id,
          name: sourceRole.name,
          color: sourceRole.color,
          hoist: sourceRole.hoist,
          mentionable: sourceRole.mentionable,
          permissions: sourceRole.permissions.bitfield.toString(),
          position: sourceRole.position,
        };

        logger.info(`Creating role: ${roleData.name}`);

        const createdRole = await retry(async () => {
          // Try Rust client if available, otherwise use TypeScript fallback
          if (isRustClientAvailable()) {
            try {
              const result = await callRustClient('create_role', {
                guild_id: targetGuildId,
                role: {
                  name: roleData.name,
                  color: roleData.color,
                  hoist: roleData.hoist,
                  mentionable: roleData.mentionable,
                  permissions: BigInt(roleData.permissions).toString(),
                  position: roleData.position,
                },
              });
              return result;
            } catch (error) {
              logger.debug(`Rust client failed, falling back to TS: ${error}`);
            }
          }
          // TypeScript fallback
          return await targetGuild.roles.create({
            name: roleData.name,
            color: roleData.color,
            hoist: roleData.hoist,
            mentionable: roleData.mentionable,
            permissions: BigInt(roleData.permissions),
            position: roleData.position,
          });
        });

        roleMap.set(sourceRole.id, createdRole.id || createdRole.role?.id || '');
        logger.info(`✓ Created role: ${roleData.name} (${createdRole.id || createdRole.role?.id})`);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to clone role ${sourceRole.name}: ${error}`);
      }
    }

    logger.info(`Role cloning complete. Mapped ${roleMap.size} roles`);
  } catch (error) {
    logger.error(`Error during role cloning: ${error}`);
    throw error;
  }

  return roleMap;
}

