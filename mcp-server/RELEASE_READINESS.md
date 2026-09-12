# Release readiness

## Product boundary

The first-party `/check` route performs a read-only technical check of public website signals and, when configured, a six-question API-backed understanding and search sample.

The MCP route is separate. `check_ai_presence` inspects the public site without calling an AI model. Version 0.11 deterministically prepares an optional ten-question workflow without an OpenAI API call, then summarises evidence collected with research tools available in the user's ChatGPT session. The readiness and summary tools build their own result cards from verified output. The MCP does not claim control of ChatGPT's web-search availability or usage limits. Every completed observation requires a concise answer record and dated source evidence, and a mention or recommendation also requires evidence from the target business itself.

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

- **Production: `0.11.0`.** Deployed on 12 September 2026 as Worker version `55045cb0-0ed2-4cc3-a929-7b1a90a73252` from commit `1a231b5`. Remote MCP, ten-question planner and skill-integrity checks pass. The customer-facing app, MCP server and result card are named **AIDO by SR3H**.
- The MCP has three tools. The readiness and sourced-summary tools attach server-generated component data; question preparation remains text and structured data only. It makes no SR3H OpenAI API calls.
- The component uses the MCP Apps handshake, a self-contained `text/html;profile=mcp-app` resource and no external scripts, fonts, tracking or network requests.
- Earlier-release private ChatGPT tests passed for a direct readiness result and a complete ten-question sourced discovery result. Both rendered the component successfully.
- An earlier-release fresh chat launched from the AIDO app page invoked the readiness tool from an indirect “overlooking my business” request. Invocation from an ordinary unconnected chat remains controlled by ChatGPT and is not guaranteed.
- The completed ten-question SR3H sample found the branded site in 1 of 1 questions and did not find it in 9 of 9 unbranded questions. This is a dated sample, not a permanent rank or demand measure.
- Negative tests passed for a private localhost target, an unsupported ranking guarantee and an unrelated staff-rota request.
- The separate website checker still uses the restricted, encrypted SR3H OpenAI key for its bounded paid sample. Its technical result remains available when the paid allowance is exhausted.
- The submission pack contains the name, descriptions, three starter prompts, five positive cases, five negative cases and release notes. This is preparation, not submission or approval.
- All 54 automated tests, static checks and the Worker build pass. The dependency audit reports zero known vulnerabilities. Production MCP, planner and skill-import verification pass for this release. The website form returned a valid technical result, but its paid discovery layer returned `provider_or_output_error`; that paid sample remains unresolved.

## Security hardening in this release

- Streamed request size and read deadlines; MCP limiter errors refuse work.
- Missing daily quota storage prevents paid calls. Visitor identifiers use a daily HMAC when the secret is configured; otherwise requests share a conservative quota.
- Website fetch deadlines include response bodies. Nonstandard ports and common credential query parameters are rejected; redirects are revalidated.
- Safe source links, fixed card attribution URL, invalid HTML entity handling and explicit untrusted-evidence skill instructions.
- Quota storage and cached-result privacy disclosures; query-string redaction and automatic invocation logs disabled in deployment configuration.
- Root secret-file ignore rules and GitHub Pages exclusions for server/internal source. Repository visibility itself is unchanged.
- Still requires hosting-level verification of DNS rebinding and private-IP resolution protection, plus a refreshed ChatGPT conversation test before review submission.
- The public support, privacy and terms pages each return HTTP 200.
- A fresh private ChatGPT connection test is required after deployment to verify the v5 server-generated card and updated skill behaviour.

## Version 0.9.0 evidence

- The skill is now importable through the MCP skills extension rather than relying on a separate manual copy. Its main instructions, reporting reference and ChatGPT metadata are exposed as three digest-verified resources.
- The workflow separates website readiness, question preparation, independent research and evidence summary. A direct request for an extended check counts as consent; otherwise the user must opt in before searches begin.
- The question pack contains exactly one branded and nine neutral questions covering category, problem, high intent, differentiator, location, comparison, evidence, use case and alternative intent.
- The summariser rejects missing evidence, invalid timestamps, duplicate questions, incomplete positive evidence and target leakage. It distinguishes `not_seen`, `source_only`, `mentioned` and `recommended`, and clearly labels partial samples.
- Ten ChatGPT evaluation cases cover direct, indirect, follow-up, incomplete-input, evidence, unavailable-tool, boundary and out-of-scope behaviour.
- Static checks and 46 automated tests pass. The skill validator passes, the production Worker bundle builds, and the production dependency audit reports zero known vulnerabilities.
- Local and production verification confirmed version 0.9.0, three MCP tools, the deterministic ten-question pack, evidence rejection, skill-resource digests and private-network rejection.

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

The OpenAI submission draft must show the verified publisher **SR3H LTD**; the unexplained `SRTH` identity label must be resolved before submission. Ask for explicit approval before pressing **Submit for review**. OpenAI review has not been requested.

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
