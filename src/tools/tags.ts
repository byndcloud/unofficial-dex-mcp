import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex } from "../dex-client.js";
import { toResult, toError } from "../lib/helpers.js";

export function registerTagTools(server: McpServer): void {
  server.tool(
    "dex_create_tag",
    "Create a new tag with a name and optional color for categorizing contacts.",
    {
      name: z.string(),
      color: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/tags/", {
          tag: { name: args.name, color: args.color },
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_tag",
    "Update a tag's name or color by ID.",
    {
      tagId: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/tags/${args.tagId}`, {
          tag: { name: args.name, color: args.color },
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_tag",
    "Permanently delete a tag. It is removed from all contacts it was assigned to.",
    { tagId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(`/v1/tags/${args.tagId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_manage_contact_tags",
    "Manage tag-contact associations. Actions: 'add' assigns existing tags to contacts, 'remove' unassigns tags from contacts, 'create_and_assign' creates new tags by name and assigns them to a single contact (reuses existing tags with the same name).",
    {
      action: z.enum(["add", "remove", "create_and_assign"]),
      contactIds: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
      contactId: z.string().optional(),
      tagNames: z.array(z.string()).optional(),
    },
    async (args) => {
      try {
        let result: unknown;

        switch (args.action) {
          case "add":
            result = await dex.post("/v1/tags/contacts/add", {
              contactIds: args.contactIds,
              tagIds: args.tagIds,
            });
            break;
          case "remove":
            result = await dex.post("/v1/tags/contacts/remove", {
              contactIds: args.contactIds,
              tagIds: args.tagIds,
            });
            break;
          case "create_and_assign":
            result = await dex.post(
              `/v1/tags/contacts/${args.contactId}/create-assign`,
              { tagNames: args.tagNames }
            );
            break;
        }

        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
