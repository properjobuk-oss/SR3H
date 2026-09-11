import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, handleRequest } from "../src/index.js";

const page = `<!doctype html><html><head><title>Test Co</title><meta name="description" content="A test service"><link rel="canonical" href="https://test.example/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test Co"}</script></head><body>Test Co in Oxford</body></html>`;

const fetchImpl = async (input) => {
  const url = input instanceof URL ? input.href : String(input);
  if (url === "https://test.example/") return new Response(page, { headers: { "content-type": "text/html" } });
  if (url === "https://test.example/robots.txt") return new Response("User-agent: OAI-SearchBot\nAllow: /");
  if (url === "https://test.example/sitemap.xml") return new Response("<urlset></urlset>", { headers: { "content-type": "application/xml" } });
  return new Response("missing", { status: 404 });
};

test("MCP client initializes, lists the annotated tool and calls it", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listTools();
    assert.equal(client.getServerVersion().version, "0.2.0");
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools[0].name, "check_ai_presence");
    assert.equal(listed.tools[0].annotations.readOnlyHint, true);
    assert.equal(listed.tools[0].annotations.openWorldHint, true);
    assert.equal(listed.tools[0].outputSchema.type, "object");

    const called = await client.callTool({ name: "check_ai_presence", arguments: { website_url: "https://test.example" } });
    assert.notEqual(called.isError, true);
    assert.equal(called.structuredContent.audit.technical_readiness, "clear");
    assert.match(called.content[0].text, /^CLEAR:/);
    assert.equal(called.content[0].text.length < 500, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP tool returns a bounded error for private URLs", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const called = await client.callTool({ name: "check_ai_presence", arguments: { website_url: "http://127.0.0.1" } });
    assert.equal(called.isError, true);
    assert.match(called.content[0].text, /invalid_url/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP tool does not expose upstream error details", async () => {
  const sensitiveFetch = async () => {
    throw new Error("connect failed for https://customer.example/private-token-123");
  };
  const server = createServer(sensitiveFetch);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const called = await client.callTool({ name: "check_ai_presence", arguments: { website_url: "https://customer.example" } });
    assert.equal(called.isError, true);
    assert.match(called.content[0].text, /fetch_failed/);
    assert.doesNotMatch(called.content[0].text, /private-token-123/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("HTTP health and error responses carry production safety headers", async () => {
  const health = await handleRequest(new Request("https://mcp.example/health"));
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await health.json()).version, "0.2.0");

  const missing = await handleRequest(new Request("https://mcp.example/nope"));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("referrer-policy"), "no-referrer");

  const head = await handleRequest(new Request("https://mcp.example/health", { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("access-control-allow-methods"), /HEAD/);
});

test("rate limits tool calls without logging or returning submitted data", async () => {
  const limiter = { limit: async () => ({ success: false }) };
  const request = new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 17, method: "tools/call", params: { name: "check_ai_presence", arguments: { website_url: "https://private-business.example" } } })
  });
  const result = await handleRequest(request, { AUDIT_RATE_LIMITER: limiter });
  const body = await result.text();
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("retry-after"), "60");
  assert.match(body, /Rate limit exceeded/);
  assert.doesNotMatch(body, /private-business/);
});

test("MCP schema rejects unsupported protocols and excessive service lists", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const protocol = await client.callTool({ name: "check_ai_presence", arguments: { website_url: "file:///etc/passwd" } });
    assert.equal(protocol.isError, true);
    const tooMany = await client.callTool({ name: "check_ai_presence", arguments: { website_url: "https://test.example", priority_services: Array.from({ length: 9 }, (_, index) => `Service ${index}`) } });
    assert.equal(tooMany.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});
