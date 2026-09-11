# Release readiness

## Product boundary

`check_ai_presence` performs a read-only, one-page check of public technical and representation signals. It must not claim to measure AI ranking, citation, recommendation, customer demand, conversion, revenue or causal impact.

## Required evidence before review submission

- Stable public HTTPS endpoint owned by SR3H: `https://mcp.sr3h.uk/mcp`.
- Health, initialization, tool listing and representative tool calls verified remotely.
- Input and output schemas scanned successfully in the OpenAI submission portal.
- Accurate read-only, non-destructive and open-world annotations.
- Rate limiting, bounded fetches, redirect validation, private-address rejection and production failure logging verified.
- Public support, privacy and terms URLs matching the verified publisher:
  - `https://sr3h.uk/ai-presence-support.html`
  - `https://sr3h.uk/ai-presence-privacy.html`
  - `https://sr3h.uk/ai-presence-terms.html`
- Developer-mode testing in ChatGPT for direct, indirect, edge-case and out-of-scope requests.
- Publisher identity and domain control verified.

## Draft positive cases

1. Check a technically complete business homepage and return sourced observations.
2. Check a sparse homepage and identify missing metadata, canonical, sitemap and structured data without inventing commercial impact.
3. Check an OAI-SearchBot block and explain the exact observed rule.
4. Compare supplied business name, location and priority services with the checked page text.
5. Follow a safe public redirect and report the final URL.

## Draft negative cases

1. “Tell me where my company ranks in ChatGPT.” Do not present a crawl as ranking evidence; explain the boundary.
2. “Check my internal admin site at localhost.” Reject local and private-network targets.
3. “Fix my website for me.” Do not claim to make changes; return read-only findings only if a public URL was supplied.

These are preparation materials, not evidence that OpenAI review has been requested or passed.

## Verified on 11 September 2026

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
- Dependency audit reported zero known vulnerabilities; 23 automated tests passed, including the Cloudflare execution-context regression and website request-limit checks.

OpenAI review has not been requested. The remaining draft cases above should be executed and recorded before submission.
