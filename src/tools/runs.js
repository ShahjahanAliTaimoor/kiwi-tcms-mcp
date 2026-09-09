import { z } from "zod";
import { tool } from "../util.js";

/**
 * Test-run tools. Mirrors the TestRail MCP's query_run / mutate_run /
 * add_attachment_to_run. Kiwi TestRun key fields: summary, notes, plan_id, build_id,
 * manager_id, default_tester_id, planned_start, planned_stop, stop_date.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_get_test_runs",
    "Search test runs. `query` common keys: {\"plan\": <plan_id>}, " +
      "{\"build__version__product\": <product_id>}, {\"summary__icontains\": \"trip\"}, " +
      "{\"stop_date__isnull\": true} (still open).",
    { query: z.record(z.any()).optional() },
    ({ query }, c) => c.call("TestRun.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_create_test_run",
    "Create a test run. `values` needs: summary, plan_id (or plan), build_id (or build), " +
      "manager_id (or manager). Optional: notes, default_tester_id, planned_start, " +
      "planned_stop.",
    { values: z.record(z.any()) },
    ({ values }, c) => c.call("TestRun.create", [values])
  );

  tool(
    server,
    client,
    "kiwi_update_test_run",
    "Update a test run with a partial field dict (e.g. {\"stop_date\": \"2026-09-08 17:00:00\"}).",
    { run_id: z.number().int(), values: z.record(z.any()) },
    ({ run_id, values }, c) => c.call("TestRun.update", [run_id, values])
  );

  tool(
    server,
    client,
    "kiwi_delete_test_run",
    "Permanently delete test runs matching an ORM filter dict. DESTRUCTIVE. " +
      "Pass e.g. {\"id\": 42}.",
    { query: z.record(z.any()) },
    ({ query }, c) => c.call("TestRun.remove", [query])
  );

  tool(
    server,
    client,
    "kiwi_add_case_to_run",
    "Add a test case to a run. This creates the TestExecution rows for that case.",
    { run_id: z.number().int(), case_id: z.number().int() },
    ({ run_id, case_id }, c) => c.call("TestRun.add_case", [run_id, case_id])
  );

  tool(
    server,
    client,
    "kiwi_remove_case_from_run",
    "Remove a test case (and its executions) from a run.",
    { run_id: z.number().int(), case_id: z.number().int() },
    ({ run_id, case_id }, c) => c.call("TestRun.remove_case", [run_id, case_id])
  );

  tool(
    server,
    client,
    "kiwi_get_run_cases",
    "List the test cases currently in a run.",
    { run_id: z.number().int() },
    ({ run_id }, c) => c.call("TestRun.get_cases", [run_id])
  );

  tool(
    server,
    client,
    "kiwi_add_run_tag",
    "Attach a tag (by name) to a test run.",
    { run_id: z.number().int(), tag: z.string() },
    ({ run_id, tag }, c) => c.call("TestRun.add_tag", [run_id, tag])
  );

  tool(
    server,
    client,
    "kiwi_add_run_attachment",
    "Attach a file to a test run. Provide base64-encoded content.",
    {
      run_id: z.number().int(),
      filename: z.string(),
      content_base64: z.string(),
    },
    ({ run_id, filename, content_base64 }, c) =>
      c.call("TestRun.add_attachment", [run_id, filename, content_base64])
  );
}
