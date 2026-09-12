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

test("prepares ten neutral questions without an OpenAI API call or web search", async () => {
  const result = await prepareExtendedResearch(input, audit);
  assert.equal(result.status, "ready");
  assert.equal(result.question_count, 10);
  assert.equal(result.user_confirmation_required, true);
  assert.equal(result.questions.length, 10);
  assert.equal(EXTENDED_RESEARCH_LIMITS.openAiApiCalls, 0);
  assert.equal(EXTENDED_RESEARCH_LIMITS.webSearchCalls, 0);
  assert.deepEqual(result.questions.map((item) => item.kind), RESEARCH_KINDS);
  assert.ok(result.questions.filter((item) => item.kind !== "branded").every((item) => !/proper job|proper-job/i.test(item.question)));
  assert.match(result.search_note, /No AI searches have been run/);
  assert.match(result.usage_note, /no SR3H OpenAI API calls/i);
  assert.match(result.questions.find((item) => item.kind === "location").question, /United Kingdom/);
  assert.match(result.questions.find((item) => item.kind === "problem").question, /UK builders and homeowners/);
});

test("removes target names supplied inside unbranded research context", async () => {
  const result = await prepareExtendedResearch({
    ...input,
    priority_services: ["Proper Job drawing estimates"],
    target_customer: "Proper Job customers",
    location_or_service_area: "proper-job.example coverage area"
  }, audit);
  const unbranded = result.questions.filter((item) => item.kind !== "branded");
  assert.ok(unbranded.every((item) => !/proper job|proper-job|proper job example/i.test(item.question)));
  assert.ok(unbranded.every((item) => item.question.length > 20));
});

test("produces a stable question set for the same supplied context", async () => {
  const first = await prepareExtendedResearch(input, audit);
  const second = await prepareExtendedResearch(input, audit);
  assert.deepEqual(first.questions, second.questions);
  assert.equal(first.business, second.business);
  assert.equal(first.website_url, second.website_url);
});

test("bounds long context and supports short business names", async () => {
  const result = await prepareExtendedResearch({
    ...input,
    business_name: "AI",
    priority_services: ["specialist service ".repeat(20)],
    target_customer: "organisations with a complex requirement ".repeat(20),
    location_or_service_area: "a wide service area ".repeat(20)
  }, { audit: { final_url: "https://ai.example/" } });
  assert.equal(result.status, "ready");
  assert.ok(result.questions.every((item) => item.question.length <= 280));
  assert.equal(result.questions.length, 10);
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
