import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const signal = read("signal.html");
const legacy = read("aido-labs.html");
const home = read("index.html");

assert(signal.includes('id="ai-check-form"'), "Signal must contain the website checker");
assert(signal.includes('site.js?v=20260918-signal-1'), "Signal must load the checker behaviour");
assert.equal((signal.match(/Open research workspace/g) || []).length, 1, "Signal needs one research workspace action");
assert(!signal.includes("For existing users"), "Remove duplicated sign-in instructions");
assert(signal.includes("Measure where your business appears in AI answers."), "Signal must explain the measured outcome");
assert(signal.includes("question, AI system, model, date, sources and full answer"), "Signal must state the retained test evidence");
assert(signal.includes("Website readiness and observed inclusion are reported separately."), "Signal must separate readiness from observed inclusion");
assert(legacy.includes('url=signal.html#ai-check') && legacy.includes('window.location.replace("signal.html#ai-check")'), "Old AIDO URL must preserve the checker route");
assert(home.includes('href="signal.html" aria-label="Explore Signal by Sr3h"'), "Homepage card must use Signal");
assert(!home.includes('href="aido-labs.html"'), "Homepage must not advertise the retired AIDO page");
console.log("PASS: Signal has one concise workspace action, the website checker, and a compatible AIDO redirect.");
