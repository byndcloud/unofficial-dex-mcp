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

export function registerReminderTools(server: McpServer): void {
  server.tool(
    "dex_create_reminder",
    "Create a new reminder, optionally linked to a contact. Supports recurrence with frequency (e.g. 'weekly', 'monthly').",
    {
      title: z.string(),
      dueDate: z.string().optional(),
      contactId: z.string().optional(),
      isRecurring: z.boolean().optional(),
      frequency: z.string().optional(),
      isComplete: z.boolean().optional(),
    },
    async (args) => {
      try {
        const result = await dex.post("/v1/reminders/", { reminder: args });
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_update_reminder",
    "Update a reminder by ID. Modify title, due date, contact, recurrence, or completion status.",
    {
      reminderId: z.string(),
      reminder: z.object({
        title: z.string().optional(),
        dueDate: z.string().optional(),
        contactId: z.string().optional(),
        isRecurring: z.boolean().optional(),
        frequency: z.string().optional(),
        isComplete: z.boolean().optional(),
      }),
    },
    async (args) => {
      try {
        const result = await dex.put(`/v1/reminders/${args.reminderId}`, {
          reminder: args.reminder,
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
