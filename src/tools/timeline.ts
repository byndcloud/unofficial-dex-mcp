import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex } from "../dex-client.js";
import { toResult, toError } from "../lib/helpers.js";

const timelineContactSchema = z.object({
  contact_id: z.string(),
});

const meetingTypes = [
  "call", "coffee", "email", "meal", "meeting",
  "networking", "note", "other", "party", "text",
] as const;

interface NoteType {
  id: string;
  name: string;
  icon?: string;
}

let noteTypesCache: NoteType[] | null = null;

async function fetchNoteTypes(): Promise<NoteType[]> {
  if (noteTypesCache) return noteTypesCache;
  const res = await dex.get<{ data?: NoteType[] }>("/v1/timeline/note-types");
  noteTypesCache = res.data ?? [];
  return noteTypesCache;
}

async function resolveMeetingTypeId(
  meetingType: string | undefined
): Promise<string | undefined> {
  if (!meetingType) return undefined;
  const types = await fetchNoteTypes();
  const match = types.find(
    (t) => t.name.toLowerCase() === meetingType.toLowerCase()
  );
  return match?.id;
}

async function enrichNoteBody(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const meetingType = body.meeting_type as string | undefined;
  const meetingTypeId = await resolveMeetingTypeId(meetingType);
  if (meetingTypeId) {
    return { ...body, meeting_type_id: meetingTypeId };
  }
  return body;
}

export function registerTimelineTools(server: McpServer): void {
  server.tool(
    "dex_create_note",
    "Create a new note or timeline entry. Requires event_time (ISO datetime). Use meeting_type to categorize: 'call', 'coffee', 'email', 'meal', 'meeting', 'networking', 'note', 'other', 'party', 'text'. The meeting_type_id is resolved automatically from the note types API. Associate contacts via timeline_items_contacts array of { contact_id }. The note text goes in the 'note' field.",
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
        const noteBody = await enrichNoteBody(
          args.note as unknown as Record<string, unknown>
        );
        const result = await dex.post("/v1/timeline/", { note: noteBody });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_note",
    "Update a note by ID. Can modify the note text, event_time, meeting_type ('call', 'coffee', 'email', 'meal', 'meeting', 'networking', 'note', 'other', 'party', 'text'), associated contacts (timeline_items_contacts), or custom_emoji. The meeting_type_id is resolved automatically.",
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
        const noteBody = await enrichNoteBody(
          args.note as unknown as Record<string, unknown>
        );
        const result = await dex.put(`/v1/timeline/${args.noteId}`, {
          note: noteBody,
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
