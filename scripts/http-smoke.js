#!/usr/bin/env node
/**
 * Starts the HTTP server on a random port with a throwaway token, then exercises it
 * over real HTTP: initialize -> tools/list -> tools/call kiwi_get_products.
 * Hits the live Kiwi instance (needs KIWI_* env / ~/.claude.json creds).
 *
 *   npm run http-smoke
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));

// Pull Kiwi creds from env, else from ~/.claude.json (user scope).
let env = {
  KIWI_URL: process.env.KIWI_URL,
  KIWI_USERNAME: process.env.KIWI_USERNAME,
  KIWI_PASSWORD: process.env.KIWI_PASSWORD,
};
if (!env.KIWI_URL) {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf8"));
    if (cfg.mcpServers?.kiwi?.env) env = cfg.mcpServers.kiwi.env;
  } catch {}
}

const PORT = 8000 + Math.floor(Math.random() * 1000);
const TOKEN = crypto.randomBytes(32).toString("hex");
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn("node", [join(here, "..", "src", "http.js")], {
  env: {
    ...process.env,
    ...env,
    MCP_AUTH_TOKEN: TOKEN,
    MCP_HTTP_PORT: String(PORT),
    MCP_HTTP_HOST: "127.0.0.1",
  },
});
child.stderr.on("data", (d) => process.stderr.write("[server] " + d));

const ready = new Promise((resolve) => {
  child.stderr.on("data", (d) => {
    if (String(d).includes("HTTP listening")) resolve();
  });
});
await Promise.race([ready, new Promise((_, r) => setTimeout(() => r(new Error("server did not start")), 8000))]);

async function rpc(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    // SSE framed
    const line = txt.split("\n").find((l) => l.startsWith("data:"));
    json = line ? JSON.parse(line.slice(5)) : { raw: txt };
  }
  return { status: res.status, json };
}

let failed = false;
try {
  const url = `${BASE}/${TOKEN}/mcp`;

  const init = await rpc(url, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "http-smoke", version: "1" } },
  });
  console.log("initialize:", init.status, init.json?.result?.serverInfo ?? init.json?.error ?? init.json);

  const list = await rpc(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  console.log("tools/list:", list.status, "count =", list.json?.result?.tools?.length);

  const call = await rpc(url, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "kiwi_get_products", arguments: {} },
  });
  const text = call.json?.result?.content?.[0]?.text ?? JSON.stringify(call.json);
  console.log("tools/call kiwi_get_products:", call.status, "isError =", call.json?.result?.isError ?? false);
  console.log(text.slice(0, 500));

  const bad = await rpc(`${BASE}/wrongtoken/mcp`, { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} });
  console.log("bad-token check:", bad.status, bad.status === 401 ? "OK (rejected)" : "!! expected 401");

  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log("health:", JSON.stringify(health));

  failed =
    init.status !== 200 ||
    !list.json?.result?.tools?.length ||
    call.json?.result?.isError ||
    bad.status !== 401;
} catch (e) {
  console.error("SMOKE ERROR:", e.message);
  failed = true;
} finally {
  child.kill();
}
process.exit(failed ? 1 : 0);
