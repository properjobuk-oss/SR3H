import test from "node:test";
import assert from "node:assert/strict";
import { EXTENDED_RESEARCH_LIMITS, prepareExtendedResearch, RESEARCH_KINDS, summariseExtendedResearch } from "../src/extended-research.js";

const input = {
  website_url: "https://proper-job.example",
  business_name: "Proper Job",
  location_or_service_area: "United Kingdom",
  priority_services: ["building estimates from architectural drawings"],
  target_customer: "UK builders and homeowners planning building work"
};
const audit = {
  audit: { final_url: "https://proper-job.example/" },
  _analysis_context: {
    pages: [{
      url: "https://proper-job.example/",
      title: "Proper Job",
      description: "Price building work with confidence",
      text: "Create an early guide price or detailed estimate from architectural drawings for UK building work."
    }]
  }
};
const questions = RESEARCH_KINDS.map((kind, index) => ({
  kind,
  question: kind === "branded"
    ? "Can Proper Job create a building estimate from architectural drawings?"
    : `Which service can help with ${kind.replace("_", " ")} when pricing building work question ${index}?`
}));

test("extended research planner is explicit when it is not configured", async () => {
  const result = await prepareExtendedResearch(input, audit, {});
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "not_configured");
});

test("prepares ten neutral questions without running web search", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ business: "Proper Job", questions }) }] }] });
  };
  const result = await prepareExtendedResearch(input, audit, { OPENAI_API_KEY: "test-key" }, fetchImpl, { visitor: "test" });
  assert.equal(result.status, "ready");
  assert.equal(result.question_count, 10);
  assert.equal(result.user_confirmation_required, true);
  assert.equal(result.questions.length, 10);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.equal(requests[0].body.store, false);
  assert.equal(requests[0].body.tools, undefined);
  assert.equal(requests[0].body.max_output_tokens, EXTENDED_RESEARCH_LIMITS.maxOutputTokens);
  assert.equal(requests[0].body.text.format.strict, true);
  assert.ok(result.questions.filter((item) => item.kind !== "branded").every((item) => !/proper job|proper-job/i.test(item.question)));
  assert.match(result.search_note, /No extended searches have been run/);
});

test("rejects a plan that leaks the target into an unbranded question", async () => {
  const leaked = questions.map((item) => item.kind === "category" ? { ...item, question: "Why should I use Proper Job for an estimate?" } : item);
  const fetchImpl = async () => Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ business: "Proper Job", questions: leaked }) }] }] });
  const result = await prepareExtendedResearch(input, audit, { OPENAI_API_KEY: "test-key" }, fetchImpl);
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "provider_or_output_error");
});

test("does not call the planner when the persistent allowance is exhausted", async () => {
  const usageGuard = {
    idFromName: () => "guard-id",
    get: () => ({ fetch: async () => Response.json({ allowed: false, reason: "visitor_daily_limit" }) })
  };
  const result = await prepareExtendedResearch(input, audit, {
    OPENAI_API_KEY: "test-key",
    USAGE_GUARD: usageGuard
  }, async () => { throw new Error("planner must not be called"); }, { visitor: "visitor-a" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "visitor_daily_limit");
});

test("summarises observed results without inventing a score", () => {
  const observations = questions.map((item, index) => ({
    ...item,
    appearance: index === 0 ? "mentioned" : index === 3 ? "recommended" : index === 4 ? "source_only" : "not_seen",
    answer_summary: "A bounded test answer.",
    evidence_urls: index < 5 ? ["https://evidence.example/result"] : [],
    other_providers: index > 4 ? ["Other Estimate Co"] : []
  }));
  const result = summariseExtendedResearch({
    website_url: input.website_url,
    business_name: input.business_name,
    observations
  });
  assert.equal(result.sample.completed, 10);
  assert.equal(result.sample.branded_found, 1);
  assert.equal(result.sample.unbranded_found, 2);
  assert.equal(result.sample.unbranded_recommended, 1);
  assert.match(result.headline, /recommended in 1 of 9/);
  assert.equal(result.other_providers[0].appearances, 5);
  assert.equal("score" in result, false);
  assert.equal(result.next_actions.length, 3);
});
