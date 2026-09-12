# Release readiness

## Product boundary

`check_ai_presence` performs a read-only technical check of public website signals and, when configured, a six-question AI-assisted understanding and search sample. It reports observed appearances, not a fixed ranking, independent recommendation, customer demand, conversion, revenue or causal impact.

## Required evidence before review submission

- Stable public HTTPS endpoint owned by SR3H: `https://mcp.sr3h.uk/mcp`.
- Health, initialization, tool listing and representative tool calls verified remotely.
- Input and output schemas scanned successfully in the OpenAI submission portal.
- Accurate read-only, non-destructive and open-world annotations.
- Rate limiting, bounded fetches, redirect validation, private-address rejection and production failure logging verified.
- OpenAI requests use `store: false`, a strict output schema, a six-call tool limit and bounded output; provider failure leaves the technical check usable.
- Public support, privacy and terms URLs matching the verified publisher:
  - `https://sr3h.uk/ai-presence-support.html`
  - `https://sr3h.uk/ai-presence-privacy.html`
  - `https://sr3h.uk/ai-presence-terms.html`
- Developer-mode testing in ChatGPT for direct, indirect, edge-case and out-of-scope requests.
- Publisher identity and domain control verified.

## Draft positive cases

1. Check a technically complete business website and return sourced observations plus six questions derived from its actual offer.
2. Check a sparse homepage and identify missing metadata, canonical, sitemap and structured data without inventing commercial impact.
3. Check an OAI-SearchBot block and explain the exact observed rule.
4. Compare supplied business name, location and priority services with up to five same-origin public pages.
5. Follow a safe public redirect and report the final URL.
6. Confirm branded and unbranded counts match the six returned questions and never become an invented score.

## Draft negative cases

1. “Tell me where my company ranks in ChatGPT.” Do not present a crawl as ranking evidence; explain the boundary.
2. “Check my internal admin site at localhost.” Reject local and private-network targets.
3. “Fix my website for me.” Do not claim to make changes; return read-only findings only if a public URL was supplied.

These are preparation materials, not evidence that OpenAI review has been requested or passed.

## Current version status

- **Production and repository: `0.5.0`.** Cloudflare deployed Worker version `624d1d48-7d86-4fb4-8ae8-5ea67e996a53` on 12 September 2026.
- The public health endpoint and MCP initialization both report `AIDO Discoverability Check` version `0.5.0`.
- The deployed MCP advertises all four optional context fields and returns them through the audit result.
- The OpenAI API secret is not yet configured in Cloudflare. Production therefore returns a truthful technical-only result and marks the AI-assisted discovery sample unavailable.

## Production evidence for version 0.3.0 — 11 September 2026

- Cloudflare Worker version `0.3.0` deployed at `https://mcp.sr3h.uk/mcp`, with the first-party website check route at `https://mcp.sr3h.uk/check`.
- Public health, TLS, no-store and safety headers verified.
- MCP SDK initialization, tool discovery, output schema, safety annotations, a live `sr3h.uk` audit and private-network rejection verified remotely.
- ChatGPT developer app connected with no authentication. ChatGPT displayed `check_ai_presence` as `READ` and `OPEN WORLD` with the expected schema.
- A positive ChatGPT test returned a sourced technical-signal report and preserved the ranking and conversion boundary.
- A negative ChatGPT request for an exact ranking was refused and explained what separate evidence would be needed.
- A ChatGPT request to audit `http://127.0.0.1/private` returned `invalid_url` and confirmed that the private address was not accessed.
- The website route is restricted to approved SR3H and local-preview browser origins, rejects oversized and honeypot submissions, blocks private-network targets, and uses a separate five-checks-per-minute limiter for both visitor and target keys.
- The complete local website form was verified in a browser against the deployed route, returning a sourced `clear` result for `sr3h.uk` with explicit unknowns and no score.
- Cloudflare's rate-limit bindings are deployed and their rejection branches are unit tested. Platform limits are intentionally eventually consistent, so burst tests are not treated as proof of a hard quota.

## Production probe — 12 September 2026

- Health and MCP initialization report production version `0.5.0`.
- `check_ai_presence` advertises business name, location or service area, priority services and target customer as optional inputs.
- A remote MCP call confirmed that all four optional inputs reached the structured audit result.
- The live technical audit completed and returned structured output.
- The AI-assisted sample returned `unavailable`, as designed, because the production OpenAI secret is not configured.

## Local evidence for version 0.5.0

- A SQLite-backed Durable Object is implemented to enforce the paid layer's exact daily ceiling and per-visitor and per-target allowances. Quota-storage failure disables only the paid layer rather than failing open.
- Dependency audit reported zero known vulnerabilities; 35 automated tests passed, including the Cloudflare execution-context regression, website request limits and persistent daily usage ceilings.

## Version 0.5.0 remaining release gate

Deployment, health, MCP connection, schema and technical-result checks are complete. Before plugin submission, configure the production OpenAI secret, run the full remote verifier, complete one real branded and one real unbranded check, confirm the plain-English output and review the provider cost and latency logs. Do not submit the plugin for review until those checks are recorded.

OpenAI review has not been requested. The remaining draft cases above should be executed and recorded before submission.
