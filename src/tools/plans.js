import { z } from "zod";
import { tool } from "../util.js";

/**
 * Test-plan tools. Kiwi's TestPlan is a first-class object (TestRail folded plans into
 * suites/sections). Key fields: name, text, product_id, product_version_id, type_id,
 * parent_id, is_active, extra_link.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_get_test_plans",
    "Search test plans. `query` common keys: {\"product\": <product_id>}, " +
      "{\"name__icontains\": \"regression\"}, {\"is_active\": true}.",
    { query: z.record(z.any()).optional() },
    ({ query }, c) => c.call("TestPlan.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_create_test_plan",
    "Create a test plan. `values` needs: name, text, product_id (or product), " +
      "product_version_id (or product_version), type_id (or type). Optional: parent_id, " +
      "is_active, extra_link.",
    { values: z.record(z.any()) },
    ({ values }, c) => c.call("TestPlan.create", [values])
  );

  tool(
    server,
    client,
    "kiwi_update_test_plan",
    "Update a test plan with a partial field dict.",
    { plan_id: z.number().int(), values: z.record(z.any()) },
    ({ plan_id, values }, c) => c.call("TestPlan.update", [plan_id, values])
  );

  tool(
    server,
    client,
    "kiwi_add_case_to_plan",
    "Link an existing test case to a test plan.",
    { plan_id: z.number().int(), case_id: z.number().int() },
    ({ plan_id, case_id }, c) => c.call("TestPlan.add_case", [plan_id, case_id])
  );

  tool(
    server,
    client,
    "kiwi_remove_case_from_plan",
    "Unlink a test case from a test plan.",
    { plan_id: z.number().int(), case_id: z.number().int() },
    ({ plan_id, case_id }, c) => c.call("TestPlan.remove_case", [plan_id, case_id])
  );

  tool(
    server,
    client,
    "kiwi_add_plan_tag",
    "Attach a tag (by name) to a test plan.",
    { plan_id: z.number().int(), tag: z.string() },
    ({ plan_id, tag }, c) => c.call("TestPlan.add_tag", [plan_id, tag])
  );
}
