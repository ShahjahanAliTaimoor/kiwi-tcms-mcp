#!/usr/bin/env node
/**
 * Offline check: spins up the server in-process and prints the registered tool list.
 * Does NOT touch the network. Useful to confirm the MCP wiring after edits.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerDiscovery } from "../src/tools/discovery.js";
import { register as registerCases } from "../src/tools/cases.js";
import { register as registerPlans } from "../src/tools/plans.js";
import { register as registerRuns } from "../src/tools/runs.js";
import { register as registerExecutions } from "../src/tools/executions.js";
import { register as registerRaw } from "../src/tools/raw.js";

const server = new McpServer({ name: "kiwi-tcms-mcp", version: "1.0.0" });
const fakeClient = { call: async () => ({}) };

for (const r of [
  registerDiscovery,
  registerCases,
  registerPlans,
  registerRuns,
  registerExecutions,
  registerRaw,
]) {
  r(server, fakeClient);
}

// McpServer keeps registered tools on an internal map; read it defensively.
const tools =
  server._registeredTools ??
  server.registeredTools ??
  (server.server && server.server._registeredTools) ??
  {};
const names = Object.keys(tools).sort();
console.log(`${names.length} tools registered:\n`);
for (const n of names) console.log("  " + n);
