import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const signal = read("signal.html");
const legacy = read("aido-labs.html");
const home = read("index.html");

assert(signal.includes('id="ai-check-form"'), "Signal must contain the website checker");
assert(/<script src="site\.js\?v=[^"]+"><\/script>/.test(signal), "Signal must load the checker behaviour");
assert.equal((signal.match(/Login to Signal/g) || []).length, 1, "Signal needs one live Signal action");
assert(!signal.includes("For existing users"), "Remove duplicated sign-in instructions");
assert(signal.includes("See how AI finds your company."), "Signal must explain the customer outcome");
assert(signal.includes("Examine how AI finds, compares and recommends your company, and identify changes worth testing."), "Signal must state the bounded product proposition");
assert(signal.includes("questions, answers, competitors and evidence"), "Signal must describe the evidence shown in the workspace");
assert(signal.includes("Website readiness and observed inclusion are reported separately."), "Signal must separate readiness from observed inclusion");
assert(legacy.includes('url=signal.html#ai-check') && legacy.includes('window.location.replace("signal.html#ai-check")'), "Old AIDO URL must preserve the checker route");
assert(home.includes('href="https://mylegend.id/check" aria-label="Start the Signal website check"'), "Homepage card must open the website check directly");
assert(home.includes('assets/projects/signal-logo.png'), "Homepage card must use the current Signal logo");
assert(home.includes('assets/projects/signal-workspace-phone.png'), "Homepage card must use the portrait Signal workspace preview");
assert(home.includes('assets/projects/signal-nav-mark.png'), "Homepage preview must use the exact current Signal mark");
assert(!home.includes('href="aido-labs.html"'), "Homepage must not advertise the retired AIDO page");
console.log("PASS: Signal has one concise workspace action, the website checker, and a compatible AIDO redirect.");
