# Setup Guide

This connects **Claude** (Claude Code CLI, or the Claude desktop app) to a
[Kiwi TCMS](https://kiwitcms.org/) instance so you can read and write test plans,
cases, runs and executions from a chat prompt.

You run it **locally with your own Kiwi login**. Nothing is hosted; no credentials
live in this repo.

---

## What you need

- **Node.js 18 or newer** — check with `node -v`
- A **Kiwi TCMS** account (username/email + password) on the instance you want to use
- The Kiwi base URL, e.g. `https://kiwi.example.com`

---

## 1. Install

```bash
git clone https://github.com/<owner>/kiwi-tcms-mcp.git
cd kiwi-tcms-mcp
npm install
```

## 2. Sanity-check the connection

macOS / Linux:

```bash
KIWI_URL=https://kiwi.example.com \
KIWI_USERNAME=you \
KIWI_PASSWORD=secret \
npm run smoke
```

Windows (PowerShell):

```powershell
$env:KIWI_URL="https://kiwi.example.com"; $env:KIWI_USERNAME="you"; $env:KIWI_PASSWORD="secret"
npm run smoke
```

Expected: `Auth OK`, the Kiwi version, and a list of products. If that works, your
credentials and network path are good.

> TLS error on a self-signed / internal CA? Add `KIWI_INSECURE_TLS=1` (disables cert
> verification for the process — prefer trusting the CA properly).

## 3. Wire it into Claude Code (CLI)

Edit `~/.claude.json` (`C:\Users\<you>\.claude.json` on Windows). Add a `kiwi` block
inside the top-level `"mcpServers"` object (create it if absent):

```json
"mcpServers": {
  "kiwi": {
    "command": "node",
    "args": ["/absolute/path/to/kiwi-tcms-mcp/src/index.js"],
    "env": {
      "KIWI_URL": "https://kiwi.example.com",
      "KIWI_USERNAME": "your_kiwi_username",
      "KIWI_PASSWORD": "your_kiwi_password"
    }
  }
}
```

On Windows use double backslashes in the path. Restart Claude Code, then run `/mcp` —
`kiwi` should show as connected. Tools appear as `mcp__kiwi__kiwi_get_products`, etc.

## 4. Claude desktop app (optional)

Same `kiwi` block, in the desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Use an absolute path to the `node` binary for `"command"` here (e.g.
`C:\\Program Files\\nodejs\\node.exe`). Restart the app.

## 5. Try it

Ask Claude:

- "List Kiwi products"
- "Show me the test plans for product 1"
- "Get test case 42 from Kiwi"

---

## What it can do (49 tools)

| Area | Examples |
|---|---|
| **Discovery / lookups** | products, versions, builds, categories, components, tags, priorities, users, statuses |
| **Test cases** | search, read (with comments/properties/attachments), create, update, bulk-update, delete, history, comment, tag, attach files, export for RAG |
| **Test plans** | list, create, update, add/remove cases, tag |
| **Test runs** | list, create, update, delete, add/remove cases, list run cases, tag, attach |
| **Test executions** | list, update status, **bulk update results by case + status + comment**, comment, link, history |
| **Raw escape hatch** | `kiwi_rpc` — call any Kiwi JSON-RPC method directly (e.g. `TestCase.filter`) |

### How it works

```
Claude  <--MCP/stdio-->  kiwi-tcms-mcp (Node)  <--HTTPS JSON-RPC-->  Kiwi TCMS
```

1. Claude starts the Node server as a subprocess and speaks MCP over stdin/stdout.
2. On the first call the server does `Auth.login(user, pass)` against
   `<KIWI_URL>/json-rpc/`, keeps the session cookie, and reuses it.
3. Each MCP tool maps to one or more Kiwi RPC methods (`TestCase.filter`,
   `TestRun.create`, `TestExecution.update`, …). Results come back as readable JSON.
4. Session expiry is retried once automatically; errors return as plain text with a
   hint about Kiwi field names.

### Gotchas (especially coming from TestRail)

- Kiwi's model isn't TestRail's: **no suites/sections** (uses Category), **no shared
  steps**, **no milestones**. Field names differ — `summary` not `title`, `text` for
  steps/expected, `status_id` not `status`.
- Execution status IDs vary per instance — call `kiwi_get_execution_statuses` first.
  Defaults: `IDLE=1 RUNNING=2 PAUSED=3 PASSED=4 FAILED=5 BLOCKED=6 ERROR=7 WAIVED=8`.
- Your credentials sit in the MCP client config in plain text. Keep it private; never
  commit it.

See the [README](README.md) for the full tool map, the experimental HTTP transport,
and the list of TestRail features with no Kiwi equivalent.
