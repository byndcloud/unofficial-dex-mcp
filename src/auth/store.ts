import crypto from "node:crypto";

// --- Sealed Tokens (stateless, encrypted with AES-256-GCM) ---
// All state (clients, auth codes, access tokens) is encoded INTO the token
// itself, so no in-memory storage is needed. This makes the server fully
// stateless and compatible with Cloud Run's multiple instances / cold starts.

const SECRET = getOrCreateSecret();

function getOrCreateSecret(): Buffer {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret) {
    // Derive a 32-byte key from the provided secret
    return crypto.createHash("sha256").update(envSecret).digest();
  }
  // Auto-generate (works for single instance only)
  console.warn(
    "WARNING: SESSION_SECRET not set. Generating a random key. " +
      "Tokens will not survive restarts or work across multiple instances. " +
      "Set SESSION_SECRET env var for production."
  );
  return crypto.randomBytes(32);
}

function seal(payload: unknown): string {
  const json = JSON.stringify(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SECRET, iv);
  const encrypted = Buffer.concat([
    cipher.update(json, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // iv (12) + tag (16) + encrypted
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function unseal<T = unknown>(token: string): T | undefined {
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", SECRET, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

// --- Client Registration ---

export interface OAuthClientData {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: number;
}

export function registerClient(params: {
  redirect_uris: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}): OAuthClientData {
  const data: OAuthClientData = {
    client_id: "", // will be set below
    redirect_uris: params.redirect_uris,
    client_name: params.client_name,
    grant_types: params.grant_types ?? ["authorization_code"],
    response_types: params.response_types ?? ["code"],
    token_endpoint_auth_method: params.token_endpoint_auth_method ?? "none",
    created_at: Date.now(),
  };
  // The client_id IS the sealed client data
  data.client_id = seal(data);
  return data;
}

export function getClient(clientId: string): OAuthClientData | undefined {
  return unseal<OAuthClientData>(clientId);
}

// --- Authorization Codes ---

interface AuthCodePayload {
  client_id: string;
  redirect_uri: string;
  dex_api_key: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: number;
}

export function createAuthCode(params: {
  client_id: string;
  redirect_uri: string;
  dex_api_key: string;
  code_challenge: string;
  code_challenge_method: string;
}): string {
  const payload: AuthCodePayload = {
    ...params,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  return seal(payload);
}

export function consumeAuthCode(code: string): AuthCodePayload | undefined {
  const payload = unseal<AuthCodePayload>(code);
  if (!payload) return undefined;
  if (Date.now() > payload.expires_at) return undefined;
  return payload;
}

// --- Access Tokens ---

interface AccessTokenPayload {
  client_id: string;
  dex_api_key: string;
  expires_at: number;
}

export function createAccessToken(params: {
  client_id: string;
  dex_api_key: string;
}): { access_token: string; expires_in: number } {
  const expiresIn = 24 * 60 * 60; // 24 hours
  const payload: AccessTokenPayload = {
    ...params,
    expires_at: Date.now() + expiresIn * 1000,
  };
  return { access_token: seal(payload), expires_in: expiresIn };
}

export function validateAccessToken(
  token: string
): { client_id: string; dex_api_key: string } | undefined {
  const payload = unseal<AccessTokenPayload>(token);
  if (!payload) return undefined;
  if (Date.now() > payload.expires_at) return undefined;
  return { client_id: payload.client_id, dex_api_key: payload.dex_api_key };
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
  return codeVerifier === codeChallenge;
}
