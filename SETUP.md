# Setup Guide

## Quick Setup

1. **Create and configure `.env` file**:
   ```powershell
   # The .env file has been created from .env.example
   # Now edit it with your Discord token and guild IDs
   notepad .env
   ```

2. **Required Configuration**:
   Edit the `.env` file and set:
   - `DISCORD_TOKEN` - Your Discord user account token (NOT a bot token)
   - `SOURCE_GUILD_ID` - The ID of the server you want to clone FROM
   - `TARGET_GUILD_ID` - The ID of the server you want to clone TO

3. **Optional Configuration**:
   - `CLONE_GUILDS` - Clone guild settings (default: true)
   - `CLONE_CHANNELS` - Clone channels (default: true)
   - `CLONE_ROLES` - Clone roles (default: true)
   - `CLONE_MEMBERS` - Clone members (default: false)
   - `CLONE_MESSAGES` - Clone messages (default: false)
   - `CLONE_EMOJIS` - Clone emojis (default: true)
   - `CLONE_WEBHOOKS` - Clone webhooks (default: true)
   - `CLONE_THREADS` - Clone threads (default: false)
   - `MESSAGE_LIMIT` - Number of messages to clone per channel (default: 50)

## How to Get Your Discord Token

⚠️ **WARNING**: Using selfbots violates Discord's Terms of Service. Use at your own risk.

1. Open Discord in your browser
2. Press `F12` to open Developer Tools
3. Go to the `Network` tab
4. Refresh the page (F5)
5. Look for a request to `api` or `gateway`
6. In the request headers, find `authorization`
7. Copy the token (it's a long string)

## How to Get Guild IDs

1. Enable Developer Mode in Discord:
   - Settings → Advanced → Developer Mode
2. Right-click on the server icon → Copy Server ID
3. Use this ID for `SOURCE_GUILD_ID` or `TARGET_GUILD_ID`

## Running the Application

**From project root:**
```powershell
cd ts; npm start
```

**Or use the run script:**
```powershell
.\run.ps1
```

## Troubleshooting

### Error: "DISCORD_TOKEN is required in .env"
- Make sure the `.env` file exists in the project root directory
- Check that `DISCORD_TOKEN` is set (not `your_discord_token_here`)
- Make sure there are no spaces around the `=` sign

### Error: "Cannot find module"
- Run `npm install` in the `ts` directory
- Make sure all dependencies are installed

### Error: "Invalid token"
- Make sure you're using a USER account token, not a bot token
- The token should start with a long alphanumeric string
- Make sure there are no extra spaces or quotes in the token

