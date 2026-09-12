import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ChatGPT evaluation inventory covers activation, evidence and boundary behaviour", async () => {
  const inventory = JSON.parse(await readFile(new URL("../evals/chatgpt-cases.json", import.meta.url), "utf8"));
  assert.equal(inventory.version, "0.11.0");
  assert.equal(inventory.cases.length, 13);
  assert.equal(new Set(inventory.cases.map((item) => item.id)).size, inventory.cases.length);
  const categories = new Set(inventory.cases.map((item) => item.category));
  for (const required of ["direct", "indirect", "follow_up", "incomplete", "boundary", "unavailable_tool", "evidence", "out_of_scope"]) {
    assert.equal(categories.has(required), true, `missing ${required} evaluation case`);
  }
  assert.ok(inventory.cases.every((item) => item.prompt && item.expected));
});

test("submission pack contains the required listing and review cases", async () => {
  const listing = JSON.parse(await readFile(new URL("../submission/listing.json", import.meta.url), "utf8"));
  const cases = JSON.parse(await readFile(new URL("../submission/test-cases.json", import.meta.url), "utf8"));
  assert.equal(listing.name, "AIDO by SR3H");
  assert.equal(listing.publisher, "SR3H LTD");
  assert.equal(listing.starter_prompts.length, 3);
  for (const field of ["website_url", "support_url", "privacy_url", "terms_url", "mcp_url"]) {
    assert.equal(new URL(listing[field]).protocol, "https:");
  }
  assert.equal(cases.version, "0.11.0");
  assert.match(cases.test_context, /launched.*attached/i);
  assert.equal(cases.positive.length, 5);
  assert.equal(cases.negative.length, 5);
  assert.ok([...cases.positive, ...cases.negative].every((item) => item.prompt && item.expected_behavior));
});
