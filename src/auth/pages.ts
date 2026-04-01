export function authorizePage(params: {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  client_name?: string;
  error?: string;
}): string {
  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Dex CRM MCP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      padding: 2rem;
      max-width: 420px;
      width: 100%;
    }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; color: #1a1a1a; }
    .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .client-name { font-weight: 600; color: #333; }
    label { display: block; font-weight: 500; margin-bottom: 0.4rem; color: #333; }
    input[type="text"] {
      width: 100%;
      padding: 0.7rem 0.8rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
      font-family: monospace;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: #0066ff;
      box-shadow: 0 0 0 3px rgba(0,102,255,0.1);
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #0066ff;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #0052cc; }
    .error {
      background: #fee;
      color: #c33;
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .help {
      margin-top: 1rem;
      font-size: 0.8rem;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect to Dex CRM</h1>
    <p class="subtitle">
      <span class="client-name">${escapeHtml(params.client_name || "An application")}</span>
      wants to access your Dex CRM data via MCP.
    </p>
    ${errorHtml}
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method)}" />
      <label for="dex_api_key">Dex API Key</label>
      <input type="text" id="dex_api_key" name="dex_api_key"
        placeholder="dex_xxxxxxxxxxxxxxxxxxxxxxxx"
        required autocomplete="off" />
      <button type="submit">Authorize</button>
    </form>
    <p class="help">
      Find your API key at Dex &rarr; Settings &rarr; API.<br/>
      Requires a Dex Professional plan.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
