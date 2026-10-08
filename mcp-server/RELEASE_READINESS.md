# Release readiness

## Product boundary

The first-party `/check` route performs a read-only technical check of public website signals and, when configured, a six-question API-backed understanding and search sample.

The MCP is Signal. Version 0.12 adds saved studies and a background runner for independent GPT API web searches, evidence-linked hypotheses and interventions, recorded implemented changes and matched reassessment. Neutral captures contain only the question and fixed settings; target context enters after the raw answer is saved. The three earlier website/within-chat tools remain compatible and make no SR3H API calls. Results are dated samples, not consumer ChatGPT rankings or causal proof.

## Required evidence before review submission

- Stable public HTTPS endpoint owned by SR3H: `https://mcp.sr3h.uk/mcp`.
- Health, initialization, tool listing and representative tool calls verified remotely.
- Input and output schemas scanned successfully in the OpenAI submission portal.
- Accurate per-tool read/write, destructive and open-world annotations.
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

## Current version status — 8 October 2026

- **Production: Signal `0.12.0`.** Worker version `b4964625-2641-4b5a-874f-b6e41ff0c12b` at the existing endpoint. The new VisibilityStudy Durable Object is deployed.
- All 76 automated tests and syntax checks pass. Tests cover neutral capture, real storage contracts, evidence validation, quotas, failed captures, identity ambiguity, explicit recovery, non-resetting input errors, model drift, cancellation/deletion and immutable baseline comparisons.
- Remote MCP verification passes: server name/version, 11 tools, responsive `ui://aido/discoverability-report-v7.html` card, sourced technical audit, unsupported-summary rejection and private-network rejection.
- The existing ChatGPT App `asdk_app_6aa43468438c8191b6274063a55c0033` retains its identity and permissions. Safari shows the name Signal, updated description and 11 imported actions (six Write, five Read).
- Real provider smoke captures succeeded with dated raw answers, citations and the pinned `gpt-5.4-mini-2026-03-17` model. An initial branded result identified a same-name business on another domain; the final protocol rejects unverifiable identity rather than counting a false positive. A focused two-question final study completed the publication/reassessment path separately.
- Live complete cycle: baseline finished at `2026-10-08T08:57:36.812Z`; all three public support/privacy/terms pages matched committed bytes at `08:59:57Z`; the implementation was recorded with evidence URLs and concurrent-change disclosure; reassessment finished at `09:00:49.486Z`. Four raw sourced answers and both analyses were saved. The actual capture and assessor models matched.
- Comparison returned `no_clear_change`, complete coverage with two matched answer pairs, no failed pairs, mentions `0 → 0`, recommendations `0 → 0`. This small immediate developer test proves collection, persistence, implementation recording, rerun and comparison, not improved customer visibility or causation. Private references and raw records are retained outside Git in the developer's local release evidence file.
- A fresh ChatGPT test launched from the existing Signal page invoked `check_ai_presence` on the public SR3H website and rendered a native report frame (`Check public website access for AI`, approximately 768 × 661 pixels). No saved study or paid searches were started by that host test. Automatic approval review rejected sending the private study capability reference into ChatGPT; saved-study execution was verified directly through the production MCP instead.
- The final separate Signal quota remains 80 reservations globally per UTC day; visitor and target ceilings are also 80 so the default 30-answer baseline and 30-answer reassessment plus analyses fit. Existing website-form quotas are unchanged. New-study creation and explicit retry are correctly marked non-idempotent.
- The mobile and desktop comparison card was rendered at 390 and 1100 pixels with no page errors or document overflow. The local fixture checks layout only.
- Saved references control access, rather than account authentication. Public privacy, terms and support pages describe storage, deletion, API use, allowance and comparison limits.
- This updates the existing development connection; OpenAI directory submission has not been requested.

## Historical version 0.11 status

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

## MyLegend case and version 0.12.1 — 8 October 2026

- Production Worker `620b8ead-8b16-44dd-8ba5-7151e79730a0`, service Signal `0.12.1`, same MCP endpoint and bindings. Static checks and 86 automated tests pass. Remote verification confirms the 11 tools, native report resource, public-profile audit, private-network rejection and skill resource digests.
- A real MyLegend.id study used six questions with two repeats, frozen `signal-isolated-search-2` conditions and model `gpt-5.4-mini-2026-03-17`. Twelve raw searched answers were saved. Ten unbranded assessments completed: zero mentions and zero recommendations. Two branded assessments remain unverified; one answer confused the identity with an unrelated fibre-service app. Failures are excluded from visibility denominators.
- The test exposed unavailable all-or-nothing reasoning, discarded raw identity diagnostics, insufficient public context and literal phrase mismatches being treated as missing facts. This patch adds bounded supporting-page excerpts, public link targets and advertised connection references; preserves raw answers with failed assessments for diagnostic reasoning; withholds unsupported individual findings; keeps literal wording checks outside checked factual gaps; and supports explicitly requested reasoning-only reviews with freshly dated public evidence. No recovery searches replace the original captures.
- ProfilePage markup is now recognised when its main entity is a named Person or Organization. Public MCP URLs advertised in copyable code blocks are references, not proof of operation. Missing optional Agent Cards or legacy plugin manifests do not establish an MCP App rendering failure.
- MyLegend's production public profile lookup worked, and a private-note/unpublished-CV request was refused. In Safari's actual ChatGPT client, `get_profile` rendered Danny Griffin's inline card; clicking its public question button returned approved information inside the card. The public embed passed 390px and 1100px browser checks with loaded photo, no horizontal overflow and no page errors. The actual production resource also initialized and called `ask_person` through the shared MCP Apps bridge without `window.openai` in a browser harness. This is not a named Claude, Copilot or Gemini client test.
- Safari Google search with `pws=0` displayed the public Danny profile and card pages and stated results were not personalised. Google's live Rich Results Test successfully crawled the profile and detected one valid ProfilePage item. This establishes markup eligibility, not actual rich-result display or interactive cards in Google Search. Headless Google attempts were blocked and were not treated as index failures.
- No MyLegend website or profile content was changed. No MyLegend intervention was recorded or reassessment started, so no MyLegend visibility increase or causal effect is claimed. Suggestions still need factual review against current copy and host evidence; valid evidence IDs alone do not certify a suggestion's usefulness.

## Distinct Signal card — version 0.12.2, 8 October 2026

- The Signal MCP report uses a prominent Signal wordmark, charcoal header, green accents, tabular measurement row and a compact next-step panel. It is visually separate from MyLegend's blue personal profile card with portrait and question field.
- Report resource advances to `ui://aido/discoverability-report-v8.html`; the stable app/endpoint, research data, permissions and result values are retained. Counts are labelled validated answers and unverified answers so failed assessments are not confused with missing raw captures.
- Production Worker `39e1fd7f-c650-4248-820b-0d4629e3677b`, service `0.12.2`. All 86 tests and remote MCP checks pass. Browser checks at 390px and 1100px and in dark mode passed with no horizontal overflow or script errors; the evidence drawer opens and closes. Preview uses the actual saved MyLegend study presentation, not invented improvements.
- The separate local MyLegend test report now labels its profile-card screenshots explicitly as MyLegend's card tested by Signal. MyLegend card source and profile content were not changed.
- A fresh Safari ChatGPT test invoked only Signal `check_ai_presence` on the public Danny profile and rendered its native charcoal-and-green card (`Check public website access for AI`, approximately 768 × 709 pixels). ChatGPT also unnecessarily recreated a second panel; resource widget-description metadata and the Signal skill now clarify card ownership and discourage that duplication. Host narration remains model-generated.
