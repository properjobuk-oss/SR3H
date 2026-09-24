import test from "node:test";
import assert from "node:assert/strict";
import { publicReferences, richResultTypes } from "../src/public-readiness.js";
import { auditWebsite } from "../src/audit.js";

test("connection references require public links, not scripts, private URLs or passing mentions", () => {
  const references = publicReferences(`<p>We discuss MCP and API trends.</p><script><a href="/mcp">MCP</a></script><a href="http://localhost/api">API</a><a href="/docs/mcp">Connect</a><a href="https://docs.example.com/api">API docs</a><a href="/integrations/chatgpt">ChatGPT app</a>`, "https://example.com/");
  assert.deepEqual(references, { mcp: "https://example.com/docs/mcp", api: "https://docs.example.com/api", plugin: "https://example.com/integrations/chatgpt" });
  assert.deepEqual(publicReferences("<p>API MCP</p>", "https://example.com/"), {});
});

test("rich-result markup needs a recognised type with basic fields", () => {
  const markup = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  assert.deepEqual(richResultTypes(markup({ "@type": "Service", name: "Consulting" })), []);
  assert.deepEqual(richResultTypes(markup({ "@type": "Product" })), []);
  assert.deepEqual(richResultTypes(markup({ "@graph": [{ "@type": "Organization", name: "Acme" }, { "@type": "Product", name: "Tool" }] })), ["Organization", "Product"]);
});

test("public document detection distinguishes valid, absent and inaccessible endpoints", async () => {
  const run = async apiStatus => auditWebsite({ website_url: "https://example.com/" }, async input => {
    const path = new URL(input).pathname;
    if (path === "/") return new Response('<title>Acme</title><meta name="description" content="Tools">', { headers: { "content-type": "text/html" } });
    if (path === "/openapi.json") return new Response(JSON.stringify({ openapi: "3.1.0", paths: {} }), { status: apiStatus, headers: { "content-type": "application/json" } });
    return new Response("missing", { status: 404 });
  });
  const found = await run(200);
  assert.equal(found.observations.find(item => item.id === "api").status, "clear");
  assert.equal(found.observations.find(item => item.id === "plugin").status, "missing");
  assert.equal(found.observations.find(item => item.id === "search_access").status, "clear");
  const blocked = await run(403);
  assert.equal(blocked.observations.find(item => item.id === "api").status, "unverified");
});
