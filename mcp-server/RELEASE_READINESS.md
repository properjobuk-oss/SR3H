# Release readiness

## Product boundary

The first-party `/check` route performs a read-only technical check of public website signals and, when configured, a six-question API-backed understanding and search sample.

The MCP route is separate. `check_ai_presence` inspects the public site without calling an AI model. Version 0.8 deterministically prepares an optional ten-question workflow without an OpenAI API call, then summarises evidence collected with research tools available in the user's ChatGPT session. The MCP does not claim control of ChatGPT's web-search availability or usage limits, and the summariser refuses to count a positive appearance without a source URL.

## Required evidence before review submission

- Stable public HTTPS endpoint owned by SR3H: `https://mcp.sr3h.uk/mcp`.
- Health, initialization, tool listing and representative tool calls verified remotely.
- Input and output schemas scanned successfully in the OpenAI submission portal.
- Accurate read-only, non-destructive and open-world annotations.
- Rate limiting, bounded fetches, redirect validation, private-address rejection and production failure logging verified.
- Website-form OpenAI requests use `store: false` and strict, bounded output schemas. Each of its six isolated question checks is restricted to one required web-search call; provider failure leaves the technical check usable.
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

- **Production and repository: `0.8.0`.** Cloudflare deployed Worker version `0b0c10f5-575b-4461-96ab-eb00ce8416ba` on 12 September 2026.
- The public health endpoint and MCP initialization both report `AIDO Discoverability Check` version `0.8.0` and advertise all three focused tools.
- The deployed MCP advertises all four optional context fields and returns them through the audit result.
- The restricted `AIDO DISCOVERABILITY TEST` OpenAI key is configured as the encrypted `OPENAI_API_KEY` Cloudflare Worker secret. It has Responses write access and no Chat Completions, embeddings, realtime, images, moderation or other endpoint access.
- Only the first-party website form can use that secret. Its paid flow creates a bounded six-question plan and runs each question as an isolated required web search. Unbranded prompts never receive the target business name or domain. A positive appearance is counted only when the individual response includes matching source evidence.
- The MCP server does not receive the Worker environment in its tool handlers and has regression coverage proving that an available `OPENAI_API_KEY` cannot trigger an OpenAI call.
- A local end-to-end provider test using the production key completed all six isolated searches for Proper Job. It found the branded site and one sourced unbranded recommendation for drawing-based estimating; the four broader unbranded questions did not surface Proper Job.

## Version 0.8.0 evidence

- Three focused tools separate public-site inspection, optional ten-question research preparation and deterministic evidence summary.
- The extended preparation requires an explicit business name and at least one priority service, produces one branded and nine neutral unbranded questions, and removes target leakage from unbranded context.
- Preparing a pack uses no model, API key, paid-usage allowance, cache or web-search tool.
- The returned pack states that no searches have run, requires user confirmation and gives a no-fabrication fallback when host browsing is unavailable.
- The summary accepts no more than ten observations, requires source evidence for any claimed appearance and returns exact counts rather than a score.
- A packaged ChatGPT skill governs explicit opt-in, neutral searches, observation classification, output language and evidence limits.
- Static checks and 41 automated tests pass. The skill package validates, the production Worker bundle builds, and the production dependency audit reports zero known vulnerabilities.
- Local and production verification confirmed version 0.8.0, all three schemas, the technical audit, deterministic question pack, deterministic summary, safety headers and private-network rejection.
- The production website route returned HTTP 200 with a complete technical result after deployment. Its paid sample correctly returned `visitor_daily_limit`, so a fresh post-deployment six-search sample remains unproven today.

## Remaining release gate

Import or upload the packaged skill, then test the complete opt-in, host-search, evidence-classification and summary journey in ChatGPT developer mode. Run direct, indirect, incomplete-input, unavailable-search and should-not-activate cases. After the website allowance resets, verify one fresh API-backed `/check` sample. Do not claim that the MCP controls ChatGPT web-search availability or usage accounting, and do not submit for OpenAI review until those journeys are recorded.

## Historical version 0.7.0 evidence

- Version `0.7.0` deployed as Worker `e34255fa-a63d-4002-838b-743096493938` on 12 September 2026.
- It first separated the optional ten-question research plan from deterministic evidence summarisation, but the question planner still used one SR3H OpenAI API call and shared the paid allowance.
- Version 0.8 superseded that planner with deterministic, API-free preparation.

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

## Local evidence for version 0.6.0

- A SQLite-backed Durable Object is implemented to enforce the paid layer's exact daily ceiling and per-visitor and per-target allowances. Quota-storage failure disables only the paid layer rather than failing open.
- Dependency audit reported zero known vulnerabilities; 35 automated tests passed, including the Cloudflare execution-context regression, website request limits and persistent daily usage ceilings.

## Version 0.6.0 remaining release gate

Deployment, health, MCP connection, schema, technical-result checks, key configuration and a real six-search provider test are complete. Today's remote verifier retries reached the intentionally strict per-visitor daily allowance before the final deployment could be sampled through the public endpoint. After the UTC allowance resets, run the full remote verifier and one browser-form check, confirm the rendered plain-English output, and review provider cost and latency. Do not submit the plugin for review until those final public-path checks are recorded.

OpenAI review has not been requested. The remaining draft cases above should be executed and recorded before submission.
