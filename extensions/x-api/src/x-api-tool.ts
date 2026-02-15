import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult } from "../../../src/agents/tools/common.js";
import { refreshAccessToken } from "./auth-oauth2.js";

const X_API_BASE = "https://api.twitter.com/2";

type XUser = { id: string; username: string; name?: string };
type XTweet = {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
};

function getBearerToken(): string | null {
  let token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) return null;
  if (token.includes("%")) {
    try {
      token = decodeURIComponent(token);
    } catch {
      // keep as-is
    }
  }
  return token || null;
}

function getOAuth2Credentials(): {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
} | null {
  const clientId = process.env.X_CLIENT_ID?.trim() || process.env.X_CLIENT_SECRET_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const accessToken = process.env.X_OAUTH2_ACCESS_TOKEN?.trim();
  const refreshToken = process.env.X_OAUTH2_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !accessToken || !refreshToken) return null;
  return { clientId, clientSecret, accessToken, refreshToken };
}

function getOAuth1Credentials(): {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
} | null {
  const apiKey = process.env.X_API_KEY?.trim();
  const apiSecret = process.env.X_API_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim();
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

async function fetchXUser(username: string, bearerToken: string): Promise<XUser | null> {
  const res = await fetch(`${X_API_BASE}/users/by/username/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API user lookup failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { data?: XUser };
  return data.data ?? null;
}

async function fetchXTweets(
  userId: string,
  bearerToken: string,
  maxResults: number = 100,
): Promise<XTweet[]> {
  const all: XTweet[] = [];
  let nextToken: string | undefined;
  do {
    const params = new URLSearchParams({
      max_results: String(Math.min(100, maxResults - all.length)),
      "tweet.fields": "created_at,public_metrics",
      exclude: "retweets,replies",
    });
    if (nextToken) params.set("pagination_token", nextToken);
    const url = `${X_API_BASE}/users/${userId}/tweets?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API tweets fetch failed: ${res.status} ${body}`);
    }
    const data = (await res.json()) as { data?: XTweet[]; meta?: { next_token?: string } };
    const tweets = data.data ?? [];
    all.push(...tweets);
    nextToken = data.meta?.next_token;
    if (all.length >= maxResults || !nextToken) break;
  } while (nextToken);
  return all;
}

function engagementScore(t: XTweet): number {
  const m = t.public_metrics ?? {};
  return (
    (m.like_count ?? 0) +
    (m.retweet_count ?? 0) * 2 +
    (m.reply_count ?? 0) * 1.5 +
    (m.quote_count ?? 0) * 2 +
    (m.bookmark_count ?? 0) * 3 +
    (m.impression_count ?? 0) * 0.01
  );
}

// OAuth 1.0a signing for POST (X API v2 write)
function oauth1Sign(
  method: string,
  url: string,
  params: Record<string, string>,
  creds: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string },
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
    ...params,
  };
  const sorted = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join("&");
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sorted)}`;
  const key = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  oauthParams.oauth_signature = sig;
  return Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(", ");
}

async function doPostTweetOAuth2(
  text: string,
  accessToken: string,
): Promise<{ id: string; text: string }> {
  const url = `${X_API_BASE}/tweets`;
  const body = JSON.stringify({ text: text.slice(0, 280) });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`X API post failed: ${res.status} ${errBody}`);
  }
  const data = (await res.json()) as { data?: { id: string; text: string } };
  if (!data.data) throw new Error("X API post: no data in response");
  return data.data;
}

async function doPostTweetOAuth1(
  text: string,
  creds: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string },
): Promise<{ id: string; text: string }> {
  const url = `${X_API_BASE}/tweets`;
  const body = JSON.stringify({ text: text.slice(0, 280) });
  const auth = oauth1Sign("POST", url, {}, creds);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `OAuth ${auth}`,
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`X API post failed: ${res.status} ${errBody}`);
  }
  const data = (await res.json()) as { data?: { id: string; text: string } };
  if (!data.data) throw new Error("X API post: no data in response");
  return data.data;
}

const FetchTweetsSchema = Type.Object({
  username: Type.String({ description: "X username (without @)" }),
  limit: Type.Optional(
    Type.Number({ description: "Max tweets to return (default 10, max 100)", default: 10 }),
  ),
  fetchAll: Type.Optional(
    Type.Boolean({
      description:
        "Fetch all available tweets (up to 3200) before sorting. Slower but finds best tweets across full history. Default false.",
      default: false,
    }),
  ),
  sortByEngagement: Type.Optional(
    Type.Boolean({ description: "Sort by engagement score (default true)", default: true }),
  ),
});

const PostTweetSchema = Type.Object({
  text: Type.String({ description: "Tweet text (max 280 chars)" }),
});

export function createXApiTools(): AnyAgentTool[] {
  const fetchTweets: AnyAgentTool = {
    label: "X Fetch Tweets",
    name: "x_fetch_tweets",
    description:
      "Fetch tweets from an X (Twitter) user. Set fetchAll=true to scan up to 3200 tweets and find the best by engagement. Returns likes, retweets, replies, quotes, bookmarks, and impressions.",
    parameters: FetchTweetsSchema,
    async execute(_toolCallId, params) {
      let bearer = getBearerToken();
      const oauth2 = getOAuth2Credentials();
      if (oauth2) {
        bearer = oauth2.accessToken;
      }
      if (!bearer) {
        return jsonResult({
          error:
            "Set X_OAUTH2_ACCESS_TOKEN (run `openclaw x-api login`) or X_BEARER_TOKEN for app-only read.",
        });
      }
      const username = String(params?.username ?? "")
        .trim()
        .replace(/^@/, "");
      if (!username) {
        return jsonResult({ error: "username is required" });
      }
      const limit = Math.min(100, Math.max(1, Number(params?.limit) || 10));
      const fetchAll = params?.fetchAll === true;
      const fetchCount = fetchAll ? 3200 : limit * 2;
      const sortByEngagement = params?.sortByEngagement !== false;
      const tryFetch = async (token: string): Promise<{ user: XUser; tweets: XTweet[] } | null> => {
        const user = await fetchXUser(username, token);
        if (!user) return null;
        const tweets = await fetchXTweets(user.id, token, fetchCount);
        return { user, tweets };
      };
      try {
        let out: { user: XUser; tweets: XTweet[] } | null;
        try {
          out = await tryFetch(bearer);
        } catch (err) {
          if (oauth2 && (String(err).includes("401") || String(err).includes("403"))) {
            const refreshed = await refreshAccessToken({
              clientId: oauth2.clientId,
              clientSecret: oauth2.clientSecret,
              refreshToken: oauth2.refreshToken,
            });
            out = await tryFetch(refreshed.accessToken);
          } else {
            throw err;
          }
        }
        if (!out) return jsonResult({ error: `User @${username} not found` });
        const { user, tweets } = out;
        if (tweets.length === 0) return jsonResult({ error: `No tweets found for @${username}` });
        let result = tweets;
        if (sortByEngagement && tweets.length > 0) {
          result = tweets
            .map((t) => ({ tweet: t, score: engagementScore(t) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((r) => r.tweet);
        } else {
          result = tweets.slice(0, limit);
        }
        return jsonResult({
          username: user.username,
          tweets: result.map((t) => ({
            id: t.id,
            text: t.text,
            created_at: t.created_at,
            metrics: t.public_metrics,
            url: `https://x.com/i/status/${t.id}`,
          })),
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  const postTweet: AnyAgentTool = {
    label: "X Post Tweet",
    name: "x_post_tweet",
    description:
      "Post a tweet to X (Twitter). Uses OAuth 2.0 (X_CLIENT_ID, X_CLIENT_SECRET, X_OAUTH2_ACCESS_TOKEN, X_OAUTH2_REFRESH_TOKEN) or OAuth 1.0a (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET).",
    parameters: PostTweetSchema,
    async execute(_toolCallId, params) {
      const text = String(params?.text ?? "").trim();
      if (!text) {
        return jsonResult({ error: "text is required" });
      }
      const oauth2 = getOAuth2Credentials();
      const oauth1 = getOAuth1Credentials();
      if (!oauth2 && !oauth1) {
        return jsonResult({
          error:
            "No OAuth credentials. For OAuth 2.0: set X_CLIENT_ID, X_CLIENT_SECRET, X_OAUTH2_ACCESS_TOKEN, X_OAUTH2_REFRESH_TOKEN (run `openclaw x-api login`). For OAuth 1.0a: set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.",
        });
      }
      try {
        let posted: { id: string; text: string };
        if (oauth2) {
          let accessToken = oauth2.accessToken;
          try {
            posted = await doPostTweetOAuth2(text, accessToken);
          } catch (err) {
            if (String(err).includes("401") || String(err).includes("403")) {
              const refreshed = await refreshAccessToken({
                clientId: oauth2.clientId,
                clientSecret: oauth2.clientSecret,
                refreshToken: oauth2.refreshToken,
              });
              accessToken = refreshed.accessToken;
              posted = await doPostTweetOAuth2(text, accessToken);
            } else {
              throw err;
            }
          }
        } else {
          posted = await doPostTweetOAuth1(text, oauth1!);
        }
        return jsonResult({
          success: true,
          id: posted.id,
          text: posted.text,
          url: `https://x.com/i/status/${posted.id}`,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  return [fetchTweets, postTweet];
}
