# Deploy OpenClaw from This Repo on Railway

Deploy the OpenClaw repo directly on Railway (vs the one-click template). Use this when you want to deploy from a fork, run `main`, or customize the build.

## Quick setup

1. **Railway Dashboard** → New Project → Deploy from GitHub → select `openclaw/openclaw` (or your fork).

2. **Add a Volume**  
   Service → Volumes → New Volume → mount at `/data`.

3. **Variables** (Service → Variables):
   - `OPENCLAW_GATEWAY_TOKEN` — **required** (generate: `openssl rand -hex 32`)
   - `PORT` = `8080`
   - `OPENCLAW_GATEWAY_PORT` = `8080`
   - `OPENCLAW_STATE_DIR` = `/data/.openclaw`
   - `OPENCLAW_WORKSPACE_DIR` = `/data/workspace`
   - Model/channel keys: `MINIMAX_API_KEY`, `TELEGRAM_BOT_TOKEN`, etc.
   - `OPENCLAW_TELEGRAM_GROUPS_JSON` (optional) — merge Telegram groups without editing config, e.g. `{"-5297597380":{"requireMention":false}}`
   - `OPENCLAW_DEFAULT_MODEL` (optional) — default model for agents, e.g. `minimax/MiniMax-M2.5` (requires `MINIMAX_API_KEY`)

4. **Public Networking**  
   Settings → Networking → Generate Domain. Ensure HTTP proxy uses port **8080**.

5. Open `https://<your-domain>/openclaw` for the Control UI.

## Config

Config is written to `/data/.openclaw/openclaw.json`. On first deploy the gateway starts with `--allow-unconfigured`; configure via:

- Env vars (e.g. `MINIMAX_API_KEY`, `TELEGRAM_BOT_TOKEN`) — some providers/channels auto-enable when set.
- Mount a pre-built `openclaw.json` into `/data/.openclaw/`.
- Use `openclaw configure` or `openclaw onboard` via Railway shell (if available).

## One-click template (alternative)

For a browser-based setup wizard at `/setup`, use the [one-click Railway template](/install/railway) instead.
