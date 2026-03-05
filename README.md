# Unofficial Dex CRM MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes the [Dex personal CRM](https://getdex.com/) API to AI assistants like Cursor, Claude Desktop, VS Code Copilot, and any MCP-compatible client.

## Features

- **27 focused tools** covering all core Dex CRM operations
- Contacts: get, create, update, delete, merge duplicates
- Groups: create, update, delete, list/add/remove members
- Tags: create, update, delete, manage tag-contact associations
- Reminders: create, update, delete
- Notes/Timeline: create, update, delete (with note type support)
- Custom Fields: list, create, update, delete
- Unified search across contacts, groups, tags, reminders, notes, and views
- User profile

## Prerequisites

- Node.js >= 18
- A [Dex](https://getdex.com/) account with an API key ([Dex Professional](https://getdex.com/pricing) plan required)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Get your Dex API Key

Go to [Dex Settings > API](https://getdex.com/appv3/settings/api) and copy your API key.

### 4. Configure your AI client

#### Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "dex": {
      "command": "node",
      "args": ["/absolute/path/to/unnoficial-dex-mcp/dist/index.js"],
      "env": {
        "DEX_API_KEY": "dex_your_api_key_here"
      }
    }
  }
}
```

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "dex": {
      "command": "node",
      "args": ["/absolute/path/to/unnoficial-dex-mcp/dist/index.js"],
      "env": {
        "DEX_API_KEY": "dex_your_api_key_here"
      }
    }
  }
}
```

#### VS Code

Add to `.vscode/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "dex": {
      "command": "node",
      "args": ["/absolute/path/to/unnoficial-dex-mcp/dist/index.js"],
      "env": {
        "DEX_API_KEY": "dex_your_api_key_here"
      }
    }
  }
}
```

## Development

Run the server in development mode (with hot reload via tsx):

```bash
DEX_API_KEY=dex_your_key npm run dev
```

## Testing with MCP Inspector

The project includes a built-in inspect script that opens the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) UI in your browser. It loads `DEX_API_KEY` from your `.env` file automatically.

```bash
npm run build
npm run inspect
```

This starts the inspector at `http://localhost:6274` where you can browse all tools and invoke them interactively.

> **Note:** Requires Node.js >= 18. If using nvm: `nvm use 21` (or any 18+) before running.

## Available Tools (27)

| Tool | Description |
|------|-------------|
| **Search** | |
| `dex_search` | Unified search across contacts, groups, tags, reminders, notes, and views |
| **Contacts** | |
| `dex_get_contact` | Get full contact details by ID (includes tags, groups, notes) |
| `dex_create_contact` | Create a new contact |
| `dex_update_contact` | Update a contact by ID |
| `dex_delete_contact` | Delete a contact by ID |
| `dex_merge_contacts` | Merge duplicate contacts into one |
| **Groups** | |
| `dex_create_group` | Create a new group |
| `dex_update_group` | Update a group's name or emoji |
| `dex_delete_group` | Delete a group |
| `dex_list_group_contacts` | List contacts in a specific group |
| `dex_add_contacts_to_group` | Add contacts to a group |
| `dex_remove_contacts_from_group` | Remove contacts from a group |
| **Tags** | |
| `dex_create_tag` | Create a new tag |
| `dex_update_tag` | Update a tag's name or color |
| `dex_delete_tag` | Delete a tag |
| `dex_manage_contact_tags` | Add, remove, or create-and-assign tags to contacts |
| **Reminders** | |
| `dex_create_reminder` | Create a reminder (supports recurrence) |
| `dex_update_reminder` | Update a reminder |
| `dex_delete_reminder` | Delete a reminder |
| **Notes / Timeline** | |
| `dex_create_note` | Create a note (types: meeting, call, email, note, coffee, etc.) |
| `dex_update_note` | Update a note |
| `dex_delete_note` | Delete a note |
| **Custom Fields** | |
| `dex_list_custom_fields` | List all custom field definitions |
| `dex_create_custom_field` | Create a custom field |
| `dex_update_custom_field` | Update a custom field |
| `dex_delete_custom_field` | Delete a custom field |
| **User** | |
| `dex_get_current_user` | Get current user profile |

## License

MIT
