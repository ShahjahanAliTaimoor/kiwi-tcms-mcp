#!/usr/bin/env node
/**
 * Kiwi TCMS MCP server — HTTP entrypoint for remote use (claude.ai custom connectors).
 *
 * Transport: MCP Streamable HTTP, stateless (one ephemeral server+transport per POST).
 * claude.ai reaches this over the public internet, so the endpoint is gated by a
 * secret token that must appear in the URL path:  /<TOKEN>/mcp
 * (claude.ai's connector UI has no custom-header field, so the token lives in the URL;
 *  header-capable clients may instead send  Authorization: Bearer <TOKEN>  to  /mcp ).
 *
 * Env:
 *   KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD, KIWI_INSECURE_TLS   — as in src/index.js
 *   MCP_AUTH_TOKEN      required; the URL/bearer secret. Use >=32 random chars.
 *   MCP_ALLOW_NO_AUTH   set to 1 to start with NO token check (only if the host is
 *                       itself IP-restricted). Refuses to start otherwise.
 *   MCP_HTTP_HOST       bind address (default 127.0.0.1 — expose only via the tunnel)
 *   MCP_HTTP_PORT       bind port (default 8787)
 *   MCP_RATE_PER_MIN    max requests per client IP per minute (default 120)
 */

import crypto from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { KiwiClient } from "./kiwi-client.js";
import { buildServer } from "./server-factory.js";

if (process.env.KIWI_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const TOKEN = process.env.MCP_AUTH_TOKEN || "";
const ALLOW_NO_AUTH = process.env.MCP_ALLOW_NO_AUTH === "1";
const HOST = process.env.MCP_HTTP_HOST || "127.0.0.1";
const PORT = Number(process.env.MCP_HTTP_PORT || 8787);
const RATE_PER_MIN = Number(process.env.MCP_RATE_PER_MIN || 120);

if (!ALLOW_NO_AUTH && TOKEN.length < 32) {
  console.error(
    "Refusing to start: MCP_AUTH_TOKEN must be set to at least 32 characters " +
      "(or set MCP_ALLOW_NO_AUTH=1 if the host is IP-restricted).\n" +
      "Generate one:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
  process.exit(1);
}

// One shared Kiwi client keeps the upstream session warm across requests.
const kiwi = new KiwiClient({
  url: process.env.KIWI_URL,
  username: process.env.KIWI_USERNAME,
  password: process.env.KIWI_PASSWORD,
});

/* ---------- helpers ---------- */

function tokenOk(candidate) {
  if (ALLOW_NO_AUTH) return true;
  if (typeof candidate !== "string" || candidate.length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(TOKEN));
}

const buckets = new Map(); // ip -> { count, resetAt }
function rateLimited(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + 60_000 };
    buckets.set(ip, b);
  }
  b.count += 1;
  return b.count > RATE_PER_MIN;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) if (now >= b.resetAt) buckets.delete(ip);
}, 60_000).unref();

function describe(body) {
  if (Array.isArray(body)) return `batch[${body.length}]`;
  if (!body || typeof body !== "object") return "?";
  if (body.method === "tools/call") return `tools/call ${body.params?.name ?? "?"}`;
  return body.method ?? "?";
}

/* ---------- app ---------- */

const app = express();
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "kiwi-tcms-mcp" }));

function bearer(req) {
  const h = req.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function handleMcpPost(req, res) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({
      jsonrpc: "2.0",
      error: { code: -32029, message: "rate limit exceeded" },
      id: null,
    });
  }

  const supplied = req.params.token ?? bearer(req);
  if (!tokenOk(supplied)) {
    console.error(`[http] 401 ${ip} ${describe(req.body)}`);
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "unauthorized" },
      id: null,
    });
  }

  console.error(`[http] ${ip} ${describe(req.body)}`);

  const server = buildServer(kiwi);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[http] handler error:", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "internal error" },
        id: null,
      });
    }
  }
}

// Stateless server: GET (SSE stream) and DELETE (session teardown) are not supported.
function methodNotAllowed(_req, res) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed (stateless server; use POST)" },
    id: null,
  });
}

app.post("/:token/mcp", handleMcpPost);
app.get("/:token/mcp", methodNotAllowed);
app.delete("/:token/mcp", methodNotAllowed);

// Header-auth variant for clients that can set Authorization (e.g. mcp-remote, CLI).
app.post("/mcp", handleMcpPost);
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, HOST, () => {
  console.error(
    `kiwi-tcms-mcp HTTP listening on http://${HOST}:${PORT}  ` +
      `(auth: ${ALLOW_NO_AUTH ? "DISABLED" : "token"} | rate: ${RATE_PER_MIN}/min/ip)`
  );
  console.error(
    ALLOW_NO_AUTH
      ? "  endpoint path: /<anything>/mcp  or  /mcp"
      : "  endpoint path: /<MCP_AUTH_TOKEN>/mcp   (or POST /mcp with Authorization: Bearer <token>)"
  );
});
