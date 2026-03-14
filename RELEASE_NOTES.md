# 🚀 Discord Advance Cloner — v1.0.0 Release

**Release Date:** March 14, 2026  
**License:** MIT

---

## 🎉 Highlights

The **first stable release** of Discord Advance Cloner — a high-performance server cloner built on a unique **Rust + TypeScript hybrid architecture**. This release delivers the complete cloning pipeline with automatic fallback, comprehensive error handling, and full cross-platform support.

---

## ✨ What's New

### 🦀 Hybrid Rust + TypeScript Engine
- **Rust API client** powered by `twilight-http` with built-in retry via `tokio-retry`
- **TypeScript orchestrator** using `discord.js-selfbot-v13` for flexible selfbot operations
- **Automatic fallback**: if Rust isn't built, seamlessly runs in TypeScript-only mode
- **JSON-RPC IPC** between TypeScript and Rust child processes for high-throughput operations

### 🔄 Complete Cloning Pipeline
- **Roles** — Names, colors, permissions, hoist, mentionable, and position ordering
- **Channels** — Text, voice, stage, forum, announcement, and category channels
- **Permission Overwrites** — Per-channel role and user permission replication
- **Webhooks** — Full duplication with avatar support and caching for message replay
- **Messages** — Content, embeds, and attachments; bot messages replayed via webhooks
- **Threads** — Active and archived public/private threads
- **Emojis** — Static and animated emoji transfer with duplicate detection
- **Members** — Member data processing with role mapping

### 🛡 Smart Deletion Phase
Before cloning, the tool safely removes existing content from the target guild:
- Webhooks → Channels → Roles → Emojis (in dependency order)
- Non-destructive: skips `@everyone` role and managed roles
- Graceful error handling — continues even if individual deletions fail

### 🐳 Docker Support
- Multi-container `docker-compose.yml` with 3 services:
  - `rust-proxy` — Rust HTTP proxy
  - `rust-client` — Rust API client
  - `ts-orchestrator` — TypeScript orchestration layer
- Isolated networking via Docker bridge
- Volume-mounted logs directory
- All environment variables passed through from `.env`

### 🖥 Cross-Platform Scripts
- `build.ps1` / `build.sh` — Automated build for both Rust and TypeScript
- `run.ps1` / `run.sh` — Smart run scripts with auto-build and validation
- Platform detection for Rust binary path (`.exe` on Windows)

### 📝 Comprehensive Logging
- **Winston**-based structured logging (JSON format)
- Dual file outputs: `error.log` (errors only) + `combined.log` (all levels)
- Colorized console output in development mode
- Configurable log level via `LOG_LEVEL` environment variable

### ♻️ Resilient Error Handling
- Exponential backoff retry on both Rust and TypeScript layers
- Per-operation error isolation — one failure doesn't abort the full clone
- Multi-attempt channel creation with progressive option stripping
- 30-second timeout on Rust IPC requests with automatic cleanup

---

## 📦 Dependencies

### Rust
| Package | Version |
|---|---|
| `twilight-http` | 0.17 |
| `twilight-model` | 0.17 |
| `tokio` | 1.0 |
| `tokio-retry` | 0.3 |
| `serde` + `serde_json` | 1.0 |
| `anyhow` | 1.0 |
| `tracing` + `tracing-subscriber` | 0.1 / 0.3 |

### TypeScript
| Package | Version |
|---|---|
| `discord.js-selfbot-v13` | 3.7.1 |
| `winston` | 3.13.0 |
| `dotenv` | ^16.4.5 |
| `typescript` | ^5.3.3 |

---

## 🔧 System Requirements

| Component | Minimum |
|---|---|
| Node.js | 20+ |
| Rust | 1.75+ *(optional)* |
| Docker | Latest *(optional)* |
| OS | Windows 10+, Ubuntu 20.04+, macOS 12+ |

---

## 📋 Configuration Options

| Variable | Default | Required |
|---|---|---|
| `DISCORD_TOKEN` | — | ✅ |
| `SOURCE_GUILD_ID` | — | ✅ |
| `TARGET_GUILD_ID` | — | ✅ |
| `CLONE_GUILDS` | `true` | ❌ |
| `CLONE_CHANNELS` | `true` | ❌ |
| `CLONE_ROLES` | `true` | ❌ |
| `CLONE_EMOJIS` | `false` | ❌ |
| `CLONE_WEBHOOKS` | `true` | ❌ |
| `CLONE_MESSAGES` | `false` | ❌ |
| `CLONE_THREADS` | `false` | ❌ |
| `CLONE_MEMBERS` | `false` | ❌ |
| `MESSAGE_LIMIT` | `50` | ❌ |
| `PROXY_HOST` | `localhost` | ❌ |
| `PROXY_PORT` | `8080` | ❌ |
| `LOG_LEVEL` | `info` | ❌ |

---

## ⚠️ Known Limitations

- **Member cloning** processes member data but does not send invites (Discord API restriction)
- Selfbot usage violates Discord's Terms of Service — use at your own risk
- Animated emojis require Nitro-level server boosts on the target guild
- Very large servers may require adjusting rate limit delays
- Forum channel tags and media channels are not yet supported

---

## 📝 Full Changelog

This is the initial release — all features are new.

**Total source files:** 20  
**Rust lines:** ~359  
**TypeScript lines:** ~2,500+  
**Configuration & scripts:** ~270  

---

<p align="center">
  <b>⚡ Built with Rust performance and TypeScript flexibility ⚡</b>
</p>
