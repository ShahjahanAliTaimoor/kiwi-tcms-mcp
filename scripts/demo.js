#!/usr/bin/env node
/**
 * Drives the real MCP server over stdio (initialize -> tools/call ...) using the
 * credentials from ~/.claude.json. Proves the server works exactly as an MCP client
 * would use it. Not part of normal operation — a manual verification helper.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
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
if (!env.KIWI_URL) throw new Error("set KIWI_URL / KIWI_USERNAME / KIWI_PASSWORD, or add a top-level mcpServers.kiwi entry to ~/.claude.json");

const child = spawn("node", [join(here, "..", "src", "index.js")], {
  env: { ...process.env, ...env },
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", (d) => process.stderr.write("[server] " + d));

let id = 0;
const rpc = (method, params) =>
  new Promise((res) => {
    const myId = ++id;
    pending.set(myId, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
  });

const callTool = async (name, args = {}) => {
  const r = await rpc("tools/call", { name, arguments: args });
  const text = r.result?.content?.[0]?.text ?? "";
  return { isError: !!r.result?.isError, text };
};

const short = (s, n = 1200) => (s.length > n ? s.slice(0, n) + "\n… (truncated)" : s);

await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "demo", version: "1" },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const list = await rpc("tools/list", {});
console.log(`tools/list: ${list.result.tools.length} tools\n`);

console.log("── kiwi_get_products ──");
console.log(short((await callTool("kiwi_get_products")).text, 900));

const PRODUCT_ID = Number(process.env.DEMO_PRODUCT_ID || 1);

console.log(`\n── kiwi_get_test_plans {product: ${PRODUCT_ID}} ──`);
console.log(short((await callTool("kiwi_get_test_plans", { query: { product: PRODUCT_ID } })).text, 1500));

console.log(`\n── kiwi_get_test_cases {category__product: ${PRODUCT_ID}} count ──`);
{
  const { text, isError } = await callTool("kiwi_get_test_cases", {
    query: { category__product: PRODUCT_ID },
  });
  if (isError) console.log("ERROR:", text);
  else {
    let arr = [];
    try {
      arr = JSON.parse(text);
    } catch {}
    console.log(`test cases: ${Array.isArray(arr) ? arr.length : "?"}`);
    if (Array.isArray(arr)) {
      for (const c of arr.slice(0, 8)) console.log(`  #${c.id}  ${c.summary}`);
    }
  }
}

console.log("\n── kiwi_get_execution_statuses ──");
console.log(short((await callTool("kiwi_get_execution_statuses")).text, 700));

child.kill();
process.exit(0);
