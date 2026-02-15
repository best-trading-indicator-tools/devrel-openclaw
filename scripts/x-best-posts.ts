#!/usr/bin/env node
/**
 * Fetch top X (Twitter) posts by engagement and send the list to Telegram.
 *
 * Usage:
 *   pnpm x:best-posts
 *   pnpm x:best-posts -- --username david_attisaas --limit 10 --to -1003771762928
 *
 * Env: X_BEARER_TOKEN, TELEGRAM_BOT_TOKEN
 * Optional: TELEGRAM_TARGET_CHAT_ID (default: -1003771762928)
 *
 * Cron (e.g. weekly): 0 9 * * 0 cd /path/to/openclaw && pnpm x:best-posts
 *
 * X API: Bearer token must have tweet.read + users.read scopes (Developer Portal).
 */

import { loadDotEnv } from "../src/infra/dotenv.js";
import { loadConfig } from "../src/config/config.js";
import { sendMessageTelegram } from "../src/telegram/send.js";
import { resolveTelegramToken } from "../src/telegram/token.js";

loadDotEnv({ quiet: true });

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
  };
};

function parseArg(flag: string, defaultValue?: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return defaultValue ?? "";
  return process.argv[idx + 1];
}

function parseNum(flag: string, defaultVal: number): number {
  const raw = parseArg(flag);
  if (!raw) return defaultVal;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
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
    (m.quote_count ?? 0) * 2
  );
}

function formatTweetForList(t: XTweet, rank: number, score: number): string {
  const m = t.public_metrics ?? {};
  const likes = m.like_count ?? 0;
  const rts = m.retweet_count ?? 0;
  const replies = m.reply_count ?? 0;
  const text = t.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 200);
  const ellipsis = t.text.length > 200 ? "…" : "";
  const url = `https://x.com/i/status/${t.id}`;
  return `${rank}. <a href="${url}">${text}${ellipsis}</a>\n   ❤️ ${likes} · 🔁 ${rts} · 💬 ${replies} (score: ${Math.round(score)})`;
}

async function main(): Promise<void> {
  const username = parseArg("--username", "david_attisaas") || "david_attisaas";
  const limit = parseNum("--limit", 10);
  const toArg = parseArg("--to");

  let bearerToken = process.env.X_BEARER_TOKEN?.trim();
  if (bearerToken?.includes("%")) {
    try {
      bearerToken = decodeURIComponent(bearerToken);
    } catch {
      // keep as-is if decode fails
    }
  }
  if (!bearerToken) {
    console.error("Missing X_BEARER_TOKEN in environment.");
    process.exit(1);
  }

  const cfg = loadConfig();
  const { token } = resolveTelegramToken(cfg);
  if (!token) {
    console.error("Missing TELEGRAM_BOT_TOKEN (or channels.telegram.botToken in config).");
    process.exit(1);
  }

  const targetChatId =
    toArg || process.env.TELEGRAM_TARGET_CHAT_ID?.trim() || "-1003771762928";

  console.error(`Fetching X user @${username}...`);
  const user = await fetchXUser(username, bearerToken);
  if (!user) {
    console.error(`User @${username} not found.`);
    process.exit(1);
  }

  console.error(`Fetching tweets for ${user.id}...`);
  const tweets = await fetchXTweets(user.id, bearerToken, 200);
  if (tweets.length === 0) {
    console.error("No tweets found.");
    process.exit(0);
  }

  const ranked = tweets
    .map((t) => ({ tweet: t, score: engagementScore(t) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const lines = [
    `🐦 <b>Top ${ranked.length} posts from @${username}</b> (by engagement)\n`,
    ...ranked.map((r, i) => formatTweetForList(r.tweet, i + 1, r.score)),
  ];
  const message = lines.join("\n\n");

  console.error(`Sending to Telegram ${targetChatId}...`);
  await sendMessageTelegram(targetChatId, message, {
    token,
    textMode: "html",
  });
  console.error("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
