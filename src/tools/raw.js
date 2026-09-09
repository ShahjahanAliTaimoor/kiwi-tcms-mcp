import { z } from "zod";
import { tool } from "../util.js";

/**
 * Raw escape hatch + generic delete. Guarantees full coverage of the Kiwi RPC API for
 * anything without a dedicated tool.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_rpc",
    "Call ANY Kiwi JSON-RPC method directly. `method` e.g. \"TestCase.filter\", " +
      "\"TestPlan.tree\", \"Bug.report\". `params` is the POSITIONAL argument array Kiwi " +
      "expects (usually a single dict for *.filter, or [id, {patch}] for *.update). " +
      "Unguarded — you are responsible for correct method + params. Full method list: " +
      "https://kiwitcms.readthedocs.io/en/latest/modules/tcms.rpc.api.html",
    {
      method: z.string().describe("Namespace.method, e.g. TestRun.filter"),
      params: z
        .array(z.any())
        .optional()
        .describe("Positional params array; defaults to []"),
    },
    ({ method, params }, c) => c.call(method, params ?? [])
  );

  tool(
    server,
    client,
    "kiwi_delete_entity",
    "Generic delete: calls <Model>.remove with the given ORM filter dict. DESTRUCTIVE. " +
      "`model` e.g. \"TestCase\", \"TestRun\", \"TestExecution\", \"Tag\". " +
      "`query` e.g. {\"id\": 5} or {\"id__in\": [1,2,3]}.",
    {
      model: z.string(),
      query: z.record(z.any()),
    },
    ({ model, query }, c) => c.call(`${model}.remove`, [query])
  );
}
