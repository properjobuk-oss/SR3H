import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createServer, createWorker, handleRequest } from "../src/index.js";

const page = `<!doctype html><html><head><title>Test Co</title><meta name="description" content="A test service"><link rel="canonical" href="https://test.example/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Test Co"}</script></head><body>Test Co in Oxford</body></html>`;

const fetchImpl = async (input) => {
  const url = input instanceof URL ? input.href : String(input);
  if (url === "https://test.example/") return new Response(page, { headers: { "content-type": "text/html" } });
  if (url === "https://test.example/robots.txt") return new Response("User-agent: OAI-SearchBot\nAllow: /");
  if (url === "https://test.example/sitemap.xml") return new Response("<urlset></urlset>", { headers: { "content-type": "application/xml" } });
  return new Response("missing", { status: 404 });
};

test("MCP client initializes and completes its workflow without using the SR3H OpenAI API", async () => {
  const requestedUrls = [];
  const trackedFetch = async (input, init) => {
    const url = input instanceof URL ? input.href : String(input);
    requestedUrls.push(url);
    if (url.startsWith("https://api.openai.com/")) throw new Error("MCP must not call the OpenAI API");
    return fetchImpl(input, init);
  };
  const server = createServer(trackedFetch, { OPENAI_API_KEY: "must-not-be-used" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listTools();
    assert.equal(client.getServerVersion().name, "AIDO by SR3H");
    assert.equal(client.getServerVersion().version, "0.11.0");
    assert.deepEqual(client.getServerCapabilities().extensions?.["io.modelcontextprotocol/skills"], {});
    assert.equal(listed.tools.length, 3);
    const checkTool = listed.tools.find((tool) => tool.name === "check_ai_presence");
    const prepareTool = listed.tools.find((tool) => tool.name === "prepare_ai_discovery_research");
    const summaryTool = listed.tools.find((tool) => tool.name === "summarise_ai_discovery_research");
    assert.equal(checkTool.annotations.readOnlyHint, true);
    assert.equal(checkTool.annotations.openWorldHint, true);
    assert.match(checkTool.description, /overlooking a business/i);
    assert.match(checkTool.description, /AEO or GEO/i);
    assert.equal(checkTool.outputSchema.type, "object");
    assert.equal(prepareTool.annotations.readOnlyHint, true);
    assert.equal(prepareTool.annotations.openWorldHint, true);
    assert.equal(summaryTool.annotations.openWorldHint, false);
    assert.equal(checkTool._meta.ui.resourceUri, "ui://aido/discoverability-report-v5.html");
    assert.equal(summaryTool._meta.ui.resourceUri, "ui://aido/discoverability-report-v5.html");
    assert.match(checkTool.inputSchema.properties.location_or_service_area.description, /only when the user explicitly supplied it/i);
    assert.match(checkTool.inputSchema.properties.priority_services.description, /never infer/i);
    assert.match(checkTool.inputSchema.properties.target_customer.description, /never infer/i);
    assert.match(prepareTool.inputSchema.properties.priority_services.description, /explicitly supplied or confirmed/i);
    assert.equal(prepareTool._meta?.ui?.resourceUri, undefined);

    const called = await client.callTool({ name: "check_ai_presence", arguments: {
      website_url: "https://test.example",
      business_name: "Test Co",
      location_or_service_area: "Oxford",
      priority_services: ["A test service"],
      target_customer: "Oxford organisations"
    } });
    assert.notEqual(called.isError, true);
    assert.equal(called.structuredContent.audit.technical_readiness, "clear");
    assert.deepEqual(called.structuredContent.supplied_context_presence, [
      { term: "Test Co", found: true },
      { term: "Oxford", found: true },
      { term: "A test service", found: true }
    ]);
    assert.deepEqual(called.structuredContent.supplied_context, {
      target_customer: "Oxford organisations",
      note: "Recorded as user-supplied context only; this crawl does not validate demand or customer fit."
    });
    assert.match(called.content[0].text, /^AI search crawlers can access this website/);
    assert.equal(called.content[0].text.length < 500, true);
    assert.equal("discoverability" in called.structuredContent, false);
    assert.equal("snapshot" in called.structuredContent, false);
    assert.equal(called.structuredContent.presentation.status, "clear");
    assert.match(called.structuredContent.presentation.limitations_note, /does not show whether an AI assistant will mention or recommend/i);

    const prepared = await client.callTool({ name: "prepare_ai_discovery_research", arguments: {
      website_url: "https://test.example",
      business_name: "Test Co",
      location_or_service_area: "Oxford",
      priority_services: ["test services"],
      target_customer: "Oxford organisations"
    } });
    assert.notEqual(prepared.isError, true);
    assert.equal(prepared.structuredContent.status, "ready");
    assert.equal(prepared.structuredContent.questions.length, 10);
    assert.match(prepared.structuredContent.usage_note, /no SR3H OpenAI API calls/i);
    assert.equal(requestedUrls.some((url) => url.startsWith("https://api.openai.com/")), false);

    const summarised = await client.callTool({ name: "summarise_ai_discovery_research", arguments: {
      website_url: "https://test.example",
      business_name: "Test Co",
      observations: [{
        question_id: "q2",
        question: "Which test service should I use?",
        kind: "category",
        checked_at: "2026-09-12T12:00:00.000Z",
        appearance: "not_seen",
        answer_summary: "Other services were discussed.",
        evidence_urls: ["https://source.example/result"],
        other_providers: ["Another Co"]
      }]
    } });
    assert.notEqual(summarised.isError, true);
    assert.equal(summarised.structuredContent.sample.completed, 1);
    assert.equal(summarised.structuredContent.sample.unbranded_found, 0);
    assert.deepEqual(summarised.structuredContent.source_urls, ["https://source.example/result"]);
    assert.equal(summarised.structuredContent.status, "partial");
    assert.equal(summarised.structuredContent.presentation.status, "incomplete");
    assert.equal(summarised.structuredContent.presentation.attribution, "AIDO by SR3H");
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
  const healthBody = await health.json();
  assert.equal(healthBody.service, "AIDO by SR3H");
  assert.equal(healthBody.version, "0.11.0");

  const missing = await handleRequest(new Request("https://mcp.example/nope"));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("referrer-policy"), "no-referrer");

  const head = await handleRequest(new Request("https://mcp.example/health", { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("access-control-allow-methods"), /HEAD/);
});

test("rate limits tool calls without logging or returning submitted data", async () => {
  const receivedKeys = [];
  const limiter = { limit: async ({ key }) => { receivedKeys.push(key); return { success: false }; } };
  const request = new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 17, method: "tools/call", params: { name: "check_ai_presence", arguments: { website_url: "https://private-business.example" } } })
  });
  const result = await handleRequest(request, { AUDIT_RATE_LIMITER: limiter });
  const body = await result.text();
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("retry-after"), "60");
  assert.deepEqual(receivedKeys.sort(), ["audit-ip:203.0.113.10", "audit-target:private-business.example"]);
  assert.match(body, /Rate limit exceeded/);
  assert.doesNotMatch(body, /private-business/);
});

test("website checker returns a bounded audit to an allowed SR3H origin", async () => {
  const limiterKeys = [];
  const limiter = { limit: async ({ key }) => { limiterKeys.push(key); return { success: true }; } };
  const request = new Request("https://mcp.example/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://sr3h.uk",
      "cf-connecting-ip": "203.0.113.22"
    },
    body: JSON.stringify({
      website_url: "https://test.example",
      business_name: "Test Co",
      location_or_service_area: "Oxford",
      priority_services: ["A test service"],
      target_customer: "Oxford organisations"
    })
  });
  const response = await handleRequest(request, { AUDIT_RATE_LIMITER: limiter }, fetchImpl);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://sr3h.uk");
  assert.equal(body.result.audit.technical_readiness, "clear");
  assert.equal(body.result.discoverability.status, "unavailable");
  assert.equal(body.result.supplied_context.target_customer, "Oxford organisations");
  assert.deepEqual(body.result.supplied_context_presence, [
    { term: "Test Co", found: true },
    { term: "Oxford", found: true },
    { term: "A test service", found: true }
  ]);
  assert.equal("_analysis_context" in body.result, false);
  assert.equal("score" in body.result.audit, false);
  assert.deepEqual(limiterKeys.sort(), ["web-check-ip:203.0.113.22", "web-check-target:test.example"]);
});

test("website checker limits the paid discovery layer separately", async () => {
  const discoveryKeys = [];
  const allow = { limit: async () => ({ success: true }) };
  const discoveryLimiter = { limit: async ({ key }) => { discoveryKeys.push(key); return { success: false }; } };
  const response = await handleRequest(new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://sr3h.uk", "cf-connecting-ip": "203.0.113.50" },
    body: JSON.stringify({ website_url: "https://test.example" })
  }), { WEB_RATE_LIMITER: allow, DISCOVERY_RATE_LIMITER: discoveryLimiter, OPENAI_API_KEY: "test-key" }, fetchImpl);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.discoverability.status, "unavailable");
  assert.equal(body.result.discoverability.reason, "rate_limited");
  assert.deepEqual(discoveryKeys.sort(), ["discovery-ip:203.0.113.50", "discovery-target:test.example"]);
});

test("Cloudflare execution context is not mistaken for the audit fetch function", async () => {
  const worker = createWorker(fetchImpl);
  const request = new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://sr3h.uk" },
    body: JSON.stringify({ website_url: "https://test.example" })
  });
  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.result.audit.final_url, "https://test.example/");
});

test("website checker rejects unapproved browser origins and honeypot submissions", async () => {
  const wrongOrigin = await handleRequest(new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://attacker.example" },
    body: JSON.stringify({ website_url: "https://test.example" })
  }), {}, fetchImpl);
  assert.equal(wrongOrigin.status, 403);
  assert.equal(wrongOrigin.headers.get("access-control-allow-origin"), null);

  const honeypot = await handleRequest(new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://sr3h.uk" },
    body: JSON.stringify({ website_url: "https://test.example", company_website: "filled-by-bot" })
  }), {}, fetchImpl);
  assert.equal(honeypot.status, 400);
  assert.doesNotMatch(await honeypot.text(), /filled-by-bot/);
});

test("website checker rejects oversized requests before parsing", async () => {
  const response = await handleRequest(new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://sr3h.uk", "content-length": "8001" },
    body: "{}"
  }), {}, fetchImpl);
  assert.equal(response.status, 413);
  assert.match(await response.text(), /too large/i);
});

test("website checker uses its stricter public rate limit and fails closed", async () => {
  const webLimiter = { limit: async () => ({ success: false }) };
  const auditLimiter = { limit: async () => ({ success: true }) };
  const response = await handleRequest(new Request("https://mcp.example/check", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://sr3h.uk" },
    body: JSON.stringify({ website_url: "https://test.example" })
  }), { WEB_RATE_LIMITER: webLimiter, AUDIT_RATE_LIMITER: auditLimiter }, fetchImpl);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("rejects oversized MCP requests before protocol parsing", async () => {
  const result = await handleRequest(new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "64001" },
    body: "{}"
  }));
  assert.equal(result.status, 413);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.match(await result.text(), /64 KB limit/);
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

test("extended summary refuses unsupported positive appearances", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const called = await client.callTool({ name: "summarise_ai_discovery_research", arguments: {
      website_url: "https://test.example",
      business_name: "Test Co",
      observations: [{ question_id: "q2", question: "Which test service should I use?", kind: "category", checked_at: "2026-09-12T12:00:00.000Z", appearance: "recommended", evidence_urls: ["https://source.example/result"] }]
    } });
    assert.equal(called.isError, true);
    const unsupportedProvider = await client.callTool({ name: "summarise_ai_discovery_research", arguments: {
      website_url: "https://test.example",
      business_name: "Test Co",
      observations: [{ question_id: "q2", question: "Which test service should I use?", kind: "category", checked_at: "2026-09-12T12:00:00.000Z", appearance: "not_seen", evidence_urls: [], other_providers: ["Another Co"] }]
    } });
    assert.equal(unsupportedProvider.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP advertises and serves the importable AIDO skill with verified digests", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "skill-import-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const catalog = await client.request(
      { method: "skills/list", params: {} },
      z.object({ skills: z.array(z.object({ uri: z.string(), frontmatter: z.record(z.string()), resources: z.array(z.object({ uri: z.string(), digest: z.string() })) })) })
    );
    assert.equal(catalog.skills.length, 1);
    assert.equal(catalog.skills[0].frontmatter.name, "aido-discoverability-check");
    assert.equal(catalog.skills[0].resources.length, 3);

    const fetched = await client.request(
      { method: "skills/get", params: { uri: catalog.skills[0].uri } },
      z.object({ skill: z.object({ uri: z.string(), frontmatter: z.record(z.string()), resources: z.array(z.object({ uri: z.string(), digest: z.string() })) }) })
    );
    assert.deepEqual(fetched.skill, catalog.skills[0]);

    for (const item of catalog.skills[0].resources) {
      const resource = await client.readResource({ uri: item.uri });
      assert.equal(resource.contents.length, 1);
      assert.equal(resource.contents[0].uri, item.uri);
      const digest = `sha256:${createHash("sha256").update(resource.contents[0].text, "utf8").digest("hex")}`;
      assert.equal(digest, item.digest);
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test("AIDO report resource is self-contained, safe and linked directly to result tools", async () => {
  const server = createServer(fetchImpl);
  const client = new Client({ name: "ui-resource-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const resources = await client.listResources();
    const report = resources.resources.find((item) => item.uri === "ui://aido/discoverability-report-v5.html");
    assert.ok(report);
    assert.equal(report.mimeType, "text/html;profile=mcp-app");
    assert.deepEqual(report._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
    assert.equal(report._meta.ui.domain, "https://mcp.sr3h.uk");

    const result = await client.readResource({ uri: report.uri });
    assert.equal(result.contents.length, 1);
    assert.equal(result.contents[0].mimeType, "text/html;profile=mcp-app");
    assert.deepEqual(result.contents[0]._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
    const html = result.contents[0].text;
    assert.match(html, /ui\/initialize/);
    assert.match(html, /ui\/notifications\/initialized/);
    assert.match(html, /ui\/notifications\/tool-result/);
    assert.match(html, /ui\/notifications\/size-changed/);
    assert.match(html, /protocolVersion:\s*"2026-01-26"/);
    assert.match(html, /jsonrpc:\s*"2\.0"/);
    assert.ok(html.indexOf('window.addEventListener("message"') < html.indexOf("connect();"));
    assert.doesNotMatch(html, /ui\/notifications\/tool-input/);
    assert.match(html, /\.textContent\s*=/);
    assert.doesNotMatch(html, /<script[^>]+src=/i);
    assert.doesNotMatch(html, /<link[^>]+(?:stylesheet|preload)/i);
    assert.doesNotMatch(html, /sk-[a-z0-9_-]+/i);
  } finally {
    await client.close();
    await server.close();
  }
});
