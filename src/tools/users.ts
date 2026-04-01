import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dex } from "../dex-client.js";
import { toResult, toError } from "../lib/helpers.js";

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
