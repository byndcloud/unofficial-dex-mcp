import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { createOAuthRouter, getBaseUrl } from "./auth/oauth.js";
import { validateAccessToken } from "./auth/store.js";
import { requestContext } from "./context.js";

// Map of session ID -> transport for session reuse within the same instance.
// This is ephemeral — Cloud Run instances can restart at any time, so the
// POST handler always creates a new session when the requested one is missing.
const sessions = new Map<string, StreamableHTTPServerTransport>();

function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.slice(7);
}

function createTransport(): StreamableHTTPServerTransport {
  // Stateless mode: no session ID required, each request is self-contained.
  // This is critical for Cloud Run where instances are ephemeral.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined as unknown as (() => string),
    enableJsonResponse: true,
  });
  return transport;
}

export function createHttpApp(): express.Application {
  const app = express();

  // Parse JSON bodies for all routes (required by StreamableHTTPServerTransport)
  app.use(express.json());

  // Health check for Cloud Run
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "dex-crm-mcp", version: "2.0.0" });
  });

  // OAuth routes
  app.use(createOAuthRouter());

  // MCP endpoint — Streamable HTTP (served at root and /mcp)
  const mcpHandler: express.RequestHandler = async (req, res) => {
    // Authenticate
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        error: "unauthorized",
        error_description: "Bearer token required",
      });
      return;
    }

    const accessToken = validateAccessToken(token);
    if (!accessToken) {
      res.status(401).json({
        error: "invalid_token",
        error_description: "Token is invalid or expired",
      });
      return;
    }

    if (req.method === "GET") {
      // SSE stream — try to find existing session, otherwise 400
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
          await transport.handleRequest(req, res, req.body);
        });
        return;
      }
      res.status(400).json({ error: "session_not_found" });
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId) sessions.delete(sessionId);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "POST") {
      // Try existing session first
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
          await transport.handleRequest(req, res, req.body);
        });
        return;
      }

      // Session not found (or no session ID) — always create a fresh one.
      // This handles: first request, cold starts, instance switches, etc.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, transport);
        },
      });

      transport.onclose = () => {
        const sid = (transport as unknown as { sessionId?: string }).sessionId;
        if (sid) sessions.delete(sid);
      };

      const server = createMcpServer();
      await server.connect(transport);

      await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
        await transport.handleRequest(req, res, req.body);
      });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  };

  app.all("/mcp", mcpHandler);
  app.all("/", mcpHandler);

  return app;
}

export function startHttpServer(): void {
  const app = createHttpApp();
  const port = parseInt(process.env.PORT || "3000", 10);

  app.listen(port, "0.0.0.0", () => {
    const baseUrl = getBaseUrl();
    console.log(`Dex CRM MCP server running at ${baseUrl}`);
    console.log(`  MCP endpoint: ${baseUrl}/ (also ${baseUrl}/mcp)`);
    console.log(`  OAuth metadata: ${baseUrl}/.well-known/oauth-authorization-server`);
    console.log(`  Health check: ${baseUrl}/health`);
  });
}
