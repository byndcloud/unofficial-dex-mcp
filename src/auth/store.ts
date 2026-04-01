import crypto from "node:crypto";

export interface OAuthClient {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  client_name?: string;
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: number;
}

export interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  dex_api_key: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: number;
}

export interface AccessToken {
  token: string;
  client_id: string;
  dex_api_key: string;
  expires_at: number;
}

// In-memory stores. For production on Cloud Run with multiple instances,
// replace with Firestore or Redis.
const clients = new Map<string, OAuthClient>();
const authCodes = new Map<string, AuthorizationCode>();
const accessTokens = new Map<string, AccessToken>();

function generateId(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

// --- Client Registration ---

export function registerClient(params: {
  redirect_uris: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}): OAuthClient {
  const client: OAuthClient = {
    client_id: generateId(16),
    redirect_uris: params.redirect_uris,
    client_name: params.client_name,
    grant_types: params.grant_types ?? ["authorization_code"],
    response_types: params.response_types ?? ["code"],
    token_endpoint_auth_method: params.token_endpoint_auth_method ?? "none",
    created_at: Date.now(),
  };
  clients.set(client.client_id, client);
  return client;
}

export function getClient(clientId: string): OAuthClient | undefined {
  return clients.get(clientId);
}

// --- Authorization Codes ---

export function createAuthCode(params: {
  client_id: string;
  redirect_uri: string;
  dex_api_key: string;
  code_challenge: string;
  code_challenge_method: string;
}): string {
  const code = generateId();
  authCodes.set(code, {
    code,
    ...params,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

export function consumeAuthCode(code: string): AuthorizationCode | undefined {
  const entry = authCodes.get(code);
  if (!entry) return undefined;
  if (Date.now() > entry.expires_at) {
    authCodes.delete(code);
    return undefined;
  }
  authCodes.delete(code);
  return entry;
}

// --- Access Tokens ---

export function createAccessToken(params: {
  client_id: string;
  dex_api_key: string;
}): { access_token: string; expires_in: number } {
  const token = generateId();
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds
  accessTokens.set(token, {
    token,
    client_id: params.client_id,
    dex_api_key: params.dex_api_key,
    expires_at: Date.now() + expiresIn * 1000,
  });
  return { access_token: token, expires_in: expiresIn };
}

export function validateAccessToken(token: string): AccessToken | undefined {
  const entry = accessTokens.get(token);
  if (!entry) return undefined;
  if (Date.now() > entry.expires_at) {
    accessTokens.delete(token);
    return undefined;
  }
  return entry;
}

// --- PKCE Verification ---

export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === "S256") {
    const hash = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    return hash === codeChallenge;
  }
  // plain method (not recommended but spec-compliant)
  return codeVerifier === codeChallenge;
}
