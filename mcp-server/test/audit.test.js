import test from "node:test";
import assert from "node:assert/strict";
import { auditWebsite, evaluateRobots, inspectHtml, LIMITS } from "../src/audit.js";
import { validatePublicUrl } from "../src/url-safety.js";

const html = `<!doctype html><html><head>
  <title>Acme Heating Oxford</title>
  <meta name="description" content="Boiler repair and heating services in Oxford">
  <link rel="canonical" href="https://acme.example/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":["Organization","Service"],"name":"Acme Heating"}</script>
</head><body><h1>Acme Heating</h1><p>Boiler repair across Oxford for homeowners.</p></body></html>`;

function response(body, init = {}) {
  return new Response(body, { status: init.status || 200, headers: { "content-type": init.type || "text/plain", ...(init.headers || {}) } });
}

function fixtureFetch(routes) {
  return async (input) => {
    const url = input instanceof URL ? input.href : String(input);
    const route = routes[url];
    return route instanceof Function ? route() : route || response("missing", { status: 404 });
  };
}

test("blocks local, private and credential-bearing URLs", () => {
  for (const url of ["http://localhost", "http://127.0.0.1", "http://10.1.2.3", "http://100.64.0.1", "http://172.16.0.1", "http://192.168.1.1", "http://198.18.0.1", "http://203.0.113.1", "http://[::1]", "http://[::ffff:127.0.0.1]", "http://[2001:db8::1]", "https://user:pass@example.com"]) {
    assert.throws(() => validatePublicUrl(url));
  }
  assert.equal(validatePublicUrl("https://sr3h.uk").hostname, "sr3h.uk");
});

test("evaluates the specific OAI group before wildcard and honours longest match", () => {
  const rules = `User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\nAllow: /public/`;
  assert.equal(evaluateRobots(rules, "oai-searchbot", "/").allowed, false);
  assert.equal(evaluateRobots(rules, "oai-searchbot", "/public/page").allowed, true);
});

test("supports robots wildcard and end-anchor rules", () => {
  const rules = `User-agent: OAI-SearchBot\nDisallow: /*?private=*\nDisallow: /draft$\nAllow: /draft/preview`;
  assert.equal(evaluateRobots(rules, "oai-searchbot", "/page?private=yes").allowed, false);
  assert.equal(evaluateRobots(rules, "oai-searchbot", "/draft").allowed, false);
  assert.equal(evaluateRobots(rules, "oai-searchbot", "/draft/preview").allowed, true);
});

test("extracts metadata, canonical, noindex and structured-data types", () => {
  const result = inspectHtml(html.replace("Acme Heating Oxford", "Acme Heating &amp; Oxford").replace("</head>", '<meta name="robots" content="noindex"></head>'), "https://acme.example/");
  assert.equal(result.title, "Acme Heating & Oxford");
  assert.equal(result.canonical, "https://acme.example/");
  assert.equal(result.noindex, true);
  assert.deepEqual(result.structuredData.types, ["Organization", "Service"]);
});

test("returns sourced findings, supplied-term evidence and explicit limits", async () => {
  const fetchImpl = fixtureFetch({
    "https://acme.example/": response(html, { type: "text/html; charset=utf-8" }),
    "https://acme.example/robots.txt": response("User-agent: OAI-SearchBot\nAllow: /\nSitemap: https://acme.example/sitemap.xml"),
    "https://acme.example/sitemap.xml": response("<urlset><url><loc>https://acme.example/</loc></url></urlset>", { type: "application/xml" }),
    "https://acme.example/llms.txt": response("# Acme Heating")
  });
  const result = await auditWebsite({ website_url: "https://acme.example", business_name: "Acme Heating", location_or_service_area: "Oxford", priority_services: ["Boiler repair"], target_customer: "Oxford homeowners" }, fetchImpl);
  assert.equal(result.audit.technical_readiness, "clear");
  assert.equal(result.observations.every((item) => item.source_url.startsWith("https://")), true);
  assert.equal(result.supplied_context_presence.every((item) => item.found), true);
  assert.match(result.unknowns.join(" "), /Whether ChatGPT or another AI service will mention/);
  assert.match(result.summary, /does not show whether AI services understand the offer/);
  assert.match(result.next_action, /test five real customer questions/);
  assert.match(result.supplied_context.note, /user-supplied context only/);
});

test("reports blocking directives without presenting a success score", async () => {
  const noindex = html.replace("</head>", '<meta name="robots" content="noindex"></head>');
  const fetchImpl = fixtureFetch({
    "https://blocked.example/": response(noindex, { type: "text/html" }),
    "https://blocked.example/robots.txt": response("User-agent: OAI-SearchBot\nDisallow: /")
  });
  const result = await auditWebsite({ website_url: "https://blocked.example" }, fetchImpl);
  assert.equal(result.audit.technical_readiness, "blocked");
  assert.equal("score" in result.audit, false);
  assert.equal(result.gaps.some((gap) => gap.id === "oai_searchbot_blocked"), true);
  assert.equal(result.gaps.some((gap) => gap.id === "noindex"), true);
});

test("revalidates redirects and rejects a public URL redirecting to a private host", async () => {
  const fetchImpl = fixtureFetch({
    "https://safe.example/": response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } })
  });
  await assert.rejects(() => auditWebsite({ website_url: "https://safe.example" }, fetchImpl), /publicly reachable/);
});

test("rejects oversized responses", async () => {
  const fetchImpl = fixtureFetch({
    "https://large.example/": response("x", { type: "text/html", headers: { "content-length": String(LIMITS.bytes + 1) } })
  });
  await assert.rejects(() => auditWebsite({ website_url: "https://large.example" }, fetchImpl), /larger than/);
});

test("does not treat HTML fallback pages as robots.txt or llms.txt", async () => {
  const fetchImpl = fixtureFetch({
    "https://fallback.example.com/": response(html, { type: "text/html" }),
    "https://fallback.example.com/robots.txt": response(html, { type: "text/html" }),
    "https://fallback.example.com/sitemap.xml": response("missing", { status: 404 }),
    "https://fallback.example.com/llms.txt": response(html, { type: "text/html" })
  });
  const result = await auditWebsite({ website_url: "https://fallback.example.com" }, fetchImpl);
  assert.equal(result.observations.find((item) => item.id === "oai_searchbot").status, "missing");
  assert.match(result.observations.find((item) => item.id === "oai_searchbot").evidence, /returned a webpage instead of crawler rules/);
  assert.equal(result.observations.find((item) => item.id === "llms_txt").status, "missing");
});

test("does not expose subrequest error details in returned evidence", async () => {
  const fetchImpl = fixtureFetch({
    "https://safe-errors.example/": response(html, { type: "text/html" }),
    "https://safe-errors.example/robots.txt": () => { throw new Error("secret-provider-detail-123"); }
  });
  const result = await auditWebsite({ website_url: "https://safe-errors.example" }, fetchImpl);
  const robots = result.observations.find((item) => item.id === "oai_searchbot");
  assert.match(robots.evidence, /could not be checked from this service/);
  assert.doesNotMatch(JSON.stringify(result), /secret-provider-detail-123/);
});

test("bounds page metadata and ignores malformed canonicals", () => {
  const result = inspectHtml(`<html><head><title>${"x".repeat(600)}</title><meta name="description" content="${"y".repeat(900)}"><link rel="canonical" href="javascript:alert(1)"></head></html>`, "https://safe.example.com/");
  assert.equal(result.title.length, 300);
  assert.equal(result.description.length, 500);
  assert.equal(result.canonical, null);
});

test("collects a bounded same-origin context without exposing it by default", async () => {
  const linked = html.replace("</body>", '<a href="/services">Services</a><a href="https://other.example/about">Elsewhere</a></body>');
  const fetchImpl = fixtureFetch({
    "https://acme.example/": () => response(linked, { type: "text/html" }),
    "https://acme.example/services": () => response("<html><head><title>Services</title></head><body>Boiler repair plans and evidence.</body></html>", { type: "text/html" })
  });
  const normal = await auditWebsite({ website_url: "https://acme.example" }, fetchImpl);
  assert.equal("_analysis_context" in normal, false);
  const enriched = await auditWebsite({ website_url: "https://acme.example" }, fetchImpl, { includeAnalysisContext: true });
  assert.deepEqual(enriched._analysis_context.pages.map((item) => item.url), ["https://acme.example/", "https://acme.example/services"]);
  assert.equal(enriched._analysis_context.pages.length <= LIMITS.contextPages, true);
});
