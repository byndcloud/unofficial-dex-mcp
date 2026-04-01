import { Router, urlencoded, json } from "express";
import {
  registerClient,
  getClient,
  createAuthCode,
  consumeAuthCode,
  createAccessToken,
  verifyCodeChallenge,
} from "./store.js";
import { authorizePage } from "./pages.js";

export function getBaseUrl(): string {
  // Cloud Run sets this, or use env var
  const url = process.env.PUBLIC_URL || process.env.BASE_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

export function createOAuthRouter(): Router {
  const router = Router();
  router.use(urlencoded({ extended: false }));
  router.use(json());

  // --- OAuth 2.0 Protected Resource Metadata (RFC 9728) ---
  router.get("/.well-known/oauth-protected-resource", (_req, res) => {
    const baseUrl = getBaseUrl();
    res.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    });
  });

  // --- OAuth 2.0 Authorization Server Metadata (RFC 8414) ---
  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    const baseUrl = getBaseUrl();
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp"],
    });
  });

  // --- Dynamic Client Registration (RFC 7591) ---
  router.post("/register", (req, res) => {
    const { redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method } =
      req.body;

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris is required" });
      return;
    }

    const client = registerClient({
      redirect_uris,
      client_name,
      grant_types,
      response_types,
      token_endpoint_auth_method,
    });

    res.status(201).json({
      client_id: client.client_id,
      client_id_issued_at: Math.floor(client.created_at / 1000),
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
    });
  });

  // --- Authorization Endpoint (GET: show form, POST: process) ---
  router.get("/authorize", (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } =
      req.query as Record<string, string>;

    if (response_type !== "code") {
      res.status(400).send("Unsupported response_type. Only 'code' is supported.");
      return;
    }

    const client = getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client_id.");
      return;
    }

    if (!client.redirect_uris.includes(redirect_uri)) {
      res.status(400).send("Invalid redirect_uri.");
      return;
    }

    if (!code_challenge) {
      res.status(400).send("PKCE code_challenge is required.");
      return;
    }

    res.type("html").send(
      authorizePage({
        client_id,
        redirect_uri,
        state: state || "",
        code_challenge,
        code_challenge_method: code_challenge_method || "S256",
        client_name: client.client_name,
      })
    );
  });

  router.post("/authorize", (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, dex_api_key } =
      req.body;

    const client = getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client_id.");
      return;
    }

    if (!redirect_uri || typeof redirect_uri !== "string") {
      res.status(400).send("redirect_uri is required.");
      return;
    }
    if (!URL.canParse(redirect_uri)) {
      res.status(400).send("Invalid redirect_uri.");
      return;
    }
    if (!client.redirect_uris.includes(redirect_uri)) {
      res.status(400).send("Invalid redirect_uri.");
      return;
    }

    if (!dex_api_key || typeof dex_api_key !== "string" || dex_api_key.trim().length === 0) {
      res.type("html").send(
        authorizePage({
          client_id,
          redirect_uri,
          state: state || "",
          code_challenge,
          code_challenge_method: code_challenge_method || "S256",
          client_name: client.client_name,
          error: "Please provide your Dex API key.",
        })
      );
      return;
    }

    const code = createAuthCode({
      client_id,
      redirect_uri,
      dex_api_key: dex_api_key.trim(),
      code_challenge,
      code_challenge_method: code_challenge_method || "S256",
    });

    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  // --- Token Endpoint ---
  router.post("/token", (req, res) => {
    const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

    if (grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    const authCode = consumeAuthCode(code);
    if (!authCode) {
      res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" });
      return;
    }

    if (authCode.client_id !== client_id) {
      res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
      return;
    }

    if (authCode.redirect_uri !== redirect_uri) {
      res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
      return;
    }

    if (!code_verifier || !verifyCodeChallenge(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      return;
    }

    const { access_token, expires_in } = createAccessToken({
      client_id: authCode.client_id,
      dex_api_key: authCode.dex_api_key,
    });

    res.json({
      access_token,
      token_type: "Bearer",
      expires_in,
    });
  });

  return router;
}
