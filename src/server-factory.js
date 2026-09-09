import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { register as registerDiscovery } from "./tools/discovery.js";
import { register as registerCases } from "./tools/cases.js";
import { register as registerPlans } from "./tools/plans.js";
import { register as registerRuns } from "./tools/runs.js";
import { register as registerExecutions } from "./tools/executions.js";
import { register as registerRaw } from "./tools/raw.js";

/**
 * Build a fully-populated McpServer bound to a KiwiClient. Shared by the stdio
 * entrypoint (src/index.js) and the HTTP entrypoint (src/http.js) so the tool set
 * is identical on both transports.
 *
 * @param {import("./kiwi-client.js").KiwiClient} client
 * @returns {McpServer}
 */
export function buildServer(client) {
  const server = new McpServer({ name: "kiwi-tcms-mcp", version: "1.0.0" });
  for (const register of [
    registerDiscovery,
    registerCases,
    registerPlans,
    registerRuns,
    registerExecutions,
    registerRaw,
  ]) {
    register(server, client);
  }
  return server;
}
