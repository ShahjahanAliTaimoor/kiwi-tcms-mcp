# kiwi-tcms-mcp

![license: MIT](https://img.shields.io/badge/license-MIT-green)
![node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![MCP](https://img.shields.io/badge/Model_Context_Protocol-server-blue)

A [Model Context Protocol](https://modelcontextprotocol.io) server for
**[Kiwi TCMS](https://kiwitcms.org/)**. It exposes your Kiwi test-management data to any
MCP client — Claude Code, Claude Desktop, Cursor, Cline, Zed, Continue, or your own —
so you can browse and create test cases, build test plans and runs, and record
execution results from a chat prompt.

- **49 tools** over Kiwi's JSON-RPC API — products, versions, builds, categories,
  components, tags, test plans, cases, runs, executions — plus a raw `kiwi_rpc` escape
  hatch for anything without a dedicated tool.
- **Runs locally** over stdio, authenticates with your own Kiwi username + password.
  Nothing is hosted, no shared credentials. You get exactly the permissions your Kiwi
  account has.
- **No build step** — plain Node ESM, `node src/index.js`.

```
MCP client  ──MCP (stdio)──▶  kiwi-tcms-mcp  ──HTTPS JSON-RPC──▶  Kiwi TCMS
```

Coming from TestRail? See the [tool map](#tool-map) — the surface mirrors the
`@uarlouski/testrail-mcp-server` MCP so a migration is mostly renaming fields.

### Example prompts

> - "List the test plans for product 3 in Kiwi."
> - "Create a test case under category 12: title 'Login rejects expired token', priority P1, with steps and expected result."
> - "Mark cases 4001–4010 in run 87 as PASSED with the comment 'regression clean on build 2.3.1'."
> - "Show the execution history for test execution 55."

## Setup

**New here? Follow [`SETUP.md`](SETUP.md)** — step-by-step, cross-platform, plain language.

Quick version:

```bash
git clone https://github.com/ShahjahanAliTaimoor/kiwi-tcms-mcp.git
cd kiwi-tcms-mcp
npm install
```

### Wire it into your MCP client

Every MCP client takes the same three things — a command, its args, and an env block.
Point it at `src/index.js` with your own Kiwi login:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/kiwi-tcms-mcp/src/index.js"],
  "env": {
    "KIWI_URL": "https://kiwi.example.com",
    "KIWI_USERNAME": "<your kiwi login>",
    "KIWI_PASSWORD": "<your kiwi password>"
  }
}
```

- **Claude Code** — put it under the top-level `"mcpServers"` in `~/.claude.json`
  (`C:\Users\<you>\.claude.json` on Windows), or run `claude mcp add`.
- **Claude Desktop** — `mcpServers` in `claude_desktop_config.json`
  (`%APPDATA%\Claude\` on Windows, `~/Library/Application Support/Claude/` on macOS);
  use an absolute path to `node`.
- **Cursor / Cline / Continue / Zed** — their MCP settings use the same
  `command` / `args` / `env` shape.

Restart the client. Tools show up namespaced, e.g. `kiwi_get_products`. On Windows use
double backslashes in JSON paths. Full walkthrough in [`SETUP.md`](SETUP.md).

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

**1. Auth + connectivity smoke test** (hits a real instance):

```bash
# macOS / Linux
KIWI_URL=https://kiwi.example.com KIWI_USERNAME=you KIWI_PASSWORD=secret npm run smoke
```
```powershell
# Windows PowerShell
$env:KIWI_URL="https://kiwi.example.com"; $env:KIWI_USERNAME="you"; $env:KIWI_PASSWORD="secret"; npm run smoke
```

Expect `Auth OK` and a list of products. TLS error on an internal CA? Prefix
`KIWI_INSECURE_TLS=1` (then add the same to your config `env`).

**2. Offline checks** (no network):

```bash
npm run list-tools     # prints all 49 registered tools
npm test               # lint/registration sanity (alias of list-tools)
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

## Tool map

Grouped by area. Names and grouping mirror the `@uarlouski/testrail-mcp-server` MCP to
make a TestRail migration mostly mechanical.

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
- **Templates**, **configurations** — Kiwi uses Environments instead; reach them via
  `kiwi_rpc` if the Environments plugin is enabled.
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

## Requirements

- Node.js **18+** (uses global `fetch`)
- A Kiwi TCMS account with API access on the instance you point at

Every tool runs with **your account's Kiwi permissions**. Kiwi enforces per-model
add/change/delete/view grants, so a login can easily be able to *create* a test case
but not *edit* or *delete* one. When a grant is missing Kiwi returns error `-32098`
("Authentication failed when calling `<Method>`") — that's a permissions problem, not a
bug. Common ones: `auth.view_user` for `kiwi_get_users`; `testcases.change_testcase` /
`testcases.delete_testcase` for `kiwi_update_test_case` / `kiwi_delete_test_case`;
likewise for `testplans.*`, `testruns.*`, `testexecutions.*`. Grant the matching
permission (Kiwi admin → user/group), or use an account that has it.

Verified against a live Kiwi 16.3 instance: all read tools, `kiwi_create_test_case` and
`kiwi_add_test_case_comment` work end-to-end; `update`/`delete` were correctly refused
on a create-only account with `-32098`.

## Contributing

Issues and PRs welcome. Handy while developing:

```bash
npm run list-tools   # every registered tool, offline
npm run smoke        # live Auth.login + Product.filter (needs KIWI_* env)
npm run http-smoke   # spins up the HTTP server and runs initialize/list/call/health
```

## License

[MIT](LICENSE)
