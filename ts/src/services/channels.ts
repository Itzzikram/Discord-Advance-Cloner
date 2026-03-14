import { logger } from '../utils/logger';
import { retry } from '../utils/retry';
import { callRustClient, isRustClientAvailable } from '../utils/client';
import { Client } from 'discord.js-selfbot-v13';

// Channel type constants - discord.js-selfbot-v13 uses string constants
const ChannelType = {
  GuildText: 0,
  DM: 1,
  GuildVoice: 2,
  GroupDM: 3,
  GuildCategory: 4,
  GuildNews: 5,
  GuildStore: 6,
  GuildNewsThread: 10,
  GuildPublicThread: 11,
  GuildPrivateThread: 12,
  GuildStageVoice: 13,
  GuildForum: 15,
} as const;

// String constants for discord.js-selfbot-v13
const ChannelTypeStrings = {
  GUILD_TEXT: 'GUILD_TEXT',
  GUILD_VOICE: 'GUILD_VOICE',
  GUILD_CATEGORY: 'GUILD_CATEGORY',
  GUILD_NEWS: 'GUILD_NEWS',
  GUILD_STAGE_VOICE: 'GUILD_STAGE_VOICE',
  GUILD_FORUM: 'GUILD_FORUM',
} as const;

export interface ChannelData {
  id: string;
  name: string;
  type: number;
  topic?: string;
  bitrate?: number;
  userLimit?: number;
  rateLimitPerUser?: number;
  position: number;
  parentId?: string;
  nsfw?: boolean;
}

// Helper function to clone channel permission overwrites
async function cloneChannelPermissions(
  client: Client,
  sourceChannel: any,
  targetChannel: any,
  roleMap: Map<string, string>,
  targetGuildId: string
): Promise<void> {
  try {
    // Get permission overwrites from source channel
    const permissionOverwrites = sourceChannel.permissionOverwrites;
    
    if (!permissionOverwrites || permissionOverwrites.cache.size === 0) {
      logger.debug(`No permission overwrites for channel ${sourceChannel.name}`);
      return;
    }
    
    logger.info(`Cloning ${permissionOverwrites.cache.size} permission overwrites for channel ${sourceChannel.name}`);
    
    // Get target guild for role/user lookups
    const targetGuild = await client.guilds.fetch(targetGuildId);
    
    // Process each permission overwrite
    for (const [id, overwrite] of permissionOverwrites.cache.entries()) {
      try {
        // Determine if this is a role or user overwrite
        // overwrite.type can be: 0 (role), 1 (member), or string ('role', 'member')
        let overwriteType: number;
        if (typeof overwrite.type === 'string') {
          overwriteType = overwrite.type === 'role' ? 0 : 1;
        } else {
          overwriteType = overwrite.type;
        }
        
        let targetId: string | null = null;
        const typeName = overwriteType === 0 ? 'role' : 'user';
        
        if (overwriteType === 0) {
          // Role overwrite - map role ID using roleMap
          targetId = roleMap.get(id) || null;
          if (!targetId) {
            logger.debug(`Role ${id} not found in roleMap for channel ${sourceChannel.name}, skipping permission overwrite`);
            continue;
          }
          logger.debug(`Mapping role permission overwrite: ${id} -> ${targetId} for channel ${sourceChannel.name}`);
        } else if (overwriteType === 1) {
          // User overwrite - check if user is in target guild
          try {
            const member = await targetGuild.members.fetch(id);
            targetId = member.id;
            logger.debug(`Found user ${targetId} in target guild for channel ${sourceChannel.name}`);
          } catch (userError: any) {
            logger.debug(`User ${id} not found in target guild for channel ${sourceChannel.name}, skipping permission overwrite`);
            continue;
          }
        } else {
          logger.warn(`Unknown overwrite type ${overwrite.type} (${overwriteType}) for channel ${sourceChannel.name}, skipping`);
          continue;
        }
        
        if (!targetId) {
          continue;
        }
        
        // Get allow and deny permissions
        // Handle different permission formats
        let allow: any = overwrite.allow;
        let deny: any = overwrite.deny;
        
        // If allow/deny are PermissionOverwrite objects, get their bitfield
        if (allow && typeof allow === 'object') {
          if ('bitfield' in allow) {
            allow = allow.bitfield;
          } else if ('allow' in allow) {
            allow = allow.allow;
          }
        }
        if (deny && typeof deny === 'object') {
          if ('bitfield' in deny) {
            deny = deny.bitfield;
          } else if ('deny' in deny) {
            deny = deny.deny;
          }
        }
        
        // Convert to numbers if they're BigInt, default to 0 if undefined/null
        const allowNumber = typeof allow === 'bigint' ? Number(allow) : (allow || 0);
        const denyNumber = typeof deny === 'bigint' ? Number(deny) : (deny || 0);
        
        // Skip if both allow and deny are 0 (no permissions to set)
        if (allowNumber === 0 && denyNumber === 0) {
          logger.debug(`Skipping permission overwrite for ${typeName} ${targetId} on channel ${targetChannel.name} (both allow and deny are 0)`);
          continue;
        }
        
        // Apply permission overwrite to target channel
        try {
          // Check if permissionOverwrites exists and has create method
          if (!targetChannel.permissionOverwrites) {
            logger.warn(`Target channel ${targetChannel.name} does not have permissionOverwrites property`);
            continue;
          }
          
          if (typeof targetChannel.permissionOverwrites.create !== 'function') {
            logger.warn(`Target channel ${targetChannel.name} permissionOverwrites.create is not a function`);
            continue;
          }
          
          // Create permission overwrite
          await targetChannel.permissionOverwrites.create(targetId, {
            allow: allowNumber,
            deny: denyNumber,
          });
          
          logger.info(`✓ Applied permission overwrite for ${typeName} ${targetId} on channel ${targetChannel.name} (allow: ${allowNumber}, deny: ${denyNumber})`);
        } catch (createError: any) {
          logger.warn(`Failed to create permission overwrite for ${typeName} ${targetId} on channel ${targetChannel.name}: ${createError?.message || createError}`);
          logger.debug(`  Error details: code=${createError?.code || 'N/A'}, status=${createError?.status || createError?.statusCode || 'N/A'}`);
        }
      } catch (overwriteError: any) {
        logger.warn(`Error processing permission overwrite ${id} for channel ${sourceChannel.name}: ${overwriteError?.message || overwriteError}`);
      }
    }
    
    logger.info(`✓ Permission overwrites cloned for channel ${sourceChannel.name}`);
  } catch (error: any) {
    logger.error(`Error cloning permissions for channel ${sourceChannel.name}: ${error?.message || error}`);
    throw error;
  }
}

export async function cloneChannels(
  client: Client,
  sourceGuildId: string,
  targetGuildId: string,
  roleMap: Map<string, string>
): Promise<Map<string, string>> {
  logger.info('Starting channel cloning...');
  const channelMap = new Map<string, string>();

  try {
    const sourceGuild = await client.guilds.fetch(sourceGuildId);
    const targetGuild = await client.guilds.fetch(targetGuildId);
    
    // Log guild info for debugging
    logger.info(`Source guild: ${sourceGuild.name} (${sourceGuildId})`);
    logger.info(`Target guild: ${targetGuild.name} (${targetGuildId})`);
    
    // Check if we have permissions
    try {
      const member = await targetGuild.members.fetch(client.user!.id);
      const permissions = member.permissions;
      logger.info(`Bot permissions in target guild: ${permissions.toArray().join(', ')}`);
      
      if (!permissions.has('MANAGE_CHANNELS')) {
        logger.error(`❌ Missing MANAGE_CHANNELS permission in target guild!`);
        logger.error(`  The bot/user needs MANAGE_CHANNELS permission to create channels`);
      } else {
        logger.info(`✓ Bot has MANAGE_CHANNELS permission`);
      }
    } catch (permError: any) {
      logger.warn(`Could not check permissions: ${permError?.message || permError}`);
    }

    const sourceChannels = await retry(() => sourceGuild.channels.fetch());
    const allChannels = Array.from(sourceChannels.values()).filter((ch): ch is NonNullable<typeof ch> => ch !== null);
    
    // Helper function to check if a channel is a category
    const isCategory = (ch: any): boolean => {
      const chType = ch.type;
      
      // Check if it's a string type (like "GUILD_CATEGORY")
      if (typeof chType === 'string') {
        return chType === 'GUILD_CATEGORY' || chType === '4';
      }
      
      // Check if it's a number type
      if (typeof chType === 'number') {
        return chType === ChannelType.GuildCategory;
      }
      
      // Try to parse as number
      const parsed = parseInt(chType);
      if (!isNaN(parsed)) {
        return parsed === ChannelType.GuildCategory;
      }
      
      // Default: check if type property matches
      return false;
    };

    const sortedChannels = allChannels
      .filter((ch) => !isCategory(ch))
      .sort((a, b) => (a.parent?.position || 0) - (b.parent?.position || 0) || a.position - b.position);

    const categories = allChannels
      .filter((ch) => isCategory(ch))
      .sort((a, b) => a.position - b.position);
    
    // Log detailed info about categories found
    logger.info(`Found ${categories.length} categories out of ${allChannels.length} total channels`);
    if (categories.length === 0 && allChannels.length > 0) {
      logger.warn(`⚠ No categories found! Checking channel types...`);
      const typeCounts = new Map<string | number, number>();
      allChannels.forEach(ch => {
        const type = (ch as any).type;
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });
      logger.warn(`Channel type distribution:`, Array.from(typeCounts.entries()).map(([type, count]) => `${type} (${typeof type}): ${count}`).join(', '));
      
      // Check if any channels have parentIds (which would indicate categories exist)
      const channelsWithParents = allChannels.filter(ch => (ch as any).parentId);
      if (channelsWithParents.length > 0) {
        logger.warn(`⚠ ${channelsWithParents.length} channels have parentIds, but 0 categories were found! This suggests categories exist but aren't being detected.`);
      }
    }

    logger.info(`Found ${categories.length} categories and ${sortedChannels.length} channels to clone`);

    for (const sourceCategory of categories) {
      try {
        logger.info(`Creating category: ${sourceCategory.name} (position: ${sourceCategory.position})`);

        let createdCategory: any = null;
        
        // Try Rust client if available, otherwise use TypeScript fallback
        if (isRustClientAvailable()) {
          try {
            logger.debug(`Trying Rust client for category: ${sourceCategory.name}`);
            const result = await callRustClient('create_channel', {
              guild_id: targetGuildId,
              channel: {
                name: sourceCategory.name,
                type: ChannelType.GuildCategory,
                position: sourceCategory.position,
              },
            });
            createdCategory = result;
            logger.debug(`Rust client succeeded for category: ${sourceCategory.name}`);
          } catch (error: any) {
            logger.debug(`Rust client failed for category ${sourceCategory.name}, falling back to TS: ${error?.message || error}`);
          }
        }

        // TypeScript fallback if Rust client failed or is not available
        if (!createdCategory) {
          try {
            logger.info(`Using TypeScript fallback to create category: ${sourceCategory.name}`);
            
            // Log what we're working with
            logger.info(`targetGuild.channels type: ${typeof targetGuild.channels}`);
            if (targetGuild.channels) {
              logger.info(`targetGuild.channels methods: ${Object.getOwnPropertyNames(targetGuild.channels).slice(0, 20).join(', ')}`);
            }
            
            // Check if channels.create exists
            if (!targetGuild.channels) {
              throw new Error(`targetGuild.channels is null/undefined`);
            }
            
            if (typeof targetGuild.channels.create !== 'function') {
              logger.error(`targetGuild.channels.create is not a function!`);
              logger.error(`Type of channels: ${typeof targetGuild.channels}`);
              logger.error(`Available properties: ${Object.keys(targetGuild.channels).join(', ')}`);
              logger.error(`targetGuild.channels object:`, targetGuild.channels);
              throw new Error(`targetGuild.channels.create is not a function. Type: ${typeof targetGuild.channels.create}`);
            }
            
            logger.info(`✓ channels.create exists, attempting to create category: "${sourceCategory.name}"`);
            
            // Build options
            const categoryOptions: any = {
              type: ChannelType.GuildCategory, // Use numeric type (0-15)
            };
            if (sourceCategory.position !== undefined) {
              categoryOptions.position = sourceCategory.position;
            }
            
            logger.info(`Creating category with options:`, JSON.stringify(categoryOptions, null, 2));
            
            // Try creating with retry mechanism
            let lastError: any = null;
            
            // Try with position first
            try {
              logger.info(`Attempt 1: Creating category "${sourceCategory.name}" with type ${categoryOptions.type} and position ${categoryOptions.position || 'none'}`);
              logger.info(`  Calling: targetGuild.channels.create("${sourceCategory.name}", ${JSON.stringify(categoryOptions)})`);
              
              createdCategory = await targetGuild.channels.create(sourceCategory.name, categoryOptions);
              
              if (createdCategory) {
                logger.info(`✓✓✓ Category created successfully! ID: ${createdCategory.id || createdCategory.channel?.id || 'N/A'}`);
                logger.info(`  Category object:`, {
                  id: createdCategory.id,
                  name: createdCategory.name,
                  type: createdCategory.type,
                  guild: createdCategory.guild?.name,
                });
              } else {
                throw new Error('channels.create returned null/undefined');
              }
            } catch (error1: any) {
              lastError = error1;
              logger.error(`✗ Attempt 1 failed for category "${sourceCategory.name}":`);
              logger.error(`  Error message: ${error1?.message || error1}`);
              logger.error(`  Error code: ${error1?.code || 'N/A'}`);
              logger.error(`  Error status: ${error1?.status || error1?.statusCode || 'N/A'}`);
              logger.error(`  Error name: ${error1?.name || 'N/A'}`);
              
              // Log the full error structure
              if (error1?.rawError) {
                logger.error(`  Raw error:`, error1.rawError);
              }
              if (error1?.requestData) {
                logger.error(`  Request data:`, error1.requestData);
              }
              if (error1?.response) {
                logger.error(`  Response:`, error1.response);
              }
              if (error1?.status === 400 || error1?.statusCode === 400) {
                logger.error(`  This is a 400 Bad Request - likely invalid parameters`);
              }
              
              // Try without position
              try {
                logger.info(`Attempt 2: Creating category "${sourceCategory.name}" without position`);
                const optionsWithoutPosition: any = {
                  type: ChannelType.GuildCategory,
                };
                logger.info(`  Calling: targetGuild.channels.create("${sourceCategory.name}", ${JSON.stringify(optionsWithoutPosition)})`);
                
                createdCategory = await targetGuild.channels.create(sourceCategory.name, optionsWithoutPosition);
                
                if (createdCategory) {
                  logger.info(`✓✓✓ Category created successfully (without position)! ID: ${createdCategory.id || createdCategory.channel?.id || 'N/A'}`);
                } else {
                  throw new Error('channels.create returned null/undefined');
                }
              } catch (error2: any) {
                lastError = error2;
                logger.error(`✗ Attempt 2 failed for category "${sourceCategory.name}":`);
                logger.error(`  Error message: ${error2?.message || error2}`);
                logger.error(`  Error code: ${error2?.code || 'N/A'}`);
                logger.error(`  Error status: ${error2?.status || error2?.statusCode || 'N/A'}`);
                
                // Try with just the name and type as separate arguments (in case the API format is different)
                try {
                  logger.info(`Attempt 3: Creating category "${sourceCategory.name}" with just name and type`);
                  // Some Discord.js versions might accept just the name
                  createdCategory = await targetGuild.channels.create(sourceCategory.name, {
                    type: ChannelType.GuildCategory,
                  });
                  
                  if (createdCategory) {
                    logger.info(`✓✓✓ Category created successfully (minimal options)! ID: ${createdCategory.id || createdCategory.channel?.id || 'N/A'}`);
                  } else {
                    throw new Error('channels.create returned null/undefined');
                  }
                } catch (error3: any) {
                  lastError = error3;
                  logger.error(`✗ Attempt 3 failed for category "${sourceCategory.name}":`);
                  logger.error(`  Error message: ${error3?.message || error3}`);
                  logger.error(`  Error code: ${error3?.code || 'N/A'}`);
                  logger.error(`  Error status: ${error3?.status || error3?.statusCode || 'N/A'}`);
                  
                  // Log all errors
                  logger.error(`❌❌❌ All 3 attempts failed for category "${sourceCategory.name}"`);
                  logger.error(`  Attempt 1: ${error1?.message || 'N/A'} (code: ${error1?.code || 'N/A'}, status: ${error1?.status || error1?.statusCode || 'N/A'})`);
                  logger.error(`  Attempt 2: ${error2?.message || 'N/A'} (code: ${error2?.code || 'N/A'}, status: ${error2?.status || error2?.statusCode || 'N/A'})`);
                  logger.error(`  Attempt 3: ${error3?.message || 'N/A'} (code: ${error3?.code || 'N/A'}, status: ${error3?.status || error3?.statusCode || 'N/A'})`);
                  
                  // Log the most detailed error
                  logger.error(`  Most detailed error (error3):`, JSON.stringify(error3, Object.getOwnPropertyNames(error3), 2));
                  
                  throw error3;
                }
              }
            }
            
            // Validate result
            if (!createdCategory) {
              logger.error(`✗ Category creation returned null/undefined after all attempts`);
              throw new Error(`Category creation returned null/undefined for ${sourceCategory.name}`);
            }
            
            if (!createdCategory.id) {
              logger.error(`✗ Category created but has no ID`);
              logger.error(`  Category object:`, JSON.stringify(createdCategory, null, 2));
              throw new Error(`Category created but has no ID for ${sourceCategory.name}`);
            }
            
            logger.info(`✓✓✓ Category creation SUCCESS! Name: ${sourceCategory.name}, ID: ${createdCategory.id}`);
          } catch (error: any) {
            logger.error(`❌ FAILED to create category "${sourceCategory.name}" after all attempts:`);
            logger.error(`  Error message: ${error?.message || error}`);
            logger.error(`  Error code: ${error?.code || 'N/A'}`);
            logger.error(`  Error status: ${error?.status || error?.statusCode || 'N/A'}`);
            logger.error(`  Error name: ${error?.name || 'N/A'}`);
            
            // Log Discord API error details if available
            if (error?.rawError) {
              logger.error(`  Raw error:`, error.rawError);
            }
            if (error?.requestData) {
              logger.error(`  Request data:`, error.requestData);
            }
            if (error?.response) {
              logger.error(`  Response:`, error.response);
            }
            if (error?.stack) {
              logger.error(`  Stack trace:`, error.stack);
            }
            
            // Don't throw - log and continue to next category
            logger.error(`  Skipping category "${sourceCategory.name}" and continuing...`);
            createdCategory = null; // Ensure it's null so we skip this category
          }
        }

        // Only proceed if category was actually created
        if (!createdCategory) {
          logger.warn(`⚠ Category "${sourceCategory.name}" was not created - skipping and continuing to next category`);
          continue; // Skip to next category
        }

        // Extract category ID - check multiple possible response formats
        const categoryId = createdCategory?.id 
          || createdCategory?.channel?.id 
          || (createdCategory?.data?.id || '')
          || (createdCategory?.channel_id || '');
        
        if (!categoryId) {
          logger.error(`❌ Category creation returned no ID for "${sourceCategory.name}"`);
          logger.error(`  Created category object type: ${typeof createdCategory}`);
          logger.error(`  Created category object keys: ${Object.keys(createdCategory || {}).join(', ')}`);
          logger.error(`  Created category object:`, JSON.stringify(createdCategory, null, 2));
          logger.warn(`  Skipping category "${sourceCategory.name}" - no ID available`);
          continue; // Skip to next category
        }
        
        // Store the mapping
        channelMap.set(sourceCategory.id, categoryId);
        logger.info(`✓✓✓ Successfully created and mapped category: "${sourceCategory.name}" (${sourceCategory.id} -> ${categoryId})`);

        // Wait before creating next category to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        // This catch should only trigger for unexpected errors (not from the inner catch)
        logger.error(`❌ CRITICAL: Unexpected error while cloning category "${sourceCategory.name}":`);
        logger.error(`  Error: ${error?.message || error}`);
        logger.error(`  Error code: ${error?.code || 'N/A'}`);
        logger.error(`  Error status: ${error?.status || 'N/A'}`);
        logger.error(`  Stack: ${error?.stack || 'N/A'}`);
        logger.error(`  This category will be skipped, but cloning will continue`);
        // Continue to next category
      }
    }
    
    logger.info(`Category cloning complete. Created ${channelMap.size} categories out of ${categories.length} attempted`);

    // Helper function to convert channel type to number
    const getChannelTypeNumber = (chType: any): number => {
      // If it's already a number, return it
      if (typeof chType === 'number') {
        return chType;
      }
      
      // If it's a string, try to map it
      if (typeof chType === 'string') {
        // Try direct string matches first
        if (chType === 'GUILD_TEXT' || chType === '0') return ChannelType.GuildText;
        if (chType === 'GUILD_VOICE' || chType === '2') return ChannelType.GuildVoice;
        if (chType === 'GUILD_CATEGORY' || chType === '4') return ChannelType.GuildCategory;
        if (chType === 'GUILD_NEWS' || chType === '5') return ChannelType.GuildNews;
        if (chType === 'GUILD_STAGE_VOICE' || chType === '13') return ChannelType.GuildStageVoice;
        if (chType === 'GUILD_FORUM' || chType === '15') return ChannelType.GuildForum;
        
        // Try parsing as number
        const parsed = parseInt(chType);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      
      // Fallback: try to parse whatever it is
      const parsed = parseInt(chType);
      return isNaN(parsed) ? ChannelType.GuildText : parsed; // Default to text if can't parse
    };

    for (const sourceChannel of sortedChannels) {
      try {
        const chType = (sourceChannel as any).type;
        const channelTypeNumber = getChannelTypeNumber(chType);
        
        const channelData: ChannelData = {
          id: sourceChannel.id,
          name: sourceChannel.name || 'unnamed',
          type: channelTypeNumber,
          position: sourceChannel.position,
          parentId: sourceChannel.parentId || undefined,
          nsfw: ('nsfw' in sourceChannel && sourceChannel.nsfw) || undefined,
        };
        
        // Log channel type for debugging
        logger.debug(`Channel ${channelData.name}: original type=${chType} (${typeof chType}), converted to=${channelTypeNumber}`);

        if ('topic' in sourceChannel && sourceChannel.topic) {
          channelData.topic = sourceChannel.topic;
        }
        if ('bitrate' in sourceChannel && sourceChannel.bitrate) {
          channelData.bitrate = sourceChannel.bitrate;
        }
        if ('userLimit' in sourceChannel && sourceChannel.userLimit) {
          channelData.userLimit = sourceChannel.userLimit;
        }
        if ('rateLimitPerUser' in sourceChannel && sourceChannel.rateLimitPerUser) {
          channelData.rateLimitPerUser = sourceChannel.rateLimitPerUser;
        }

        // Get the parent category ID - only use it if it's actually a category
        let mappedParentId: string | undefined = undefined;
        let parentCategory: any = null;
        
        if (sourceChannel.parentId) {
          const parentIdFromMap = channelMap.get(sourceChannel.parentId);
          if (parentIdFromMap) {
            // Verify that the parent is actually a category by fetching it
            try {
              const fetchedParent = await client.channels.fetch(parentIdFromMap);
              if (fetchedParent) {
                const parentType = typeof (fetchedParent as any).type === 'string' 
                  ? parseInt((fetchedParent as any).type) 
                  : (fetchedParent as any).type;
                
                if (parentType === ChannelType.GuildCategory) {
                  mappedParentId = parentIdFromMap;
                  parentCategory = fetchedParent;
                  logger.info(`Found valid parent category for channel ${channelData.name}: ${parentCategory.name} (${mappedParentId})`);
                } else {
                  logger.warn(`Parent channel ${sourceChannel.parentId} (mapped to ${parentIdFromMap}) is not a category (type: ${parentType}), creating channel without parent`);
                }
              }
            } catch (fetchError: any) {
              logger.warn(`Could not fetch parent channel ${parentIdFromMap} to verify it's a category: ${fetchError?.message}. Creating channel without parent.`);
            }
          } else {
            logger.warn(`Parent category ${sourceChannel.parentId} not found in channelMap for channel ${channelData.name}. Creating without parent.`);
          }
        }

        // Log channel type name for better debugging
        const typeName = channelData.type === ChannelType.GuildText ? 'Text' :
                        channelData.type === ChannelType.GuildVoice ? 'Voice' :
                        channelData.type === ChannelType.GuildCategory ? 'Category' :
                        channelData.type === ChannelType.GuildNews ? 'Announcement' :
                        channelData.type === ChannelType.GuildForum ? 'Forum' :
                        channelData.type === ChannelType.GuildStageVoice ? 'Stage' :
                        `Type ${channelData.type}`;
        
        logger.info(`Creating ${typeName} channel: ${channelData.name} (type: ${channelData.type}${mappedParentId ? `, parent category: ${parentCategory?.name || mappedParentId}` : ''})`);

        let createdChannel: any = null;
        
        // Try Rust client if available, otherwise use TypeScript fallback
        if (isRustClientAvailable()) {
          try {
            logger.debug(`Trying Rust client for channel: ${channelData.name}`);
            const result = await callRustClient('create_channel', {
              guild_id: targetGuildId,
              channel: {
                name: channelData.name,
                type: channelData.type,
                topic: channelData.topic,
                bitrate: channelData.bitrate,
                user_limit: channelData.userLimit,
                rate_limit_per_user: channelData.rateLimitPerUser,
                position: channelData.position,
                parent_id: mappedParentId,
                nsfw: channelData.nsfw,
              },
            });
            createdChannel = result;
            logger.debug(`Rust client succeeded for channel: ${channelData.name}`);
          } catch (error: any) {
            logger.debug(`Rust client failed for channel ${channelData.name}, falling back to TS: ${error?.message || error}`);
          }
        }

        // TypeScript fallback if Rust client failed or is not available
        if (!createdChannel) {
          try {
            logger.info(`Using TypeScript fallback to create channel: ${channelData.name}`);
            // Convert numeric type to string type for discord.js-selfbot-v13
            let channelTypeString: string | undefined;
            if (channelData.type === ChannelType.GuildText) {
              channelTypeString = ChannelTypeStrings.GUILD_TEXT;
            } else if (channelData.type === ChannelType.GuildVoice) {
              channelTypeString = ChannelTypeStrings.GUILD_VOICE;
            } else if (channelData.type === ChannelType.GuildCategory) {
              channelTypeString = ChannelTypeStrings.GUILD_CATEGORY;
            } else if (channelData.type === ChannelType.GuildNews) {
              channelTypeString = ChannelTypeStrings.GUILD_NEWS;
            } else if (channelData.type === ChannelType.GuildStageVoice) {
              channelTypeString = ChannelTypeStrings.GUILD_STAGE_VOICE;
            } else if (channelData.type === ChannelType.GuildForum) {
              channelTypeString = ChannelTypeStrings.GUILD_FORUM;
            }
            
            // Try with string type first
            let createOptions: any = {};
            
            try {
              createOptions = {
                type: channelTypeString || channelData.type, // Use string if available, fallback to numeric
              };
              if (channelData.topic) createOptions.topic = channelData.topic;
              if (channelData.bitrate) createOptions.bitrate = channelData.bitrate;
              if (channelData.userLimit) createOptions.userLimit = channelData.userLimit;
              if (channelData.rateLimitPerUser) createOptions.rateLimitPerUser = channelData.rateLimitPerUser;
              if (channelData.position !== undefined) createOptions.position = channelData.position;
              if (mappedParentId && parentCategory) {
                // Use the already-fetched parent category object
                createOptions.parent = parentCategory;
                logger.debug(`Using verified parent category for ${channelData.name}: ${parentCategory.name}`);
              } else if (mappedParentId) {
                // Fallback: try to use the ID directly (shouldn't happen since we verified above)
                logger.warn(`Using parent ID directly without verification: ${mappedParentId}`);
                createOptions.parent = mappedParentId;
              }
              if (channelData.nsfw !== undefined) createOptions.nsfw = channelData.nsfw;

              logger.info(`Attempting channel creation: "${channelData.name}", options:`, JSON.stringify(createOptions, null, 2));
              
              createdChannel = await targetGuild.channels.create(channelData.name, createOptions);
              
              if (createdChannel && createdChannel.id) {
                logger.info(`Channel creation succeeded! ID: ${createdChannel.id}`);
              } else {
                throw new Error(`Channel created but has no ID`);
              }
            } catch (error: any) {
              // If string type failed, try numeric type
              logger.debug(`First attempt failed, trying numeric type: ${error?.message}`);
              
              try {
                createOptions = {
                  type: channelData.type, // Use numeric type
                };
                if (channelData.topic) createOptions.topic = channelData.topic;
                if (channelData.bitrate) createOptions.bitrate = channelData.bitrate;
                if (channelData.userLimit) createOptions.userLimit = channelData.userLimit;
                if (channelData.rateLimitPerUser) createOptions.rateLimitPerUser = channelData.rateLimitPerUser;
                if (channelData.position !== undefined) createOptions.position = channelData.position;
                if (mappedParentId && parentCategory) {
                  // Use the already-fetched parent category object
                  createOptions.parent = parentCategory;
                  logger.debug(`Using verified parent category for ${channelData.name}: ${parentCategory.name}`);
                } else if (mappedParentId) {
                  // Fallback: try to use the ID directly
                  logger.warn(`Using parent ID directly: ${mappedParentId}`);
                  createOptions.parent = mappedParentId;
                }
                if (channelData.nsfw !== undefined) createOptions.nsfw = channelData.nsfw;
                
                logger.info(`Attempting channel creation with numeric type: "${channelData.name}"`);
                createdChannel = await targetGuild.channels.create(channelData.name, createOptions);
                
                if (createdChannel && createdChannel.id) {
                  logger.info(`Channel creation succeeded with numeric type! ID: ${createdChannel.id}`);
                } else {
                  throw new Error(`Channel created but has no ID`);
                }
              } catch (numericError: any) {
                // Last resort - minimal options
                try {
                  logger.info(`Attempting channel creation with minimal options: "${channelData.name}"`);
                  const minimalOptions: any = {
                    type: channelTypeString || channelData.type,
                  };
                  // Only use parent if we've verified it's a category
                  if (mappedParentId && parentCategory) {
                    minimalOptions.parent = parentCategory;
                  } else if (mappedParentId) {
                    // Try without parent if we can't verify it
                    logger.warn(`Skipping parent in minimal options because it's not verified as a category`);
                  }
                  
                  createdChannel = await targetGuild.channels.create(channelData.name, minimalOptions);
                  
                  if (createdChannel && createdChannel.id) {
                    logger.info(`Channel creation succeeded with minimal options! ID: ${createdChannel.id}`);
                  } else {
                    throw new Error(`All channel creation attempts failed. Last error: ${numericError?.message || numericError}`);
                  }
                } catch (minimalError: any) {
                  throw new Error(`All channel creation attempts failed. Errors: ${error?.message}, ${numericError?.message}, ${minimalError?.message}`);
                }
              }
            }
            
            if (!createdChannel || !createdChannel.id) {
              throw new Error(`Channel creation returned invalid result`);
            }
            
            logger.info(`Channel creation succeeded! ID: ${createdChannel.id}, Type: ${createdChannel.type}`);
          } catch (error: any) {
            logger.error(`FAILED to create channel ${channelData.name}:`);
            logger.error(`  Error message: ${error?.message || error}`);
            logger.error(`  Error code: ${error?.code || 'N/A'}`);
            logger.error(`  Error status: ${error?.status || 'N/A'}`);
            logger.error(`  Error name: ${error?.name || 'N/A'}`);
            if (error?.response) {
              logger.error(`  Response data:`, error.response);
            }
            if (error?.stack) {
              logger.error(`  Stack trace: ${error.stack}`);
            }
            logger.error(`  Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            // Don't throw - log and continue
          }
        }

        if (!createdChannel) {
          logger.error(`Channel creation failed completely for ${channelData.name} - skipping`);
          continue; // Skip this channel
        }

        const channelId = createdChannel?.id || createdChannel?.channel?.id || '';
        if (!channelId) {
          logger.error(`Channel creation returned no ID for ${channelData.name}`);
          logger.error(`Created channel object:`, JSON.stringify(createdChannel, null, 2));
          logger.error(`Skipping channel ${channelData.name}`);
          continue; // Skip this channel
        }
        
        channelMap.set(sourceChannel.id, channelId);
        logger.info(`✓ Successfully created channel: ${channelData.name} (${channelId})`);
        
        // Clone permission overwrites after channel is created
        try {
          // Fetch the created channel to get the full channel object
          const createdChannelObj = await client.channels.fetch(channelId);
          // Check if it's a guild channel (has guild property)
          if (createdChannelObj && 'guild' in createdChannelObj && createdChannelObj.guild) {
            await cloneChannelPermissions(client, sourceChannel, createdChannelObj, roleMap, targetGuildId);
            logger.info(`✓ Permission overwrites cloned for channel ${channelData.name}`);
          } else {
            logger.warn(`Could not fetch created channel ${channelId} or it's not a guild channel - skipping permission cloning`);
          }
        } catch (permError: any) {
          logger.warn(`Failed to clone permissions for channel ${channelData.name}: ${permError?.message || permError}`);
          // Continue even if permission cloning fails
        }

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased delay
      } catch (error: any) {
        logger.error(`CRITICAL: Failed to clone channel ${sourceChannel.name}:`);
        logger.error(`  Error: ${error?.message || error}`);
        logger.error(`  This channel will be skipped, but cloning will continue`);
        // Don't throw - continue with next channel
      }
    }

    logger.info(`Channel cloning complete. Mapped ${channelMap.size} channels`);
  } catch (error) {
    logger.error(`Error during channel cloning: ${error}`);
    throw error;
  }

  return channelMap;
}

