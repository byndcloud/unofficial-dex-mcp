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

const timelineContactSchema = z.object({
  contact_id: z.string(),
});

const meetingTypes = [
  "call", "coffee", "email", "meal", "meeting",
  "networking", "note", "other", "party", "text",
] as const;

export function registerTimelineTools(server: McpServer): void {
  server.tool(
    "dex_create_note",
    "Create a new note or timeline entry. Requires event_time (ISO datetime). Use meeting_type to categorize: 'call', 'coffee', 'email', 'meal', 'meeting', 'networking', 'note', 'other', 'party', 'text'. Associate contacts via timeline_items_contacts array of { contact_id }. The note text goes in the 'note' field.",
    {
      note: z.object({
        note: z.string().optional(),
        event_time: z.string(),
        meeting_type: z.enum(meetingTypes).optional(),
        custom_emoji: z.string().optional(),
        timeline_items_contacts: z.array(timelineContactSchema).optional(),
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
    "Update a note by ID. Can modify the note text, event_time, meeting_type ('call', 'coffee', 'email', 'meal', 'meeting', 'networking', 'note', 'other', 'party', 'text'), associated contacts (timeline_items_contacts), or custom_emoji.",
    {
      noteId: z.string(),
      note: z.object({
        note: z.string().optional(),
        event_time: z.string().optional(),
        meeting_type: z.enum(meetingTypes).optional(),
        custom_emoji: z.string().optional(),
        timeline_items_contacts: z.array(timelineContactSchema).optional(),
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
