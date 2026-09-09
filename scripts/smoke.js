#!/usr/bin/env node
/**
 * Connectivity + auth smoke test. Runs against the real Kiwi instance.
 *
 * Usage (PowerShell):
 *   $env:KIWI_URL="https://kiwi.example.com"
 *   $env:KIWI_USERNAME="you@example.com"
 *   $env:KIWI_PASSWORD="..."
 *   npm run smoke
 *
 * Add  $env:KIWI_INSECURE_TLS="1"  if the :8443 cert is not trusted by Node.
 */
import { KiwiClient } from "../src/kiwi-client.js";

if (process.env.KIWI_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const client = new KiwiClient({
  url: process.env.KIWI_URL,
  username: process.env.KIWI_USERNAME,
  password: process.env.KIWI_PASSWORD,
});

try {
  const version = await client.call("KiwiTCMS.version", []).catch(() => null);
  console.log("Auth OK. Session established.");
  if (version) console.log("Kiwi version:", version);

  const products = await client.call("Product.filter", [{}]);
  const list = Array.isArray(products) ? products : [products];
  console.log(`Product.filter returned ${list.length} product(s):`);
  for (const p of list.slice(0, 20)) {
    console.log(`  #${p.id}  ${p.name}`);
  }
  process.exit(0);
} catch (err) {
  console.error("SMOKE TEST FAILED:", err.message);
  process.exit(1);
}
