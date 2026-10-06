import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const signal = read("signal.html");
const legacy = read("aido-labs.html");
const home = read("index.html");

assert(signal.includes('id="ai-check-form"'), "Signal must contain the website checker");
assert(/<script src="site\.js\?v=[^"]+"><\/script>/.test(signal), "Signal must load the checker behaviour");
assert(!signal.includes("For existing users"), "Remove duplicated sign-in instructions");
assert(signal.includes("Testing how AI finds and recommends businesses."), "Signal must lead with its testing role");
assert(signal.includes("repeatable batches of questions"), "Signal must describe its repeatable testing");
assert(signal.includes("answers, cited sources and businesses mentioned"), "Signal must describe its retained evidence");
assert(signal.includes("does not establish what caused it"), "Signal must distinguish comparison from causal proof");
assert(signal.includes("Website readiness and observed inclusion are reported separately."), "Signal must separate readiness from observed inclusion");
assert(legacy.includes('url=signal.html#ai-check') && legacy.includes('window.location.replace("signal.html#ai-check")'), "Old AIDO URL must preserve the checker route");
assert(home.includes('href="signal.html">About Signal ↗</a>'), "Homepage card must lead to About Signal");
assert(home.includes('href="signal.html#ai-check">Free website check ↗</a>'), "Homepage card must keep the free check separate and on the public Signal page");
assert(home.includes('assets/projects/signal-logo.png'), "Homepage card must use the current Signal logo");
assert(home.includes('assets/projects/signal-workspace-phone.png'), "Homepage card must use the portrait Signal workspace preview");
assert(home.includes('assets/projects/signal-nav-mark.png'), "Homepage preview must use the exact current Signal mark");
assert(!home.includes('href="aido-labs.html"'), "Homepage must not advertise the retired AIDO page");
console.log("PASS: Signal describes repeatable testing, keeps the website checker secondary, and has a compatible AIDO redirect.");
