import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex } from "../dex-client.js";

const contactFieldsShape = {
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  description: z.string().optional(),
  job_title: z.string().optional(),
  company: z.string().optional(),
  education: z.string().optional(),
  starred: z.boolean().optional(),
  website: z.string().optional(),
  birthday: z.string().optional(),
};

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

export function registerContactTools(server: McpServer): void {
  server.tool(
    "dex_get_contact",
    "Retrieve a single contact by ID with full details including tags, groups, notes, and custom fields.",
    { contactId: z.string() },
    async (args) => {
      try {
        const result = await dex.get(`/v1/contacts/${args.contactId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_create_contact",
    "Create a new contact with fields like name, company, job title, email, etc.",
    {
      contact: z.object(contactFieldsShape),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/contacts/", { contacts: [args.contact] });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_contact",
    "Update a contact by ID. Only included fields are modified; omitted fields remain unchanged.",
    {
      contactId: z.string(),
      data: z.object(contactFieldsShape),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/contacts/${args.contactId}`, args.data);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_contact",
    "Permanently delete a contact by ID. Removes the contact and all associated data.",
    { contactId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(`/v1/contacts/${args.contactId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_merge_contacts",
    "Merge two or more duplicate contacts into one. The first ID becomes the primary contact that is kept and enriched with data from the others.",
    { contactIds: z.array(z.string()).min(2) },
    async (args) => {
      try {
        const result = await dex.post("/v1/contacts/merge", {
          contactIds: args.contactIds,
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
