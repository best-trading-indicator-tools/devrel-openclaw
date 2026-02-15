# Deploy OpenClaw from This Repo on Railway

Deploy the OpenClaw repo directly on Railway (vs the one-click template). Use this when you want to deploy from a fork, run `main`, or customize the build.

## Quick setup

1. **Railway Dashboard** → New Project → Deploy from GitHub → select `openclaw/openclaw` (or your fork).

2. **Add a Volume**  
   Service → Volumes → New Volume → mount at `/data`.

3. **Variables** (Service → Variables):
   - `OPENCLAW_GATEWAY_TOKEN` — **required** (generate: `openssl rand -hex 32`). Required for healthchecks when gateway binds to lan.
   - `PORT` = `8080`
   - `OPENCLAW_GATEWAY_PORT` = `8080`
   - `OPENCLAW_STATE_DIR` = `/data/.openclaw`
   - `OPENCLAW_WORKSPACE_DIR` = `/data/workspace`
   - Model/channel keys: `MINIMAX_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.
   - `OPENCLAW_TELEGRAM_GROUPS_JSON` (optional) — merge Telegram groups without editing config, e.g. `{"-5297597380":{"requireMention":false}}`
   - `OPENCLAW_WHATSAPP_ALLOW_FROM` (optional) — comma-separated E.164 phone numbers to allow on WhatsApp, e.g. `+33768728401,+15551234567`
   - `OPENCLAW_DEFAULT_MODEL` (optional) — default model for agents, e.g. `minimax/MiniMax-M2.5` (requires `MINIMAX_API_KEY`)
   - `OPENCLAW_SOUL_TEMPLATE` (optional) — use a custom SOUL template on workspace creation, e.g. `adapty` for `SOUL.adapty.md` (DevRel agent)

4. **Public Networking**  
   Settings → Networking → Generate Domain. Ensure HTTP proxy uses port **8080**.

5. Open `https://<your-domain>/openclaw` for the Control UI.

## WhatsApp

WhatsApp uses WhatsApp Web (Baileys). To add it:

1. Add `channels.whatsapp` and `web` to your config (see [WhatsApp docs](/channels/whatsapp)).
2. Open Control UI → **Channels** → **WhatsApp** → **Show QR**.
3. On your phone: WhatsApp → Settings → Linked Devices → Link a Device → scan the QR.
4. Add your number to `allowFrom` (E.164, e.g. `["+33612345678"]`) so the bot accepts your DMs.

Minimal config:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+33612345678"],
    },
  },
  web: { enabled: true },
}
```

Replace `+33612345678` with your real number. Credentials persist in `/data/.openclaw/credentials/whatsapp/` on the volume.

## Config

Config is written to `/data/.openclaw/openclaw.json`. On first deploy the gateway starts with `--allow-unconfigured`; configure via:

- Env vars (e.g. `MINIMAX_API_KEY`, `TELEGRAM_BOT_TOKEN`) — some providers/channels auto-enable when set.
- Mount a pre-built `openclaw.json` into `/data/.openclaw/`.
- Use `openclaw configure` or `openclaw onboard` via Railway shell (if available).

## Workspace location

`/data/workspace` is the agent workspace directory. It lives inside the `/data` volume you mount, so it persists across deploys. On first run the gateway creates it with bootstrap files (AGENTS.md, SOUL.md, USER.md, etc.). To use the Adapty DevRel soul template, set `OPENCLAW_SOUL_TEMPLATE=adapty` **before** the first run so the workspace is seeded with `SOUL.adapty.md` content.

## One-click template (alternative)

For a browser-based setup wizard at `/setup`, use the [one-click Railway template](/install/railway) instead.
