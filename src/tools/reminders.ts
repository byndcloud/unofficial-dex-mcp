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

function toDateTime(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00:00.000Z`;
  }
  return new Date(date).toISOString();
}

function toReminderBody(args: {
  text?: string;
  dueDate?: string;
  dueTime?: string;
  contactIds?: string[];
  recurrence?: string;
  isComplete?: boolean;
}) {
  return {
    ...(args.text !== undefined && { text: args.text }),
    ...(args.dueDate !== undefined && { due_at_date: toDateTime(args.dueDate) }),
    ...(args.dueTime !== undefined && { due_at_time: toDateTime(args.dueTime) }),
    ...(args.contactIds !== undefined && args.contactIds.length > 0 && {
      reminders_contacts: args.contactIds.map((id) => ({ contact_id: id })),
    }),
    ...(args.recurrence !== undefined && { recurrence: args.recurrence }),
    ...(args.isComplete !== undefined && { is_complete: args.isComplete }),
  };
}

export function registerReminderTools(server: McpServer): void {
  server.tool(
    "dex_create_reminder",
    "Create a new reminder, optionally linked to contacts. Supports recurrence (e.g. 'weekly', 'monthly').",
    {
      text: z.string().describe("Reminder text / title"),
      dueDate: z.string().describe("Due date — accepts 'YYYY-MM-DD' or full ISO 8601 datetime (e.g. '2025-12-31' or '2025-12-31T10:00:00Z')"),
      dueTime: z.string().optional().describe("Optional due time as ISO 8601 datetime (e.g. '2025-12-31T14:00:00Z')"),
      contactIds: z.array(z.string()).optional().describe("Optional list of contact IDs to link to this reminder"),
      recurrence: z.string().optional().describe("Recurrence pattern (e.g. 'weekly', 'monthly')"),
      isComplete: z.boolean().optional(),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/reminders/", {
          reminder: toReminderBody(args),
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_reminder",
    "Update a reminder by ID. Modify text, due date/time, linked contacts, recurrence, completion status, and notification flags.",
    {
      reminderId: z.string(),
      reminder: z.object({
        text: z.string().optional().describe("Reminder text / title"),
        dueDate: z.string().optional().describe("Due date — accepts 'YYYY-MM-DD' or full ISO 8601 datetime"),
        dueTime: z.string().optional().describe("Optional due time as ISO 8601 datetime"),
        contactIds: z.array(z.string()).optional().describe("List of contact IDs to link to this reminder"),
        recurrence: z.string().optional().describe("Recurrence pattern (e.g. 'weekly', 'monthly')"),
        isComplete: z.boolean().optional(),
        lastCompletedAt: z.string().optional().describe("ISO 8601 datetime of last completion"),
        nextOccurrenceAt: z.string().optional().describe("ISO 8601 datetime of next occurrence"),
        emailSent: z.boolean().optional(),
        pushNotificationSent: z.boolean().optional(),
      }),
    },
    async (args) => {
      try {
        const { lastCompletedAt, nextOccurrenceAt, emailSent, pushNotificationSent, ...base } = args.reminder;
        const result = await dex.put(`/v1/reminders/${args.reminderId}`, {
          reminder: {
            ...toReminderBody(base),
            ...(lastCompletedAt !== undefined && { last_completed_at: toDateTime(lastCompletedAt) }),
            ...(nextOccurrenceAt !== undefined && { next_occurrence_at: toDateTime(nextOccurrenceAt) }),
            ...(emailSent !== undefined && { email_sent: emailSent }),
            ...(pushNotificationSent !== undefined && { push_notification_sent: pushNotificationSent }),
          },
        });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_delete_reminder",
    "Permanently delete a reminder. For recurring reminders, this stops all future occurrences.",
    { reminderId: z.string() },
    async (args) => {
      try {
        const result = await dex.delete(`/v1/reminders/${args.reminderId}`);
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
