# Kiwi TCMS MCP — Team Setup Guide

This lets **Claude** (Claude Code CLI, and the Claude desktop app) talk directly to our
Kiwi TCMS instance — read and write test plans, cases, runs and executions from a chat
prompt instead of clicking through the web UI.

You run this **locally on your own machine** with **your own Kiwi login**. Nothing here
contains anyone's credentials.

---

## What you need

- **Node.js 18 or newer** — check with `node -v`
- Your own **Kiwi TCMS username and password** (the same ones you use at
  `https://kiwi.sofstica.com:8443`)
- The `kiwi-tcms-mcp` project folder (shared with you separately / from the repo)

---

## 1. Install

```bash
cd <path-to>\kiwi-tcms-mcp
npm install
```

## 2. Sanity-check the connection

```bash
set KIWI_URL=https://kiwi.sofstica.com:8443
set KIWI_USERNAME=your_kiwi_username
set KIWI_PASSWORD=your_kiwi_password
npm run smoke
```

Expected output: `Auth OK`, the Kiwi version, and a list of products. If you see that,
your credentials and network path are good.

> If it fails on a TLS/certificate error, add `set KIWI_INSECURE_TLS=1` and retry.

## 3. Wire it into Claude Code (CLI)

Edit `~/.claude.json` (Windows: `C:\Users\<you>\.claude.json`). Add a `kiwi` block
inside the top-level `"mcpServers"` object (create `"mcpServers"` if it isn't there):

```json
"mcpServers": {
  "kiwi": {
    "command": "node",
    "args": ["C:\\Users\\<you>\\kiwi-tcms-mcp\\src\\index.js"],
    "env": {
      "KIWI_URL": "https://kiwi.sofstica.com:8443",
      "KIWI_USERNAME": "your_kiwi_username",
      "KIWI_PASSWORD": "your_kiwi_password"
    }
  }
}
```

Use **double backslashes** in the path. Restart Claude Code, then run `/mcp` — you
should see `kiwi` listed as connected.

## 4. Wire it into the Claude desktop app (optional)

Same `kiwi` block, but in the desktop config file:

- Windows: `C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`

Use the **full path to node** for `"command"` here (e.g.
`C:\\Program Files\\nodejs\\node.exe`). Restart the app.

## 5. Try it

Ask Claude:

- "List Kiwi products"
- "Show me the test plans for Routica"
- "Get test case 3012 from Kiwi"

---

## What it can do (tool surface — 49 tools)

| Area | Examples |
|---|---|
| **Discovery / lookups** | products, versions, builds, categories, components, tags, priorities, users, statuses |
| **Test cases** | search, read (with comments/properties/attachments), create, update, bulk-update, delete, history, comment, tag, attach files, export for RAG |
| **Test plans** | list, create, update, add/remove cases, tag |
| **Test runs** | list, create, update, delete, add/remove cases, list run cases, tag, attach |
| **Test executions** | list, update status, **bulk update results by case + status + comment**, comment, link, history |
| **Raw escape hatch** | `kiwi_rpc` — call any Kiwi JSON-RPC method directly (e.g. `TestCase.filter`) |

### How it works (short version)

```
Claude  <--MCP/stdio-->  kiwi-tcms-mcp (Node)  <--HTTPS JSON-RPC-->  Kiwi TCMS
```

1. Claude starts the Node server as a subprocess and speaks MCP over stdin/stdout.
2. On the first call the server does `Auth.login(user, pass)` against
   `https://kiwi.sofstica.com:8443/json-rpc/`, keeps the session cookie, and re-uses it.
3. Each MCP tool maps to one or more Kiwi RPC methods (`TestCase.filter`,
   `TestRun.create`, `TestExecution.update`, …). Results come back as readable JSON.
4. Auth/session expiry is retried once automatically; errors are returned as plain text
   with a hint about the Kiwi field names.

### Notes / gotchas

- Kiwi's model is not TestRail's: **no suites/sections** (uses Category), **no shared
  steps**, **no milestones**. Field names differ (`summary` not `title`, `status_id`
  not `status`). Tool descriptions state the Kiwi names.
- Execution status IDs: `IDLE=1 RUNNING=2 PAUSED=3 PASSED=4 FAILED=5 BLOCKED=6`.
- Credentials sit in your local `~/.claude.json` in plain text — same as the old
  TestRail key. Keep that file private; don't commit it.

---

## Coming next: hosted / online version

We're building an HTTP version of the same server (`npm run http`) that can be put
behind a tunnel and added to **claude.ai** (web) as a custom connector, so you won't
need a local Node process. That's in testing now — this local setup is the supported
path for the moment.
