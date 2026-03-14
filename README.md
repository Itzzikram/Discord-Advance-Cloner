<p align="center">
  <img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">⚡ Discord Advance Cloner</h1>

<p align="center">
  <b>A high-performance Discord server cloner with a hybrid Rust + TypeScript architecture</b><br/>
  <i>Clone roles, channels, permissions, webhooks, messages, threads, emojis, and more — at blazing speed.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/rust-1.75%2B-orange?style=flat-square" alt="Rust 1.75+" />
  <img src="https://img.shields.io/badge/node-20%2B-green?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey?style=flat-square" alt="Platform" />
</p>

---

## 📖 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [How It Works](#-how-it-works)
- [Rate Limiting & Safety](#-rate-limiting--safety)
- [Logging](#-logging)
- [Troubleshooting](#-troubleshooting)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [License](#-license)
- [Disclaimer](#%EF%B8%8F-disclaimer)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎭 **Role Cloning** | Clones all roles with names, colors, permissions, hoist, mentionable status, and position ordering |
| 📁 **Channel Cloning** | Clones text, voice, stage, forum, announcement, and category channels with full hierarchy |
| 🔒 **Permission Cloning** | Replicates per-channel permission overwrites for both roles and users |
| 🪝 **Webhook Cloning** | Duplicates webhooks with name and avatar, caches them for message replay |
| 💬 **Message Cloning** | Clones messages with content, embeds, and attachments; bot messages replay via webhooks |
| 🧵 **Thread Cloning** | Clones active and archived threads (public & private) |
| 😀 **Emoji Cloning** | Transfers custom emojis (static & animated) with duplicate detection |
| 👥 **Member Processing** | Processes member data and role mappings (member invites require manual action) |
| 🦀 **Hybrid Architecture** | Rust for high-performance API calls via `twilight-rs`; TypeScript for flexible orchestration |
| 🔄 **Automatic Fallback** | If Rust components aren't built, seamlessly falls back to TypeScript-only mode |
| ♻️ **Retry Logic** | Exponential backoff with jitter on both Rust and TypeScript layers |
| 🐳 **Docker Support** | Full `docker-compose` multi-container setup for containerized deployment |
| 🖥️ **Cross-Platform** | Build & run scripts for PowerShell (Windows) and Bash (Linux/macOS) |

---

## 🏗 Architecture

The project uses a **hybrid architecture** that combines the performance of Rust with the flexibility of TypeScript:

```
discord-advance-cloner/
├── rust/                         # 🦀 Rust: High-Performance API Client
│   ├── Cargo.toml                #    twilight-http 0.17, tokio-retry 0.3
│   ├── src/
│   │   ├── lib.rs                #    Library entry point (exports CloneClient)
│   │   ├── api.rs                #    CloneClient: roles, channels, webhooks, messages, threads
│   │   └── main.rs               #    Stdin/stdout JSON-RPC server for IPC
│   └── Dockerfile                #    Multi-stage Rust build
│
├── ts/                           # 🟦 TypeScript: Orchestration & Posting
│   ├── src/
│   │   ├── index.ts              #    Entry point - selfbot login, lifecycle management
│   │   ├── config/
│   │   │   └── index.ts          #    .env loading with multi-path fallback
│   │   ├── services/
│   │   │   ├── cloner.ts         #    Orchestrator: deletion phase → cloning phase
│   │   │   ├── roles.ts          #    Role cloning with Rust/TS dual-path
│   │   │   ├── channels.ts       #    Channel + category + permission cloning
│   │   │   ├── webhooks.ts       #    Webhook cloning & caching
│   │   │   ├── messages.ts       #    Message cloning (selfbot + webhook replay)
│   │   │   ├── threads.ts        #    Thread cloning (public + private)
│   │   │   ├── emojis.ts         #    Emoji transfer with deduplication
│   │   │   └── members.ts        #    Member data processing
│   │   └── utils/
│   │       ├── client.ts         #    Rust child process manager (spawn/IPC/stop)
│   │       ├── proxy.ts          #    Rust proxy process manager
│   │       ├── retry.ts          #    Generic retry with exponential backoff
│   │       └── logger.ts         #    Winston logger (file + console)
│   ├── package.json              #    discord.js-selfbot-v13 3.7.1, winston 3.13.0
│   ├── tsconfig.json
│   └── Dockerfile                #    Node 20 slim build
│
├── docker-compose.yml            #    3-service orchestration (proxy, client, orchestrator)
├── build.ps1 / build.sh          #    Cross-platform build scripts
├── run.ps1 / run.sh              #    Cross-platform run scripts
├── .env.example                  #    Environment variable template
└── SETUP.md                      #    Detailed setup guide
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TypeScript Orchestrator                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Cloner  │→ │  Roles   │→ │ Channels │→ │ Webhooks │→ ...      │
│  └──────────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│                     │             │              │                   │
│                     ▼             ▼              ▼                   │
│              ┌──────────────────────────────────────┐               │
│              │    Rust Client Available?             │               │
│              │    YES → JSON-RPC to Rust process     │               │
│              │    NO  → discord.js-selfbot fallback  │               │
│              └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Discord API    │
                    └──────────────────┘
```

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 20+ | Required for TypeScript orchestration |
| **Rust** | 1.75+ | *Optional* — only needed for Rust acceleration |
| **Docker** | Latest | *Optional* — for containerized deployment |
| **Discord Token** | — | User account token (selfbot) |

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/discord-advance-cloner.git
cd discord-advance-cloner
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your **required** values:

```env
DISCORD_TOKEN=your_discord_user_token
SOURCE_GUILD_ID=123456789012345678
TARGET_GUILD_ID=987654321098765432
```

### 3. Build & Run

**Windows (PowerShell):**
```powershell
.\build.ps1     # Builds Rust + TypeScript
.\run.ps1       # Starts the cloner
```

**Linux / macOS (Bash):**
```bash
chmod +x build.sh run.sh
./build.sh
./run.sh
```

**TypeScript-Only (No Rust Required):**
```bash
cd ts
npm install
npm run build
npm start
```

**Docker:**
```bash
docker-compose up --build
```

---

## ⚙ Configuration

### Required Variables

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your Discord **user account** token |
| `SOURCE_GUILD_ID` | Server ID to clone **from** |
| `TARGET_GUILD_ID` | Server ID to clone **to** |

### Clone Feature Toggles

| Variable | Default | Description |
|---|---|---|
| `CLONE_GUILDS` | `true` | Enable guild-level cloning |
| `CLONE_CHANNELS` | `true` | Clone channels and categories |
| `CLONE_ROLES` | `true` | Clone roles with permissions |
| `CLONE_EMOJIS` | `true`* | Clone custom emojis |
| `CLONE_WEBHOOKS` | `true` | Clone webhooks |
| `CLONE_MESSAGES` | `false` | Clone messages (rate-limited) |
| `CLONE_THREADS` | `false` | Clone threads |
| `CLONE_MEMBERS` | `false` | Process member data |
| `MESSAGE_LIMIT` | `50` | Messages per channel (when enabled) |

> \* `CLONE_EMOJIS` defaults to `true` in docker-compose but `false` in `.env.example`

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `PROXY_HOST` | `localhost` | Rust proxy host |
| `PROXY_PORT` | `8080` | Rust proxy port |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

---

## 🎯 Usage

### Development Mode (Hot Reload)

```bash
cd ts && npm run dev
```

### Production Mode

```bash
cd ts && npm start
```

### Docker Compose

```bash
# Start all services
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f ts-orchestrator
```

---

## 🔧 How It Works

### Cloning Process

The cloner operates in two phases:

#### Phase 1 — Deletion
Removes existing content from the **target** guild to prepare for a clean clone:

1. **Webhooks** → Deleted first (they're bound to channels)
2. **Channels** → All channels removed
3. **Roles** → Non-managed, non-`@everyone` roles deleted
4. **Emojis** → Existing custom emojis cleared

#### Phase 2 — Cloning
Recreates everything from the **source** guild into the target:

1. **Roles** → Cloned with permissions, colors, position ordering
2. **Emojis** → Transferred with animated emoji support
3. **Categories** → Created first to establish channel hierarchy
4. **Channels** → Text/voice/stage/forum/announcement channels with permission overwrites
5. **Webhooks** → Recreated per channel, cached for message replay
6. **Threads** → Active and archived threads cloned
7. **Messages** → Content, embeds, and attachments (bot messages via webhooks)
8. **Members** → Member data processed with role mapping

### Rust ↔ TypeScript IPC

The Rust client runs as a child process, communicating via **stdin/stdout JSON-RPC**:

```json
// Request (TS → Rust)
{ "id": 1, "method": "create_role", "params": { "guild_id": "...", "role": { ... } } }

// Response (Rust → TS)
{ "success": true, "data": { "requestId": 1, ... } }
```

If the Rust process is unavailable or fails, the TypeScript layer automatically falls back to `discord.js-selfbot-v13` methods.

---

## 🛡 Rate Limiting & Safety

Built-in delays between API calls to respect Discord rate limits:

| Operation | Delay |
|---|---|
| Role creation / deletion | 500ms |
| Channel creation | 1000ms |
| Category creation | 1000ms |
| Webhook creation | 500ms |
| Emoji creation | 500ms |
| Message posting | 1000ms |
| Member processing | 200ms |

Both layers implement **retry with exponential backoff**:
- **Rust**: `tokio-retry` with 100ms base, 5s max, 3 attempts
- **TypeScript**: Custom retry with configurable max attempts, base delay, and backoff multiplier

---

## 📝 Logging

Winston-based structured logging with multiple outputs:

| Output | Level | Format |
|---|---|---|
| `error.log` | error | JSON with timestamp |
| `combined.log` | all | JSON with timestamp |
| Console | all | Colored, human-readable (dev only) |

Set `LOG_LEVEL=debug` in `.env` for verbose logging.

---

## 🔍 Troubleshooting

| Problem | Solution |
|---|---|
| **"DISCORD_TOKEN is required"** | Ensure `.env` exists in the project root with a valid user token |
| **"Invalid token"** | Use a **user** account token, not a bot token |
| **Rate limited** | Increase delays or reduce `MESSAGE_LIMIT` |
| **Permission errors** | Ensure the account has **Administrator** or **Manage Channels/Roles** in both guilds |
| **Rust client not found** | Build Rust: `cd rust && cargo build --release` — or just use TS-only mode |
| **Category creation fails** | Check target guild channel limits; older guilds may have API quirks |
| **"Cannot find module"** | Run `npm install` in the `ts/` directory |

---

## 📁 Project Structure

```
File                         Lines    Purpose
─────────────────────────────────────────────────────────────
rust/src/api.rs               252    CloneClient with 9 API methods + retry
rust/src/main.rs              102    JSON-RPC stdin/stdout server
rust/src/lib.rs                 5    Module exports
ts/src/index.ts               101    Entry point, lifecycle, signal handling
ts/src/config/index.ts        103    Multi-path .env loader + config interface
ts/src/services/cloner.ts     254    Main orchestrator (delete + clone phases)
ts/src/services/channels.ts   817    Channel, category, and permission cloning
ts/src/services/roles.ts      100    Role cloning with Rust/TS dual-path
ts/src/services/webhooks.ts    85    Webhook cloning + cache
ts/src/services/messages.ts    82    Message + embed + attachment cloning
ts/src/services/threads.ts     90    Public & private thread cloning
ts/src/services/emojis.ts      85    Emoji transfer with deduplication
ts/src/services/members.ts     68    Member data processing
ts/src/utils/client.ts        151    Rust child process IPC manager
ts/src/utils/proxy.ts          69    Rust proxy process manager
ts/src/utils/logger.ts         40    Winston logger configuration
ts/src/utils/retry.ts          39    Generic exponential backoff retry
```

---

## 🛠 Tech Stack

### Rust Layer
| Dependency | Version | Purpose |
|---|---|---|
| `twilight-http` | 0.17 | Discord HTTP API client |
| `twilight-model` | 0.17 | Discord data model types |
| `tokio` | 1.0 | Async runtime |
| `tokio-retry` | 0.3 | Retry with exponential backoff |
| `serde` / `serde_json` | 1.0 | JSON serialization |
| `anyhow` | 1.0 | Error handling |
| `tracing` | 0.1 | Structured logging |

### TypeScript Layer
| Dependency | Version | Purpose |
|---|---|---|
| `discord.js-selfbot-v13` | 3.7.1 | Discord selfbot client |
| `winston` | 3.13.0 | Structured logging |
| `dotenv` | ^16.4.5 | Environment variable loading |
| `typescript` | ^5.3.3 | Type-safe development |

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

> **This tool is for educational and research purposes only.**
>
> Using selfbots violates [Discord's Terms of Service](https://discord.com/terms). Usage may result in account termination.
> The authors assume no liability for any consequences of using this software. **Use at your own risk.**
