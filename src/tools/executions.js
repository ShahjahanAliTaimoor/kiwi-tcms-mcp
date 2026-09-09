import { z } from "zod";
import { tool } from "../util.js";

/**
 * Test-execution (result) tools. Mirrors the TestRail MCP's add_results /
 * add_results_for_cases / get_results plus get_tests. A TestExecution is one case's
 * result inside one run. Key fields: status_id, assignee_id, tested_by_id, build_id,
 * start_date, stop_date.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_get_test_executions",
    "Search test executions (results). `query` common keys: {\"run\": <run_id>}, " +
      "{\"run\": <run_id>, \"case\": <case_id>}, {\"status__name\": \"FAILED\"}, " +
      "{\"tested_by__username\": \"sqa1\"}.",
    { query: z.record(z.any()).optional() },
    ({ query }, c) => c.call("TestExecution.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_update_test_execution",
    "Update one execution. `values` e.g. {\"status_id\": 2} (see kiwi_get_execution_statuses), " +
      "or {\"tested_by_id\": 5, \"stop_date\": \"2026-09-08 16:30:00\"}.",
    { execution_id: z.number().int(), values: z.record(z.any()) },
    ({ execution_id, values }, c) =>
      c.call("TestExecution.update", [execution_id, values])
  );

  tool(
    server,
    client,
    "kiwi_update_executions_bulk",
    "Record results for many cases in one run (mirrors TestRail add_results_for_cases). " +
      "For each item, finds the execution for {run_id, case_id}, sets its status, and " +
      "optionally adds a comment. `status` may be a status id (number) or name (string).",
    {
      run_id: z.number().int(),
      results: z
        .array(
          z.object({
            case_id: z.number().int(),
            status: z.union([z.number().int(), z.string()]),
            comment: z.string().optional(),
          })
        )
        .min(1),
    },
    async ({ run_id, results }, c) => {
      // Resolve status names -> ids once.
      const statuses = await c.call("TestExecutionStatus.filter", [{}]);
      const byName = new Map(
        (Array.isArray(statuses) ? statuses : []).map((s) => [
          String(s.name).toUpperCase(),
          s.id,
        ])
      );
      const resolve = (s) =>
        typeof s === "number" ? s : byName.get(String(s).toUpperCase());

      const out = [];
      for (const item of results) {
        const statusId = resolve(item.status);
        if (statusId == null) {
          out.push({ case_id: item.case_id, ok: false, error: `unknown status ${item.status}` });
          continue;
        }
        try {
          const execs = await c.call("TestExecution.filter", [
            { run: run_id, case: item.case_id },
          ]);
          const exec = Array.isArray(execs) ? execs[0] : null;
          if (!exec) {
            out.push({ case_id: item.case_id, ok: false, error: "no execution in run" });
            continue;
          }
          await c.call("TestExecution.update", [exec.id, { status_id: statusId }]);
          if (item.comment) {
            await c.call("TestExecution.add_comment", [exec.id, item.comment]);
          }
          out.push({ case_id: item.case_id, execution_id: exec.id, ok: true });
        } catch (e) {
          out.push({ case_id: item.case_id, ok: false, error: e.message });
        }
      }
      return out;
    }
  );

  tool(
    server,
    client,
    "kiwi_add_execution_comment",
    "Add a comment to a test execution.",
    { execution_id: z.number().int(), comment: z.string() },
    ({ execution_id, comment }, c) =>
      c.call("TestExecution.add_comment", [execution_id, comment])
  );

  tool(
    server,
    client,
    "kiwi_get_execution_comments",
    "Get the comments on a test execution.",
    { execution_id: z.number().int() },
    ({ execution_id }, c) => c.call("TestExecution.get_comments", [execution_id])
  );

  tool(
    server,
    client,
    "kiwi_add_execution_link",
    "Attach an external URL (bug link, evidence) to a test execution.",
    {
      execution_id: z.number().int(),
      url: z.string(),
      name: z.string().optional(),
      is_defect: z.boolean().optional(),
    },
    ({ execution_id, url, name, is_defect }, c) =>
      c.call("TestExecution.add_link", [
        { execution_id, url, name: name ?? "", is_defect: !!is_defect },
      ])
  );

  tool(
    server,
    client,
    "kiwi_get_execution_links",
    "List external links attached to a test execution.",
    { execution_id: z.number().int() },
    ({ execution_id }, c) => c.call("TestExecution.get_links", [{ execution: execution_id }])
  );

  tool(
    server,
    client,
    "kiwi_get_execution_history",
    "Return the change history for a test execution.",
    { execution_id: z.number().int() },
    ({ execution_id }, c) => c.call("TestExecution.history", [execution_id])
  );
}
