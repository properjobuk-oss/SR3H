import test from "node:test";
import assert from "node:assert/strict";
import { UsageGuard, reserveDiscoveryUsage, usageContext, USAGE_LIMITS } from "../src/usage-guard.js";

function storageContext() {
  const values = new Map();
  return { storage: {
    get: async (key) => values.get(key),
    put: async (key, value) => values.set(key, structuredClone(value))
  } };
}

async function reserve(guard, visitor, target, day = "2026-09-12") {
  return (await guard.fetch(new Request("https://guard.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day, visitor, target })
  }))).json();
}

test("enforces persistent visitor and target daily limits", async () => {
  const guard = new UsageGuard(storageContext(), {});
  assert.equal((await reserve(guard, "visitor-a", "one.example")).allowed, true);
  assert.equal((await reserve(guard, "visitor-a", "two.example")).allowed, true);
  assert.equal((await reserve(guard, "visitor-a", "three.example")).reason, "visitor_daily_limit");

  const targetGuard = new UsageGuard(storageContext(), {});
  assert.equal((await reserve(targetGuard, "visitor-a", "one.example")).allowed, true);
  assert.equal((await reserve(targetGuard, "visitor-b", "one.example")).allowed, true);
  assert.equal((await reserve(targetGuard, "visitor-c", "one.example")).reason, "target_daily_limit");
});

test("enforces an absolute daily ceiling and resets on a new UTC day", async () => {
  const guard = new UsageGuard(storageContext(), { DAILY_DISCOVERY_LIMIT: "3", DAILY_DISCOVERY_VISITOR_LIMIT: "3", DAILY_DISCOVERY_TARGET_LIMIT: "3" });
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await reserve(guard, `visitor-${index}`, `${index}.example`)).allowed, true);
  }
  assert.equal((await reserve(guard, "visitor-4", "four.example")).reason, "global_daily_limit");
  assert.equal((await reserve(guard, "visitor-4", "four.example", "2026-09-13")).allowed, true);
});

test("fails the paid reservation closed when durable storage is unavailable", async () => {
  const binding = {
    idFromName: () => "id",
    get: () => ({ fetch: async () => { throw new Error("storage unavailable"); } })
  };
  const result = await reserveDiscoveryUsage({ USAGE_GUARD: binding }, "test.example", { visitor: "visitor" });
  assert.deepEqual(result, { allowed: false, reason: "quota_unavailable" });
  assert.deepEqual(USAGE_LIMITS, { global: 20, visitor: 2, target: 2 });
});

test("uses a stable digest rather than storing the raw visitor IP", async () => {
  const request = new Request("https://guard.test", { headers: { "cf-connecting-ip": "203.0.113.44" } });
  const first = await usageContext(request, { ABUSE_HASH_SECRET: "test-secret" });
  const second = await usageContext(request, { ABUSE_HASH_SECRET: "test-secret" });
  assert.equal(first.visitor, second.visitor);
  assert.match(first.visitor, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first.visitor, /203\.0\.113\.44/);
});
