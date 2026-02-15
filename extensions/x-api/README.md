# X API Extension

Agent tools for X (Twitter) API: fetch tweets, post tweets. Supports OAuth 2.0 (recommended) and OAuth 1.0a.

## Tools

- **x_fetch_tweets** – Fetch tweets from a user. Requires `X_BEARER_TOKEN`.
- **x_post_tweet** – Post a tweet. Requires OAuth 2.0 or OAuth 1.0a credentials.

## OAuth 2.0 (recommended)

1. In X Developer Portal → your App → User authentication settings, add callback URL: `http://127.0.0.1:3456/callback`
2. Set `X_CLIENT_ID` (or `X_CLIENT_SECRET_ID`) and `X_CLIENT_SECRET`
3. Run: `openclaw x-api login`
4. Add the printed `X_OAUTH2_ACCESS_TOKEN` and `X_OAUTH2_REFRESH_TOKEN` to your env

## OAuth 1.0a (legacy)

Set `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
