#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";

const mode = process.env.MCP_TRANSPORT || "http";

if (mode === "stdio") {
  // Local/CLI mode — uses env var DEX_API_KEY
  if (!process.env.DEX_API_KEY) {
    console.error(
      "DEX_API_KEY environment variable is not set. " +
        "Get your API key from Dex → Settings → API."
    );
    process.exit(1);
  }

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // Remote/HTTP mode — OAuth-authenticated, for Cloud Run
  startHttpServer();
}
