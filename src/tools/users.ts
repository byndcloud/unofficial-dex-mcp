import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dex } from "../dex-client.js";

function toResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function toError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

export function registerUserTools(server: McpServer): void {
  server.tool(
    "dex_get_current_user",
    "Retrieve the profile of the currently authenticated user including name, email, time zone, and subscription plan.",
    {},
    async () => {
      try {
        const result = await dex.get("/v1/users/me");
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
