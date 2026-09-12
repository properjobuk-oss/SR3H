import test from "node:test";
import assert from "node:assert/strict";
import { checkDiscoverability, combineDiscoverabilityResult, DISCOVERABILITY_LIMITS } from "../src/discoverability.js";

const input = {
  website_url: "https://proper-job.example",
  business_name: "Proper Job",
  location_or_service_area: "United Kingdom",
  priority_services: ["building estimates from architectural drawings"],
  target_customer: "UK builders and homeowners planning building work"
};
const paidEnv = {
  OPENAI_API_KEY: 'not-a-real-key',
  USAGE_GUARD: { idFromName: () => 'test', get: () => ({ fetch: async () => Response.json({ allowed: true }) }) }
};
const audit = {
  audit: { requested_url: input.website_url, final_url: "https://proper-job.example/", checked_at: new Date().toISOString(), technical_readiness: "clear" },
  summary: "Technical check complete.",
  observations: ["reachability", "https", "oai_searchbot", "indexing", "sitemap"].map((id) => ({ id, label: id, status: "clear", evidence: "Clear", source_url: "https://proper-job.example/" })),
  supplied_context_presence: [],
  supplied_context: { target_customer: null, note: null },
  gaps: [],
  unknowns: [],
  next_action: "Test questions.",
  deeper_analysis: "Contact SR3H.",
  _analysis_context: { pages: [{ url: "https://proper-job.example/", title: "Proper Job", description: "Building estimates", text: "Create guide prices and detailed estimates from architectural drawings." }] }
};

const kinds = ["branded", "unbranded_category", "unbranded_problem", "unbranded_high_intent", "unbranded_differentiator", "unbranded_location"];
const modelResult = {
  business: "Proper Job",
  summary: "The site explains its offer, but appeared only when searched by name.",
  questions: kinds.map((kind, index) => ({
    question: index === 0 ? "What does Proper Job do?" : `How can I compare a building estimate ${index}?`,
    kind,
    site_answered: index < 5,
    site_evidence_url: "https://proper-job.example/",
    appearance: index === 0 ? "mentioned" : "not_seen",
    search_evidence_url: index === 0 ? "https://search.example/proper-job" : null,
    answer_summary: index === 0 ? "The answer named Proper Job and described its estimating service." : "The answer discussed other ways to compare building estimates.",
    finding: index === 0 ? "Proper Job appeared in the branded search." : "Proper Job was not observed in this search sample."
  })),
  important_findings: ["The offer is clear.", "Unbranded discovery is the main gap."],
  best_next_step: "Check indexing and impressions for the existing service pages."
};
const planResult = {
  business: modelResult.business,
  summary: modelResult.summary,
  questions: modelResult.questions.map(({ question, kind, site_answered, site_evidence_url }) => ({ question, kind, site_answered, site_evidence_url }))
};

test("returns a clear fallback when the model service is not configured", async () => {
  const result = await checkDiscoverability(input, audit, {});
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "not_configured");
});

test("does not call the paid provider when the persistent allowance is exhausted", async () => {
  const usageGuard = {
    idFromName: () => "guard-id",
    get: () => ({ fetch: async () => Response.json({ allowed: false, reason: "global_daily_limit" }) })
  };
  const result = await checkDiscoverability(input, audit, {
    OPENAI_API_KEY: "test-key",
    USAGE_GUARD: usageGuard
  }, async () => { throw new Error("provider must not be called"); }, { visitor: "visitor-a" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "global_daily_limit");
  assert.match(result.note, /allowance has been used/i);
});

test("uses bounded search, structured output and disabled API storage", async () => {
  const requestBodies = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const requestBody = JSON.parse(init.body);
    requestBodies.push(requestBody);
    if (!requestBody.tools) {
      return new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(planResult) }] }]
      }), { headers: { "content-type": "application/json" } });
    }
    const isBranded = requestBody.input.includes("What does Proper Job do?");
    return new Response(JSON.stringify({
      output: [
        { type: "web_search_call", action: { sources: [{ url: isBranded ? "https://search.example/proper-job" : "https://competitor.example/result" }] } },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify({
          answer: isBranded ? "Proper Job provides building estimates." : "Several estimating services are available.",
          providers: isBranded ? [{ name: "Proper Job", url: "https://search.example/proper-job", appearance: "mentioned" }] : []
        }) }] }
      ]
    }), { headers: { "content-type": "application/json" } });
  };
  const result = await checkDiscoverability(input, audit, paidEnv, fetchImpl);
  assert.equal(result.status, "complete");
  assert.equal(result.questions.length, 6);
  assert.equal(requestBodies.length, 7);
  const [planBody, ...searchBodies] = requestBodies;
  assert.equal(planBody.store, false);
  assert.equal(planBody.max_output_tokens, DISCOVERABILITY_LIMITS.maxOutputTokens);
  assert.equal(planBody.tools, undefined);
  assert.equal(planBody.text.format.strict, true);
  assert.match(planBody.input, /Proper Job/);
  assert.match(planBody.input, /United Kingdom/);
  assert.match(planBody.input, /building estimates from architectural drawings/);
  assert.match(planBody.input, /UK builders and homeowners planning building work/);
  for (const searchBody of searchBodies) {
    assert.equal(searchBody.store, false);
    assert.equal(searchBody.max_tool_calls, DISCOVERABILITY_LIMITS.maxToolCalls);
    assert.equal(searchBody.max_output_tokens, DISCOVERABILITY_LIMITS.searchOutputTokens);
    assert.deepEqual(searchBody.tools, [{ type: "web_search" }]);
    assert.equal(searchBody.tool_choice, "required");
  }
});

test("provider or invalid-output errors do not break the technical result", async () => {
  const fetchImpl = async () => new Response("provider detail secret", { status: 500 });
  const discovery = await checkDiscoverability(input, audit, paidEnv, fetchImpl);
  const result = combineDiscoverabilityResult(audit, discovery);
  assert.equal(result.discoverability.status, "unavailable");
  assert.equal(result.audit.technical_readiness, "clear");
  assert.equal("_analysis_context" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /provider detail secret/);
});

test("does not count provider claims without matching returned source evidence", async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (!body.tools) return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(planResult) }] }] });
    return Response.json({ output: [
      { type: "web_search_call", action: { sources: [{ url: "https://different.example/result" }] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ answer: "Proper Job is recommended.", providers: [{ name: "Proper Job", url: "https://unsupported.example/proper-job", appearance: "recommended" }] }) }] }
    ] });
  };
  const result = await checkDiscoverability(input, audit, paidEnv, fetchImpl);
  assert.equal(result.status, "complete");
  assert.ok(result.questions.every((question) => question.appearance === "not_seen"));
});

test("combines exact counts without inventing a score", () => {
  const discovery = { status: "complete", checked_at: new Date().toISOString(), model: "test", sources: [], limits: [], ...modelResult };
  const result = combineDiscoverabilityResult(audit, discovery);
  assert.deepEqual(result.snapshot.discovery, { branded_found: 1, branded_checked: 1, unbranded_found: 0, unbranded_checked: 5, branded_recommended: 0, unbranded_recommended: 0 });
  assert.deepEqual(result.snapshot.understanding, { answered: 5, checked: 6 });
  assert.equal("score" in result.snapshot.discovery, false);
  assert.equal("_analysis_context" in result, false);
  assert.equal(result.summary, "Proper Job was found by name, but did not appear in five customer-need questions.");
});
