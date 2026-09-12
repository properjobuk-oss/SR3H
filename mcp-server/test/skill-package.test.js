import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ChatGPT evaluation inventory covers activation, evidence and boundary behaviour", async () => {
  const inventory = JSON.parse(await readFile(new URL("../evals/chatgpt-cases.json", import.meta.url), "utf8"));
  assert.equal(inventory.version, "0.9.0");
  assert.equal(inventory.cases.length, 10);
  assert.equal(new Set(inventory.cases.map((item) => item.id)).size, inventory.cases.length);
  const categories = new Set(inventory.cases.map((item) => item.category));
  for (const required of ["direct", "indirect", "follow_up", "incomplete", "boundary", "unavailable_tool", "evidence", "out_of_scope"]) {
    assert.equal(categories.has(required), true, `missing ${required} evaluation case`);
  }
  assert.ok(inventory.cases.every((item) => item.prompt && item.expected));
});
