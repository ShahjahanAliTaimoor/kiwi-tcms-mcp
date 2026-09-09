import { z } from "zod";
import { tool } from "../util.js";

/**
 * Test-case tools. Mirrors the TestRail MCP's add_case / get_case / get_cases /
 * update_case / update_cases / get_case_history / export_cases_for_rag / add_attachment.
 *
 * Kiwi TestCase key fields: summary, text, notes, case_status_id, category_id,
 * priority_id, is_automated, script, arguments, extra_link, requirement, setup_duration,
 * testing_duration, default_tester_id, author_id.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_get_test_cases",
    "Search test cases. `query` is a Kiwi ORM filter dict. Common keys: " +
      "{\"plan\": <plan_id>}, {\"category__product\": <product_id>}, " +
      "{\"summary__icontains\": \"data usage\"}, {\"case_status__name\": \"CONFIRMED\"}.",
    {
      query: z
        .record(z.any())
        .optional()
        .describe("Kiwi ORM filter dict. Omit/{} returns ALL cases — usually narrow it."),
    },
    ({ query }, c) => c.call("TestCase.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_test_case",
    "Fetch one test case by id, optionally with its comments, custom properties and " +
      "attachment list.",
    {
      case_id: z.number().int().describe("TestCase id"),
      include_comments: z.boolean().optional(),
      include_properties: z.boolean().optional(),
      include_attachments: z.boolean().optional(),
    },
    async ({ case_id, include_comments, include_properties, include_attachments }, c) => {
      const rows = await c.call("TestCase.filter", [{ id: case_id }]);
      const out = { case: Array.isArray(rows) ? rows[0] ?? null : rows };
      if (include_comments) out.comments = await c.call("TestCase.comments", [case_id]);
      if (include_properties)
        out.properties = await c.call("TestCase.properties", [{ case: case_id }]);
      if (include_attachments)
        out.attachments = await c.call("TestCase.list_attachments", [case_id]);
      return out;
    }
  );

  tool(
    server,
    client,
    "kiwi_create_test_case",
    "Create a test case. `values` must include at least: summary, category_id (or " +
      "category), priority_id (or priority), case_status_id (or case_status). " +
      "Optional: text, notes, is_automated, script, extra_link, requirement, " +
      "default_tester_id. Returns the created case.",
    {
      values: z.record(z.any()).describe("Field dict passed straight to TestCase.create"),
    },
    ({ values }, c) => c.call("TestCase.create", [values])
  );

  tool(
    server,
    client,
    "kiwi_update_test_case",
    "Update one test case. `values` is a partial field dict (e.g. " +
      "{\"summary\": \"...\", \"text\": \"...\", \"case_status_id\": 2}).",
    {
      case_id: z.number().int(),
      values: z.record(z.any()),
    },
    ({ case_id, values }, c) => c.call("TestCase.update", [case_id, values])
  );

  tool(
    server,
    client,
    "kiwi_update_test_cases",
    "Apply the same `values` patch to many cases (mirrors TestRail update_cases). " +
      "Runs one TestCase.update per id and reports per-id success/failure.",
    {
      case_ids: z.array(z.number().int()).min(1),
      values: z.record(z.any()),
    },
    async ({ case_ids, values }, c) => {
      const results = [];
      for (const id of case_ids) {
        try {
          results.push({ id, ok: true, case: await c.call("TestCase.update", [id, values]) });
        } catch (e) {
          results.push({ id, ok: false, error: e.message });
        }
      }
      return results;
    }
  );

  tool(
    server,
    client,
    "kiwi_delete_test_case",
    "Permanently delete test cases matching an ORM filter dict. DESTRUCTIVE. " +
      "Pass e.g. {\"id\": 123} or {\"id__in\": [1,2,3]}.",
    { query: z.record(z.any()).describe("ORM filter identifying the case(s) to remove") },
    ({ query }, c) => c.call("TestCase.remove", [query])
  );

  tool(
    server,
    client,
    "kiwi_get_test_case_history",
    "Return the change history for a test case.",
    { case_id: z.number().int() },
    ({ case_id }, c) => c.call("TestCase.history", [case_id])
  );

  tool(
    server,
    client,
    "kiwi_add_test_case_comment",
    "Add a comment to a test case.",
    { case_id: z.number().int(), comment: z.string() },
    ({ case_id, comment }, c) => c.call("TestCase.add_comment", [case_id, comment])
  );

  tool(
    server,
    client,
    "kiwi_add_test_case_tag",
    "Attach a tag (by name) to a test case. The tag is created if it does not exist.",
    { case_id: z.number().int(), tag: z.string() },
    ({ case_id, tag }, c) => c.call("TestCase.add_tag", [case_id, tag])
  );

  tool(
    server,
    client,
    "kiwi_add_test_case_component",
    "Attach a component (by name) to a test case.",
    { case_id: z.number().int(), component: z.string() },
    ({ case_id, component }, c) => c.call("TestCase.add_component", [case_id, component])
  );

  tool(
    server,
    client,
    "kiwi_add_test_case_attachment",
    "Attach a file to a test case. Provide base64-encoded content.",
    {
      case_id: z.number().int(),
      filename: z.string(),
      content_base64: z.string().describe("Base64-encoded file bytes"),
    },
    ({ case_id, filename, content_base64 }, c) =>
      c.call("TestCase.add_attachment", [case_id, filename, content_base64])
  );

  tool(
    server,
    client,
    "kiwi_export_test_cases_for_rag",
    "Bulk-export full text of test cases matching `query`, flattened for RAG / review " +
      "(id, summary, category, priority, status, text, notes). Mirrors TestRail " +
      "export_cases_for_rag.",
    {
      query: z.record(z.any()).describe("ORM filter, e.g. {\"plan\": 12} or {\"category__product\": 3}"),
      limit: z.number().int().positive().optional().describe("Max cases (default 500)"),
    },
    async ({ query, limit }, c) => {
      const rows = await c.call("TestCase.filter", [query ?? {}]);
      const list = Array.isArray(rows) ? rows.slice(0, limit ?? 500) : [];
      return list.map((r) => ({
        id: r.id,
        summary: r.summary,
        category: r.category__name ?? r.category,
        priority: r.priority__value ?? r.priority,
        status: r.case_status__name ?? r.case_status,
        is_automated: r.is_automated,
        text: r.text,
        notes: r.notes,
      }));
    }
  );
}
