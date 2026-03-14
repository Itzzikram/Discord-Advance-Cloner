import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore - __dirname is available in CommonJS
declare const __dirname: string;

// Try to find .env in project root (parent directory of ts/)
// Also try current working directory as fallback
// __dirname in compiled code will be ts/dist/config, so go up 2 levels to get to project root
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.resolve(projectRoot, '.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');

// Try multiple locations
let loaded = dotenv.config({ path: envPath });
if (loaded.error) {
  loaded = dotenv.config({ path: cwdEnvPath });
}
if (loaded.error) {
  loaded = dotenv.config({ path: parentEnvPath });
}

// Log where we're looking for .env (for debugging)
if (process.env.DEBUG_CONFIG || loaded.error) {
  console.log(`Looking for .env at: ${envPath}`);
  console.log(`Also checking: ${cwdEnvPath}`);
  console.log(`Also checking: ${parentEnvPath}`);
  console.log(`Current working directory: ${process.cwd()}`);
  console.log(`__dirname: ${__dirname}`);
  if (loaded.error) {
    console.log(`Error loading .env: ${loaded.error.message}`);
  }
}

export interface Config {
  token: string;
  sourceGuildId: string;
  targetGuildId: string;
  proxyHost?: string;
  proxyPort?: number;
  logLevel?: string;
  cloneGuilds?: boolean;
  cloneChannels?: boolean;
  cloneRoles?: boolean;
  cloneMembers?: boolean;
  cloneMessages?: boolean;
  cloneEmojis?: boolean;
  cloneWebhooks?: boolean;
  cloneThreads?: boolean;
  messageLimit?: number;
}

export function loadConfig(): Config {
  const token = process.env.DISCORD_TOKEN;
  const sourceGuildId = process.env.SOURCE_GUILD_ID;
  const targetGuildId = process.env.TARGET_GUILD_ID;

  if (!token) {
    const projectRoot = path.resolve(__dirname, '../..');
    const envPath = path.resolve(projectRoot, '.env');
    const cwdEnvPath = path.resolve(process.cwd(), '.env');
    throw new Error(
      `DISCORD_TOKEN is required in .env file.\n` +
      `Please edit the .env file and set your Discord token.\n` +
      `Looking for .env at: ${envPath}\n` +
      `Also checked: ${cwdEnvPath}\n` +
      `Current directory: ${process.cwd()}`
    );
  }
  if (!sourceGuildId) {
    throw new Error('SOURCE_GUILD_ID is required in .env');
  }
  if (!targetGuildId) {
    throw new Error('TARGET_GUILD_ID is required in .env');
  }

  const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  };

  return {
    token,
    sourceGuildId,
    targetGuildId,
    proxyHost: process.env.PROXY_HOST,
    proxyPort: process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT, 10) : undefined,
    logLevel: process.env.LOG_LEVEL || 'info',
    cloneGuilds: parseBoolean(process.env.CLONE_GUILDS, true),
    cloneChannels: parseBoolean(process.env.CLONE_CHANNELS, true),
    cloneRoles: parseBoolean(process.env.CLONE_ROLES, true),
    cloneMembers: parseBoolean(process.env.CLONE_MEMBERS, false),
    cloneMessages: parseBoolean(process.env.CLONE_MESSAGES, false),
    cloneEmojis: parseBoolean(process.env.CLONE_EMOJIS, true),
    cloneWebhooks: parseBoolean(process.env.CLONE_WEBHOOKS, true),
    cloneThreads: parseBoolean(process.env.CLONE_THREADS, false),
    messageLimit: process.env.MESSAGE_LIMIT ? parseInt(process.env.MESSAGE_LIMIT, 10) : 50,
  };
}

