/**
 * X (Twitter) OAuth 2.0 PKCE flow for user-context API access (e.g. posting tweets).
 * See: https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code
 */
import { createHash, randomBytes } from "node:crypto";

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const qs = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: X_SCOPES.join(" "),
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTH_URL}?${qs.toString()}`;
}

export async function exchangeCodeForTokens(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const auth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X OAuth2 token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const access = data.access_token?.trim();
  const refresh = data.refresh_token?.trim();
  if (!access || !refresh) {
    throw new Error("X OAuth2 response missing access_token or refresh_token");
  }
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresIn: data.expires_in ?? 7200,
  };
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const auth = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString("base64");
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X OAuth2 token refresh failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const access = data.access_token?.trim();
  if (!access) {
    throw new Error("X OAuth2 refresh returned no access_token");
  }
  return {
    accessToken: access,
    refreshToken: data.refresh_token?.trim() ?? params.refreshToken,
    expiresIn: data.expires_in ?? 7200,
  };
}
