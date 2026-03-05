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

export function registerGroupTools(server: McpServer): void {
  server.tool(
    "dex_create_group",
    "Create a new group for organizing contacts.",
    {
      name: z.string(),
      emoji: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/groups/", {
          group: { name: args.name, emoji: args.emoji },
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_group",
    "Update a group's name or emoji by ID.",
    {
      groupId: z.string(),
      name: z.string().optional(),
      emoji: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/groups/${args.groupId}`, {
          group: { name: args.name, emoji: args.emoji },
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_group",
    "Permanently delete a group. The contacts in the group are not deleted.",
    { groupId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(`/v1/groups/${args.groupId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_list_group_contacts",
    "List all contacts that belong to a specific group. Supports pagination.",
    {
      groupId: z.string(),
      take: z.number().optional(),
      cursor: z.string().optional(),
    },
    async (args) => {
      try {
        const query: Record<string, string | number | boolean | undefined> = {};
        if (args.take !== undefined) query.take = args.take;
        if (args.cursor !== undefined) query.cursor = args.cursor;
        const result = await dex.get(
          `/v1/groups/${args.groupId}/contacts`,
          Object.keys(query).length ? query : undefined
        );
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_add_contacts_to_group",
    "Add one or more contacts to a group by providing their IDs.",
    {
      groupId: z.string(),
      contactIds: z.array(z.string()),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/groups/${args.groupId}/contacts`, {
          contactIds: args.contactIds,
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_remove_contacts_from_group",
    "Remove one or more contacts from a group. The contacts themselves are not deleted.",
    {
      groupId: z.string(),
      contactIds: z.array(z.string()),
    },
    async (args) => {
      try {
        const result = await dex.post(`/v1/groups/${args.groupId}/contacts`, {
          contactIds: args.contactIds,
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
