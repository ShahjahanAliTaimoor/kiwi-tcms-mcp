import { KiwiError } from "./kiwi-client.js";

/** Wrap a value as a successful MCP text result (pretty-printed JSON). */
export function ok(data) {
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/** Wrap an error as an MCP error result the model can read and reason about. */
export function fail(err) {
  let text;
  if (err instanceof KiwiError) {
    text =
      `${err.message}\n` +
      `params: ${JSON.stringify(err.params)}\n` +
      `Hint: field names follow Kiwi's ORM (e.g. summary, status_id, plan, ` +
      `category, product_version). Use kiwi_rpc + *.filter to inspect the real shape.`;
  } else {
    text = `Error: ${err?.message ?? String(err)}`;
  }
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Register a tool whose handler just calls the Kiwi client and returns the result.
 * Keeps every tool definition to name + description + schema + a one-line body.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {import("./kiwi-client.js").KiwiClient} client
 * @param {string} name
 * @param {string} description
 * @param {object} inputSchema  ZodRawShape
 * @param {(args: any, client: import("./kiwi-client.js").KiwiClient) => Promise<any>} handler
 */
export function tool(server, client, name, description, inputSchema, handler) {
  server.registerTool(
    name,
    { description, inputSchema },
    async (args) => {
      try {
        return ok(await handler(args ?? {}, client));
      } catch (err) {
        return fail(err);
      }
    }
  );
}
