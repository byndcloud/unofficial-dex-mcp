import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { createOAuthRouter, getBaseUrl } from "./auth/oauth.js";
import { validateAccessToken } from "./auth/store.js";
import { requestContext } from "./context.js";

// Map of session ID -> transport for session reuse
const sessions = new Map<string, StreamableHTTPServerTransport>();

function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.slice(7);
}

export function createHttpApp(): express.Application {
  const app = express();

  // Health check for Cloud Run
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "dex-crm-mcp", version: "2.0.0" });
  });

  // OAuth routes
  app.use(createOAuthRouter());

  // MCP endpoint — Streamable HTTP
  app.all("/mcp", async (req, res) => {
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

    // Handle based on method
    if (req.method === "GET") {
      // SSE connection for server-initiated messages
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(400).json({ error: "invalid_session", error_description: "Valid Mcp-Session-Id header required for GET" });
        return;
      }

      const transport = sessions.get(sessionId)!;
      await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
        await transport.handleRequest(req, res);
      });
      return;
    }

    if (req.method === "DELETE") {
      // Session termination
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
          await transport.handleRequest(req, res);
        });
        sessions.delete(sessionId);
      } else {
        res.status(404).json({ error: "session_not_found" });
      }
      return;
    }

    if (req.method === "POST") {
      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        // Reuse existing transport
        const transport = sessions.get(sessionId)!;
        await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
          await transport.handleRequest(req, res);
        });
        return;
      }

      // New session — create transport and server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, transport);
        },
      });

      // Clean up on close
      transport.onclose = () => {
        const sid = (transport as unknown as { sessionId?: string }).sessionId;
        if (sid) sessions.delete(sid);
      };

      const server = createMcpServer();
      await server.connect(transport);

      await requestContext.run({ dexApiKey: accessToken.dex_api_key }, async () => {
        await transport.handleRequest(req, res);
      });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  });

  return app;
}

export function startHttpServer(): void {
  const app = createHttpApp();
  const port = parseInt(process.env.PORT || "3000", 10);

  app.listen(port, "0.0.0.0", () => {
    const baseUrl = getBaseUrl();
    console.log(`Dex CRM MCP server running at ${baseUrl}`);
    console.log(`  MCP endpoint: ${baseUrl}/mcp`);
    console.log(`  OAuth metadata: ${baseUrl}/.well-known/oauth-authorization-server`);
    console.log(`  Health check: ${baseUrl}/health`);
  });
}
