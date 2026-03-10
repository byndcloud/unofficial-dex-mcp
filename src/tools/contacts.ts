import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex, type QueryValue } from "../dex-client.js";

const contactEmailSchema = z.object({
  email: z.string(),
  label: z.string().optional(),
  ranking: z.number().optional(),
});

const contactPhoneSchema = z.object({
  phone_number: z.string(),
  country_code: z.string().optional(),
  phone_number_sanitized: z.string().optional(),
  label: z.string().optional(),
  ranking: z.number().optional(),
});

const contactAddressSchema = z.object({
  formatted: z.string(),
});

const customFieldValueSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  text_value: z.string().optional(),
});

const tagAssociationSchema = z.object({
  tag_id: z.string(),
  contact_id: z.string().optional(),
});

const relatedContactAppendSchema = z.object({
  destination: z.string(),
});

const relatedContactRemoveSchema = z.object({
  source: z.string(),
  destination: z.string().optional(),
});

const contactFieldsShape = {
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  description: z.string().optional(),
  job_title: z.string().optional(),
  company: z.string().optional(),
  education: z.string().optional(),
  legacy_location: z.string().optional(),
  starred: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  website: z.string().optional(),
  image_url: z.string().optional(),

  birthday: z.string().optional(),
  birthday_year: z.number().optional(),

  // Social profiles
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  telegram: z.string().optional(),
  tiktok: z.string().optional(),
  youtube: z.string().optional(),

  // Emails, phones, addresses
  contact_emails: z.array(contactEmailSchema).optional(),
  contact_phone_numbers: z.array(contactPhoneSchema).optional(),
  legacy_contact_addresses: z.array(contactAddressSchema).optional(),

  // Custom field values
  custom_fields: z.array(customFieldValueSchema).optional(),

  // Group associations (array of { group_id })
  groups_contacts: z
    .array(z.object({ group_id: z.string() }))
    .optional(),

  // Tag associations (append/remove)
  tags_contacts: z
    .object({
      append: z.array(tagAssociationSchema).optional(),
      remove: z.array(tagAssociationSchema).optional(),
    })
    .optional(),

  // Related contacts (append/remove)
  related_contacts: z
    .object({
      append: z.array(relatedContactAppendSchema).optional(),
      remove: z.array(relatedContactRemoveSchema).optional(),
    })
    .optional(),

  // Keep-in-touch / reminders
  frequency: z.enum(["7 days", "14 days", "1 mon", "42 days", "3 mons", "6 mons", "1 year"]).optional()
    .describe("Keep-in-touch frequency: '7 days' (weekly), '14 days' (every 2 weeks), '1 mon' (monthly), '42 days' (every 6 weeks), '3 mons' (every 3 months), '6 mons' (every 6 months), '1 year' (yearly)"),
  never_keep_in_touch: z.boolean().optional(),
  last_seen_at: z.string().optional(),
  next_reminder_at: z.string().optional(),
  ignore_merge: z.boolean().optional(),
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
    "Retrieve a single contact by ID. Automatically fetches the contact's notes/timeline entries " +
      "and includes them in the response under a 'notes' key. Use notesLimit to control how many " +
      "notes are fetched (default 50). If the contact has more notes than a single page, pagination " +
      "is handled automatically.",
    {
      contactId: z.string(),
      includeNotes: z
        .boolean()
        .optional()
        .describe("Fetch and include the contact's notes/timeline entries. Defaults to true."),
      notesLimit: z
        .number()
        .min(1)
        .optional()
        .describe("Max number of notes to fetch. Defaults to 50. Paginated automatically if above 50."),
    },
    async (args) => {
      try {
        const fetchNotes = args.includeNotes !== false;
        const notesLimit = args.notesLimit ?? 50;
        const PAGE_SIZE = 50;

        const contactPromise = dex.get<Record<string, unknown>>(
          `/v1/contacts/${args.contactId}`
        );

        if (!fetchNotes) {
          return toResult(await contactPromise);
        }

        const firstPage = await dex.get<{
          data?: { items?: unknown[]; nextCursor?: string };
        }>("/v1/timeline/", {
          contactId: args.contactId,
          take: String(Math.min(notesLimit, PAGE_SIZE)),
        });

        const allItems: unknown[] = firstPage.data?.items ?? [];
        let nextCursor = firstPage.data?.nextCursor;
        let remaining = notesLimit - allItems.length;

        while (nextCursor && remaining > 0) {
          const page = await dex.get<{
            data?: { items?: unknown[]; nextCursor?: string };
          }>("/v1/timeline/", {
            contactId: args.contactId,
            take: String(Math.min(remaining, PAGE_SIZE)),
            cursor: nextCursor,
          });

          const items = page.data?.items ?? [];
          if (items.length === 0) break;

          allItems.push(...items);
          nextCursor = page.data?.nextCursor;
          remaining -= items.length;
        }

        const contact = await contactPromise;
        contact.notes = allItems;

        return toResult(contact);
      } catch (error) {
        return toError(error);
      }
    }
  );

  server.tool(
    "dex_create_contact",
    "Create a new contact. Supports all fields: name, company, job title, emails (contact_emails), phone numbers (contact_phone_numbers), social profiles (linkedin, twitter, facebook, instagram, telegram, tiktok, youtube), addresses (legacy_contact_addresses), custom fields, group and tag associations, and more.",
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
    "Update a contact by ID. Only included fields are modified; omitted fields remain unchanged. Supports all fields: name, company, job title, emails (contact_emails array with email/label/ranking), phone numbers (contact_phone_numbers array with phone_number/country_code/label/ranking), social profiles (linkedin, twitter, facebook, instagram, telegram, tiktok, youtube), addresses (legacy_contact_addresses), custom field values, group associations (groups_contacts), tag associations (tags_contacts with append/remove), related contacts, birthday, archival status, and more.",
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
    "Merge two or more duplicate contacts into one. The first ID in the group becomes the primary contact that is kept and enriched with data from the others. You can merge multiple groups at once.",
    { contactIds: z.array(z.array(z.string()).min(2)).min(1).describe("Array of groups to merge — each group is an array of contact IDs (e.g. [['id1','id2']] merges id1 and id2)") },
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

  const dateRangeSchema = z.object({
    gte: z.string().optional().describe("Greater than or equal — ISO 8601 datetime"),
    lte: z.string().optional().describe("Less than or equal — ISO 8601 datetime"),
  }).optional();

  server.tool(
    "dex_list_contacts",
    "List contacts with advanced filtering, pagination, and field selection. " +
      "Use 'where' to filter by starred, archived, frequency, birthday, location, job title, tags, groups, and more. " +
      "Examples: find today's birthdays (where.hasBirthday), contacts with a keep-in-touch frequency (where.hasFrequency), " +
      "monthly contacts (where.hasFrequency='monthly'), starred contacts (where.isStarred=true).",
    {
      take: z.number().min(1).optional().describe("Number of contacts to return (default varies by API)"),
      skip: z.number().min(0).optional().describe("Number of contacts to skip"),
      cursor: z.string().optional().describe("Pagination cursor (UUID) from a previous response"),
      where: z.object({
        in: z.array(z.string()).optional().describe("Only return contacts with these IDs"),
        notIn: z.array(z.string()).optional().describe("Exclude contacts with these IDs"),
        ignoreMerge: z.boolean().optional(),
        isStarred: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        hasLinkedin: z.string().optional().describe("Filter by LinkedIn URL or true/false"),
        hasSource: z.string().optional().describe("Filter by source"),
        hasName: z.string().optional().describe("Filter by name substring"),
        hasGroups: z.union([z.string(), z.object({ not: z.string() })]).optional().describe("Group ID, or { not: groupId } to exclude"),
        hasFrequency: z.union([z.string(), z.boolean()]).optional().describe("Filter by frequency — true for any, or a specific value: '7 days', '14 days', '1 mon', '42 days', '3 mons', '6 mons', '1 year'"),
        hasLocation: z.string().optional(),
        hasJobTitle: z.string().optional(),
        hasNeverKeepInTouch: z.boolean().optional(),
        hasCreatedAt: dateRangeSchema.describe("Filter by creation date range { gte, lte }"),
        hasUpdatedAt: dateRangeSchema.describe("Filter by update date range { gte, lte }"),
        hasBirthday: z.union([z.boolean(), z.string()]).optional().describe("true to list all contacts with a birthday set, or an ISO 8601 datetime to match a specific date"),
        hasTag: z.string().optional().describe("Tag UUID"),
        hasInteraction: z.union([z.boolean(), z.string()]).optional(),
        hasNextReminder: z.union([z.boolean(), z.string()]).optional(),
      }).optional(),
      include: z.object({
        linkedinData: z.boolean().optional(),
        groupsCount: z.boolean().optional(),
      }).optional(),
      select: z.object({
        linkedinData: z.boolean().optional(),
        groupsCount: z.boolean().optional(),
      }).optional(),
    },
    async (args) => {
      try {
        const query: Record<string, QueryValue> = {};
        if (args.take !== undefined) query.take = args.take;
        if (args.skip !== undefined) query.skip = args.skip;
        if (args.cursor !== undefined) query.cursor = args.cursor;

        const body: Record<string, unknown> = {};

        if (args.where) {
          const w: Record<string, unknown> = {};
          const src = args.where;
          if (src.in !== undefined)                  w.in = src.in;
          if (src.notIn !== undefined)               w.not_in = src.notIn;
          if (src.ignoreMerge !== undefined)          w.ignore_merge = src.ignoreMerge;
          if (src.isStarred !== undefined)            w.is_starred = src.isStarred;
          if (src.isArchived !== undefined)           w.is_archived = src.isArchived;
          if (src.hasLinkedin !== undefined)          w.has_linkedin = src.hasLinkedin;
          if (src.hasSource !== undefined)            w.has_source = src.hasSource;
          if (src.hasName !== undefined)              w.has_name = src.hasName;
          if (src.hasGroups !== undefined)            w.has_groups = src.hasGroups;
          if (src.hasFrequency !== undefined)         w.has_frequency = src.hasFrequency;
          if (src.hasLocation !== undefined)          w.has_location = src.hasLocation;
          if (src.hasJobTitle !== undefined)          w.has_job_title = src.hasJobTitle;
          if (src.hasNeverKeepInTouch !== undefined)  w.has_never_keep_in_touch = src.hasNeverKeepInTouch;
          if (src.hasCreatedAt !== undefined)         w.has_created_at = src.hasCreatedAt;
          if (src.hasUpdatedAt !== undefined)         w.has_updated_at = src.hasUpdatedAt;
          if (src.hasBirthday !== undefined)          w.has_birthday = src.hasBirthday;
          if (src.hasTag !== undefined)               w.has_tag = src.hasTag;
          if (src.hasInteraction !== undefined)       w.has_interaction = src.hasInteraction;
          if (src.hasNextReminder !== undefined)      w.has_next_reminder = src.hasNextReminder;
          body.where = w;
        }

        if (args.include) {
          const inc: Record<string, boolean> = {};
          if (args.include.linkedinData !== undefined) inc.linkedin_data = args.include.linkedinData;
          if (args.include.groupsCount !== undefined)  inc.groups_count = args.include.groupsCount;
          body.include = inc;
        }

        if (args.select) {
          const sel: Record<string, boolean> = {};
          if (args.select.linkedinData !== undefined) sel.linkedin_data = args.select.linkedinData;
          if (args.select.groupsCount !== undefined)  sel.groups_count = args.select.groupsCount;
          body.select = sel;
        }

        const result = await dex.post(
          "/v1/contacts/filter",
          Object.keys(body).length > 0 ? body : undefined,
          Object.keys(query).length > 0 ? query : undefined,
        );
        return toResult(result);
      } catch (error) {
        return toError(error);
      }
    }
  );
}
