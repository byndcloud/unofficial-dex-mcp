import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex } from "../dex-client.js";
import { toResult, toError } from "../lib/helpers.js";

export function registerCustomFieldTools(server: McpServer): void {
  server.tool(
    "dex_list_custom_fields",
    "Retrieve all custom field definitions. Custom fields allow adding structured data to contacts beyond the built-in fields.",
    {},
    async () => {
      try {
        const result = await dex.get("/v1/custom-fields/");
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_create_custom_field",
    "Create a new custom field definition that can be set on any contact.",
    {
      custom_field: z.object({
        name: z.string(),
        type: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/custom-fields/", {
          custom_field: args.custom_field,
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_custom_field",
    "Update a custom field definition by ID (e.g. rename it).",
    {
      customFieldId: z.string(),
      custom_field: z.object({
        name: z.string().optional(),
        type: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await dex.put(
          `/v1/custom-fields/${args.customFieldId}`,
          { custom_field: args.custom_field }
        );
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_custom_field",
    "Permanently delete a custom field and remove its values from all contacts.",
    { customFieldId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(
          `/v1/custom-fields/${args.customFieldId}`
        );
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
