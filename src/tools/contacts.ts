import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dex } from "../dex-client.js";

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
  frequency: z.string().optional(),
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
