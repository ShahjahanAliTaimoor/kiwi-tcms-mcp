import { z } from "zod";
import { tool } from "../util.js";

const query = {
  query: z
    .record(z.any())
    .optional()
    .describe(
      "Kiwi ORM filter dict, e.g. {\"name\": \"My Product\"} or {\"product_id\": 3}. " +
        "Omit or pass {} to list everything."
    ),
};

/**
 * Read-only lookup tools. Mirrors the TestRail MCP's get_users / get_priorities /
 * get_statuses / get_labels / query_project / get_sections family.
 */
export function register(server, client) {
  tool(
    server,
    client,
    "kiwi_get_products",
    "List Kiwi products (the TestRail 'project' equivalent). Filter dict optional.",
    query,
    ({ query }, c) => c.call("Product.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_versions",
    "List product versions. Typical filter: {\"product\": <product_id>}.",
    query,
    ({ query }, c) => c.call("Version.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_builds",
    "List builds. Typical filter: {\"version__product\": <product_id>} or {\"version\": <version_id>}.",
    query,
    ({ query }, c) => c.call("Build.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_categories",
    "List test-case categories for a product (closest thing to TestRail sections). " +
      "Typical filter: {\"product\": <product_id>}.",
    query,
    ({ query }, c) => c.call("Category.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_components",
    "List components. Typical filter: {\"product\": <product_id>}.",
    query,
    ({ query }, c) => c.call("Component.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_tags",
    "List tags (the TestRail 'labels' equivalent). Filter e.g. {\"name__startswith\": \"reg\"}.",
    query,
    ({ query }, c) => c.call("Tag.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_priorities",
    "List test-case priorities and their ids.",
    query,
    ({ query }, c) => c.call("Priority.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_users",
    "List Kiwi users. Filter e.g. {\"username\": \"sqa1\"} or {\"email__icontains\": \"acme.com\"}.",
    query,
    ({ query }, c) => c.call("User.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_execution_statuses",
    "List TestExecution statuses (PASSED / FAILED / BLOCKED / ...) with their ids. " +
      "Needed before updating an execution result.",
    query,
    ({ query }, c) => c.call("TestExecutionStatus.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_case_statuses",
    "List TestCase statuses (CONFIRMED / PROPOSED / ...) with their ids.",
    query,
    ({ query }, c) => c.call("TestCaseStatus.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_plan_types",
    "List test-plan types (Unit / Integration / Function / ...) with their ids.",
    query,
    ({ query }, c) => c.call("PlanType.filter", [query ?? {}])
  );

  tool(
    server,
    client,
    "kiwi_get_classifications",
    "List product classifications with their ids.",
    query,
    ({ query }, c) => c.call("Classification.filter", [query ?? {}])
  );
}
