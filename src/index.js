#!/usr/bin/env node
/**
 * Kiwi TCMS MCP server — stdio entrypoint (local clients: Claude Code CLI, desktop app).
 *
 * For the remote/HTTP entrypoint used by claude.ai custom connectors, see src/http.js.
 *
 * Env:
 *   KIWI_URL           Base URL of the Kiwi instance, e.g. https://kiwi.sofstica.com:8443
 *   KIWI_USERNAME      Kiwi login
 *   KIWI_PASSWORD      Kiwi password
 *   KIWI_INSECURE_TLS  Set to 1 only if the host presents an untrusted/self-signed cert
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { KiwiClient } from "./kiwi-client.js";
import { buildServer } from "./server-factory.js";

if (process.env.KIWI_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const client = new KiwiClient({
  url: process.env.KIWI_URL,
  username: process.env.KIWI_USERNAME,
  password: process.env.KIWI_PASSWORD,
});

const server = buildServer(client);
const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logging; stdout is the MCP channel.
console.error("kiwi-tcms-mcp ready (stdio)");
