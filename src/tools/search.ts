import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

const entityEndpoints: Record<string, string> = {
  contacts: "/v1/search/contacts",
  groups: "/v1/search/groups",
  tags: "/v1/search/tags",
  reminders: "/v1/search/reminders",
  notes: "/v1/search/timeline",
  views: "/v1/search/views",
};

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "dex_search",
    "Search across Dex entities by keyword. Set 'entity' to choose what to search: 'contacts' (name, email, company), 'groups', 'tags', 'reminders', 'notes' (timeline entries), or 'views'. For reminders you can also filter by startDate, endDate, and isComplete. For contacts you can filter by archived status.",
    {
      entity: z.enum(["contacts", "groups", "tags", "reminders", "notes", "views"]),
      searchQuery: z.string().optional(),
      take: z.number().optional(),
      cursor: z.string().optional(),
      archived: z.boolean().optional(),
      enhanced: z.boolean().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isComplete: z.boolean().optional(),
    },
    async (args) => {
      try {
        const endpoint = entityEndpoints[args.entity];
        const query: Record<string, string | number | boolean | undefined> = {};

        if (args.searchQuery !== undefined) query.searchQuery = args.searchQuery;
        if (args.take !== undefined) query.take = args.take;
        if (args.cursor !== undefined) query.cursor = args.cursor;

        if (args.entity === "contacts") {
          if (args.archived !== undefined) query.archived = args.archived;
          if (args.enhanced !== undefined) query.enhanced = args.enhanced;
        }

        if (args.entity === "reminders") {
          if (args.startDate !== undefined) query.startDate = args.startDate;
          if (args.endDate !== undefined) query.endDate = args.endDate;
          if (args.isComplete !== undefined) query.isComplete = args.isComplete;
        }

        if (args.entity === "notes") {
          if (args.startDate !== undefined) query.startDate = args.startDate;
          if (args.endDate !== undefined) query.endDate = args.endDate;
        }

        const result = await dex.get(
          endpoint,
          Object.keys(query).length ? query : undefined
        );
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
