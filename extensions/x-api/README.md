# X API Extension

Agent tools for X (Twitter) API: fetch tweets, post tweets. Supports OAuth 2.0 (recommended) and OAuth 1.0a.

## Tools

- **x_fetch_tweets** – Fetch tweets from a user. Uses OAuth 2.0 access token (preferred) or `X_BEARER_TOKEN`.
- **x_post_tweet** – Post a tweet. Requires OAuth 2.0 or OAuth 1.0a credentials.

## OAuth 2.0 (recommended)

1. **Add callback URL in X Developer Portal** (required before login):
   - Go to [developer.x.com](https://developer.x.com) → Projects & Apps → your App
   - Open **User authentication settings** → **Callback URLs**
   - Add exactly: `http://127.0.0.1:3456/callback`
   - Save. Without this, X shows "Something went wrong".
2. Set `X_CLIENT_ID` (or `X_CLIENT_SECRET_ID`) and `X_CLIENT_SECRET`
3. Run: `openclaw x-api login` (or `railway run -- node openclaw.mjs x-api login` to use Railway vars)
4. Add the printed `X_OAUTH2_ACCESS_TOKEN` and `X_OAUTH2_REFRESH_TOKEN` to your env (e.g. `railway variables set X_OAUTH2_ACCESS_TOKEN="..." X_OAUTH2_REFRESH_TOKEN="..."`)

## OAuth 1.0a (legacy)

Set `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
