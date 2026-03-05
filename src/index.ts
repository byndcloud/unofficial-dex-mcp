#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKey } from "./dex-client.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerTagTools } from "./tools/tags.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerTimelineTools } from "./tools/timeline.js";
import { registerCustomFieldTools } from "./tools/custom-fields.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUserTools } from "./tools/users.js";

const server = new McpServer({
  name: "dex-crm",
  version: "1.0.0",
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

async function main() {
  try {
    getApiKey();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
