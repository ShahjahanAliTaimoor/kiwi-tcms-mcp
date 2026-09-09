# kiwi-tcms-mcp

A local [Model Context Protocol](https://modelcontextprotocol.io) server for
**[Kiwi TCMS](https://kiwitcms.org/)**. It gives Claude (and any MCP client) read/write
access to your Kiwi test management data from a chat prompt. Built as a like-for-like
replacement for the TestRail MCP (`@uarlouski/testrail-mcp-server`) for teams moving off
TestRail.

It talks to Kiwi's JSON-RPC API (`<base>/json-rpc/`), authenticates with username +
password, and exposes **49 read/write tools** covering products, versions, builds,
categories, components, tags, test plans, test cases, test runs and test executions —
plus a raw `kiwi_rpc` escape hatch for any method not given a dedicated tool.

Each person runs it **locally** with **their own Kiwi login** — nothing is hosted, no
shared credentials, nothing exposed to the internet. Permissions are whatever your Kiwi
account already has.

## Setup

**New to this? Follow [`SETUP.md`](SETUP.md)** — step-by-step, plain language.

Quick version:

```bash
git clone <this-repo>
cd kiwi-tcms-mcp
npm install
```

### Wire it into Claude Code

Add a `kiwi` block to the top-level `"mcpServers"` object in `~/.claude.json`
(`C:\Users\<you>\.claude.json` on Windows). Use **your own** Kiwi login and the path to
**your** clone:

```json
"kiwi": {
  "command": "node",
  "args": ["C:\\Users\\<you>\\kiwi-tcms-mcp\\src\\index.js"],
  "env": {
    "KIWI_URL": "https://kiwi.example.com",
    "KIWI_USERNAME": "<your kiwi login>",
    "KIWI_PASSWORD": "<your kiwi password>"
  }
}
```

Restart Claude Code. Tools appear as `mcp__kiwi__kiwi_get_products`, etc. For the Claude
desktop app, put the same block in
`%APPDATA%\Claude\claude_desktop_config.json` and use the full path to `node.exe`.

### Environment variables

| Var | Required | Notes |
|-----|----------|-------|
| `KIWI_URL` | yes | Base URL only, no path. e.g. `https://kiwi.example.com` |
| `KIWI_USERNAME` | yes | Kiwi login (email or username) |
| `KIWI_PASSWORD` | yes | Kiwi password |
| `KIWI_INSECURE_TLS` | no | Set to `1` only if the host's TLS cert is not trusted by Node (self-signed / internal CA). Disables cert verification for the whole process — prefer trusting the CA instead. |

> Credentials sit in `~/.claude.json` in plain text (same posture as most MCP client
> configs). Keep that file private and out of version control.

## Verify

**1. Auth + connectivity smoke test (hits the real instance):**

```powershell
$env:KIWI_URL="https://kiwi.example.com"
$env:KIWI_USERNAME="you@example.com"
$env:KIWI_PASSWORD="..."
npm run smoke
```

Expect `Auth OK` and a list of products. If it fails on TLS, add
`$env:KIWI_INSECURE_TLS="1"` and re-run (then add the same to the config `env`).

**2. Offline tool-registration check (no network):**

```powershell
npm run list-tools
```

## Remote / hosted (HTTP) — experimental

> **Status:** built and smoke-tested, not battle-tested in production. Only host this if
> you understand the exposure: it puts an authenticated path to your Kiwi instance on
> whatever network the host is reachable from, protected by a URL/bearer token. Put it
> behind a real host with a dedicated Kiwi service account, not a personal tunnel with
> your own login.

The stdio server only works with a **local** Claude (CLI / desktop app). To use it from
**claude.ai in a browser**, run the HTTP transport on a publicly reachable host and add
it as a custom connector.

**1. Generate an auth token** (any client that knows it can call the server):

```powershell
npm run gen-token
```

**2. Run the HTTP server:**

```powershell
$env:KIWI_URL="https://kiwi.example.com"
$env:KIWI_USERNAME="you@example.com"
$env:KIWI_PASSWORD="..."
$env:MCP_AUTH_TOKEN="<token from step 1>"
npm run http
```

Listens on `127.0.0.1:8787` by default (`MCP_HTTP_HOST` / `MCP_HTTP_PORT` to change).
`GET /health` is open; the MCP endpoint is `POST /<token>/mcp` (token in the path, so no
custom headers are needed) or `POST /mcp` with an `Authorization: Bearer <token>` header.

**3. Expose it** with a tunnel from your PC:

```powershell
cloudflared tunnel --url http://localhost:8787
# or:  ngrok http 8787
```

**4. Add the connector** in claude.ai → Settings → Connectors → Add custom connector,
URL = `https://<tunnel-host>/<token>/mcp`.

**Env vars specific to the HTTP server:**

| Var | Default | Notes |
|-----|---------|-------|
| `MCP_AUTH_TOKEN` | — | Required (min 32 chars). Callers pass it in the URL path or as a bearer token. |
| `MCP_HTTP_HOST` | `127.0.0.1` | Set `0.0.0.0` in a container. |
| `MCP_HTTP_PORT` | `8787` | |
| `MCP_RATE_PER_MIN` | `120` | Per-IP request cap. |
| `MCP_ALLOW_NO_AUTH` | — | `1` disables the token check entirely. Don't. |

A `Dockerfile` is included (`node src/http.js`, port 8787). `npm run http-smoke` starts
the server on a random port and runs initialize / tools/list / tools/call / bad-token
against live Kiwi.

## Tool map (TestRail MCP → this server)

| Area | Tools |
|------|-------|
| Discovery | `kiwi_get_products`, `kiwi_get_versions`, `kiwi_get_builds`, `kiwi_get_categories`, `kiwi_get_components`, `kiwi_get_tags`, `kiwi_get_priorities`, `kiwi_get_users`, `kiwi_get_execution_statuses`, `kiwi_get_case_statuses`, `kiwi_get_plan_types`, `kiwi_get_classifications` |
| Test cases | `kiwi_get_test_cases`, `kiwi_get_test_case`, `kiwi_create_test_case`, `kiwi_update_test_case`, `kiwi_update_test_cases`, `kiwi_delete_test_case`, `kiwi_get_test_case_history`, `kiwi_add_test_case_comment`, `kiwi_add_test_case_tag`, `kiwi_add_test_case_component`, `kiwi_add_test_case_attachment`, `kiwi_export_test_cases_for_rag` |
| Test plans | `kiwi_get_test_plans`, `kiwi_create_test_plan`, `kiwi_update_test_plan`, `kiwi_add_case_to_plan`, `kiwi_remove_case_from_plan`, `kiwi_add_plan_tag` |
| Test runs | `kiwi_get_test_runs`, `kiwi_create_test_run`, `kiwi_update_test_run`, `kiwi_delete_test_run`, `kiwi_add_case_to_run`, `kiwi_remove_case_from_run`, `kiwi_get_run_cases`, `kiwi_add_run_tag`, `kiwi_add_run_attachment` |
| Executions (results) | `kiwi_get_test_executions`, `kiwi_update_test_execution`, `kiwi_update_executions_bulk`, `kiwi_add_execution_comment`, `kiwi_get_execution_comments`, `kiwi_add_execution_link`, `kiwi_get_execution_links`, `kiwi_get_execution_history` |
| Raw / generic | `kiwi_rpc`, `kiwi_delete_entity` |

### Not ported (no Kiwi equivalent)

- **Shared steps** — Kiwi has no shared-step concept.
- **Milestones** — use product versions / builds instead.
- **Templates**, **configurations** — Kiwi uses Environments (out of scope for v1;
  reach them via `kiwi_rpc` if the Environments plugin is enabled).
- **`get_case_fields` / `resolve_case_field`** — Kiwi has no per-product custom-field
  schema RPC. Custom key/value data lives on `TestCase.properties`
  (`kiwi_get_test_case` with `include_properties: true`).

## Field-name gotchas (TestRail habits that will bite)

| TestRail | Kiwi |
|----------|------|
| `title` | `summary` |
| `custom_steps` / `custom_expected` | `text` (single rich field) |
| `suite_id` + `section_id` | `category_id` (+ link to a `plan`) |
| `type_id` | `is_automated` (bool) + `category` |
| result `status_id` 1..5 (TestRail scale) | Kiwi status ids — call `kiwi_get_execution_statuses` first |

For the authoritative shape of any object, call `kiwi_rpc` with `<Model>.filter` and one
example id, or read the [RPC docs](https://kiwitcms.readthedocs.io/en/latest/modules/tcms.rpc.api.html).
