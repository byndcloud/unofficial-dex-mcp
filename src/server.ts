import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerTagTools } from "./tools/tags.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerTimelineTools } from "./tools/timeline.js";
import { registerCustomFieldTools } from "./tools/custom-fields.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUserTools } from "./tools/users.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "dex-crm",
    version: "2.0.0",
    description:
      "Unofficial MCP server for the Dex personal CRM API (getdex.com). " +
      "Manage contacts, groups, tags, reminders, notes, custom fields, and more.",
  });

  registerContactTools(server);
  registerGroupTools(server);
  registerTagTools(server);
  registerReminderTools(server);
  registerTimelineTools(server);
  registerCustomFieldTools(server);
  registerSearchTools(server);
  registerUserTools(server);

  return server;
}
