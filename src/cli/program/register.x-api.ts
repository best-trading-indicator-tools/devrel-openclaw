import type { Command } from "commander";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  generatePkce,
} from "../../../extensions/x-api/src/auth-oauth2.js";
import { isLoopbackHost } from "../../gateway/net.js";
import { defaultRuntime } from "../../runtime.js";

const REDIRECT_URI = "http://127.0.0.1:3456/callback";

function registerXApiCommands(program: Command) {
  const xapi = program.command("x-api").description("X (Twitter) API OAuth 2.0 login");
  xapi
    .command("login")
    .description("Run OAuth 2.0 PKCE flow to get access + refresh tokens")
    .option("--no-server", "Print auth URL only; paste redirect URL manually")
    .action(async (opts: { server?: boolean }) => {
      const clientId = process.env.X_CLIENT_ID?.trim() || process.env.X_CLIENT_SECRET_ID?.trim();
      const clientSecret = process.env.X_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        defaultRuntime.error(
          "Set X_CLIENT_ID (or X_CLIENT_SECRET_ID) and X_CLIENT_SECRET before running login.",
        );
        defaultRuntime.exit(1);
      }
      const { verifier, challenge } = generatePkce();
      const state = randomBytes(16).toString("hex");
      const authUrl = buildAuthUrl({
        clientId,
        redirectUri: REDIRECT_URI,
        state,
        challenge,
      });
      defaultRuntime.log("\n1. Add this callback URL in your X Developer Portal:");
      defaultRuntime.log(`   ${REDIRECT_URI}`);
      defaultRuntime.log("\n2. Open this URL in your browser:");
      defaultRuntime.log(`   ${authUrl}\n`);

      if (opts.server === false) {
        defaultRuntime.log("3. After authorizing, paste the full redirect URL here:");
        const readline = await import("node:readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const input = await new Promise<string>((resolve) => {
          rl.question("> ", resolve);
        });
        rl.close();
        const url = input.trim();
        const code = new URL(url).searchParams.get("code");
        const urlState = new URL(url).searchParams.get("state");
        if (!code || urlState !== state) {
          defaultRuntime.error("Invalid redirect URL (missing code or state mismatch).");
          defaultRuntime.exit(1);
        }
        const tokens = await exchangeCodeForTokens({
          clientId,
          clientSecret,
          code,
          redirectUri: REDIRECT_URI,
          codeVerifier: verifier,
        });
        defaultRuntime.log("\nAdd these to your environment (e.g. Railway Variables):");
        defaultRuntime.log(`X_OAUTH2_ACCESS_TOKEN=${tokens.accessToken}`);
        defaultRuntime.log(`X_OAUTH2_REFRESH_TOKEN=${tokens.refreshToken}`);
        return;
      }

      const redirectUrl = new URL(REDIRECT_URI);
      const port = redirectUrl.port ? Number.parseInt(redirectUrl.port, 10) : 3456;
      if (!isLoopbackHost(redirectUrl.hostname)) {
        defaultRuntime.error("Redirect URI must use loopback host.");
        defaultRuntime.exit(1);
      }

      const code = await new Promise<string>((resolve, reject) => {
        const server = createServer((req, res) => {
          const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);
          if (reqUrl.pathname !== "/callback") {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          const c = reqUrl.searchParams.get("code");
          const s = reqUrl.searchParams.get("state");
          if (!c || s !== state) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/html");
            res.end(
              "<html><body><h2>Error</h2><p>Missing code or state mismatch.</p></body></html>",
            );
            server.close();
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html");
          res.end(
            "<html><body><h2>Success</h2><p>You can close this window and return to the terminal.</p></body></html>",
          );
          server.close();
          resolve(c);
        });
        server.listen(port, "127.0.0.1", () => {
          defaultRuntime.log(`3. Waiting for callback on ${REDIRECT_URI} ...`);
        });
        server.on("error", reject);
      });

      const tokens = await exchangeCodeForTokens({
        clientId,
        clientSecret,
        code,
        redirectUri: REDIRECT_URI,
        codeVerifier: verifier,
      });
      defaultRuntime.log("\nAdd these to your environment (e.g. Railway Variables):");
      defaultRuntime.log(`X_OAUTH2_ACCESS_TOKEN=${tokens.accessToken}`);
      defaultRuntime.log(`X_OAUTH2_REFRESH_TOKEN=${tokens.refreshToken}`);
    });
}

export { registerXApiCommands };
