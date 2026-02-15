# X API Extension

Agent tools for X (Twitter) API: fetch tweets, post tweets. Credentials from environment variables.

## Tools

- **x_fetch_tweets** – Fetch tweets from a user (username, limit, sortByEngagement). Requires `X_BEARER_TOKEN`.
- **x_post_tweet** – Post a tweet. Requires `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.

## Setup

1. Allow the plugin: `plugins.allow: ["x-api"]`
2. Allow the tools for your agent: `tools.allow: ["x_fetch_tweets", "x_post_tweet"]` or `tools.alsoAllow: ["x-api"]`
3. Set env vars (read: `X_BEARER_TOKEN`; write: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`)
