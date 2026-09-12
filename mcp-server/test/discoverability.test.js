import test from "node:test";
import assert from "node:assert/strict";
import { checkDiscoverability, combineDiscoverabilityResult, DISCOVERABILITY_LIMITS } from "../src/discoverability.js";

const input = {
  website_url: "https://proper-job.example",
  business_name: "Proper Job",
  location_or_service_area: "United Kingdom",
  priority_services: ["building estimates from architectural drawings"]
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
    observed_in_search: index === 0,
    search_evidence_url: index === 0 ? "https://search.example/proper-job" : null,
    finding: index === 0 ? "Proper Job appeared in the branded search." : "Proper Job was not observed in this search sample."
  })),
  important_findings: ["The offer is clear.", "Unbranded discovery is the main gap."],
  best_next_step: "Check indexing and impressions for the existing service pages."
};

test("returns a clear fallback when the model service is not configured", async () => {
  const result = await checkDiscoverability(input, audit, {});
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "not_configured");
});

test("uses bounded search, structured output and disabled API storage", async () => {
  let requestBody;
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      output: [
        { type: "web_search_call", action: { sources: [{ url: "https://search.example/proper-job" }] } },
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(modelResult) }] }
      ]
    }), { headers: { "content-type": "application/json" } });
  };
  const result = await checkDiscoverability(input, audit, { OPENAI_API_KEY: "not-a-real-key" }, fetchImpl);
  assert.equal(result.status, "complete");
  assert.equal(result.questions.length, 6);
  assert.deepEqual(result.sources, ["https://search.example/proper-job"]);
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.max_tool_calls, DISCOVERABILITY_LIMITS.maxToolCalls);
  assert.equal(requestBody.max_output_tokens, DISCOVERABILITY_LIMITS.maxOutputTokens);
  assert.deepEqual(requestBody.tools, [{ type: "web_search" }]);
  assert.equal(requestBody.text.format.strict, true);
  assert.match(requestBody.input, /Proper Job/);
  assert.doesNotMatch(requestBody.input, /generic example searches/i);
});

test("provider or invalid-output errors do not break the technical result", async () => {
  const fetchImpl = async () => new Response("provider detail secret", { status: 500 });
  const discovery = await checkDiscoverability(input, audit, { OPENAI_API_KEY: "not-a-real-key" }, fetchImpl);
  const result = combineDiscoverabilityResult(audit, discovery);
  assert.equal(result.discoverability.status, "unavailable");
  assert.equal(result.audit.technical_readiness, "clear");
  assert.equal("_analysis_context" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /provider detail secret/);
});

test("rejects unsupported positive discovery claims", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output: [
      { type: "web_search_call", action: { sources: [{ url: "https://different.example/result" }] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(modelResult) }] }
    ]
  }), { headers: { "content-type": "application/json" } });
  const result = await checkDiscoverability(input, audit, { OPENAI_API_KEY: "not-a-real-key" }, fetchImpl);
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "provider_or_output_error");
});

test("combines exact counts without inventing a score", () => {
  const discovery = { status: "complete", checked_at: new Date().toISOString(), model: "test", sources: [], limits: [], ...modelResult };
  const result = combineDiscoverabilityResult(audit, discovery);
  assert.deepEqual(result.snapshot.discovery, { branded_found: 1, branded_checked: 1, unbranded_found: 0, unbranded_checked: 5 });
  assert.deepEqual(result.snapshot.understanding, { answered: 5, checked: 6 });
  assert.equal("score" in result.snapshot.discovery, false);
  assert.equal("_analysis_context" in result, false);
});
