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

export function registerTimelineTools(server: McpServer): void {
  server.tool(
    "dex_create_note",
    "Create a new note or timeline entry associated with contacts. Available note types: 'meeting', 'call', 'email', 'note', 'coffee', 'lunch', 'dinner', 'event'. Use the type field to categorize the interaction.",
    {
      note: z.object({
        content: z.string().optional(),
        type: z.string().optional(),
        contactIds: z.array(z.string()).optional(),
        date: z.string().optional(),
        title: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/timeline/", { note: args.note });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_note",
    "Update a note by ID. Modify content, associated contacts, note type, or date.",
    {
      noteId: z.string(),
      note: z.object({
        content: z.string().optional(),
        type: z.string().optional(),
        contactIds: z.array(z.string()).optional(),
        date: z.string().optional(),
        title: z.string().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/timeline/${args.noteId}`, {
          note: args.note,
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_note",
    "Permanently delete a note by ID. Removes the timeline entry from all associated contacts.",
    { noteId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(`/v1/timeline/${args.noteId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
