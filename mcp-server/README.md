# AIDO Discoverability Check

AIDO is the product. This repository contains two deliberately separate routes. The SR3H website checker inspects public-site evidence and, when configured, uses SR3H's OpenAI API project for a bounded six-question search sample. The MCP inspects the public site, prepares a ten-question pack and summarises sourced observations without calling the OpenAI API. In ChatGPT, the optional searches use research tools available in the user's own session.

The checker is not a standalone autonomous agent. ChatGPT supplies the conversational intelligence, chooses when to call the MCP tool and explains the structured result to the user.

The only required input is the public website URL. Optional business name, location or service area, priority products or services, and target-customer context make the questions more relevant. They are treated as supplied context, not as verified facts or proof of demand.

## Version status

- Production and the repository report `0.8.0`.
- The public health endpoint is `https://mcp.sr3h.uk/health` and the MCP endpoint is `https://mcp.sr3h.uk/mcp`.
- The website form's technical check remains available if its optional paid discovery layer is unavailable.
- The MCP tools do not use the SR3H OpenAI API key.

See [RELEASE_READINESS.md](RELEASE_READINESS.md) for the evidence boundary and remaining release checks.

## Endpoints

- `GET https://mcp.sr3h.uk/health` — deployment health.
- `POST https://mcp.sr3h.uk/check` — first-party SR3H website checker, including its separately limited API-backed sample when available.
- `POST https://mcp.sr3h.uk/mcp` — stateless Streamable HTTP MCP endpoint.

## MCP tools

- `check_ai_presence` inspects public website evidence. It runs no model or AI search.
- `prepare_ai_discovery_research` deterministically prepares ten tailored questions after the user explicitly opts in. It runs no model or search.
- `summarise_ai_discovery_research` converts one to ten sourced observations into exact counts, gaps and practical next actions.

The extended workflow deliberately separates question preparation, ChatGPT-session research and evidence reporting. If the connected ChatGPT client provides web search, it can search each question independently. The MCP cannot force that host tool to run or guarantee its usage accounting. If browsing is unavailable, the client must say so and must not fabricate observations. AIDO never asks for the user's OpenAI API key.

The packaged workflow skill is at `skills/aido-discoverability-check/`. Upload it with the ChatGPT plugin submission, or import it from the MCP if the submission interface offers that option. Re-import after material skill changes because imported skills are snapshots.

## Local verification

```sh
npm install
npm run check
npm test
npm run dev
```

Verify a deployed endpoint with the same SDK client used by MCP consumers:

```sh
npm run verify:remote -- https://your-worker.example/mcp https://sr3h.uk
```

The first-party website checker uses separate Cloudflare burst limits for technical checks and paid discovery samples, plus a persistent daily allowance for the paid layer: 20 samples in total, no more than two per visitor and two per target website per UTC day. Once an allowance is reached, the technical check remains available but no paid model call is made. A completed website sample plans six relevant questions, then runs six isolated web searches: one branded and five unbranded. Each search is limited to one web-search tool call and a short structured response. OpenAI API storage is disabled. Completed website-check results may be cached for 24 hours to avoid paying for the same check repeatedly.

MCP requests have a 64 KB limit and bounded website fetches. The MCP tools do not read the Worker OpenAI secret, call the OpenAI API or run web searches. Submitted page contents and raw visitor IP addresses are not written to an application database.

Set the OpenAI secret without committing it:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Without that secret, the first-party website form still completes its deterministic technical check and marks its live discovery sample unavailable. The MCP workflow is unaffected. Production stores the value only as an encrypted Cloudflare Worker secret; it is not present in this repository or browser code.

Public information: [support](https://sr3h.uk/ai-presence-support.html), [privacy](https://sr3h.uk/ai-presence-privacy.html), and [terms](https://sr3h.uk/ai-presence-terms.html).

## Deployment and review boundary

Cloudflare Workers hosts the public HTTPS service at `mcp.sr3h.uk`. Cloudflare was chosen because SR3H already uses its domain infrastructure and because Workers provides the custom HTTPS route, edge execution, rate limiting, persistent quota storage and observability used by this service. MCP does not require Cloudflare; another production host could be used if it provided the same security, reliability and operational controls.

Deploying the Worker makes the MCP endpoint reachable. It does not publish the plugin in ChatGPT. Review submission remains a later, explicit step after deployed testing, privacy and support documentation, publisher verification and final approval of the tool behaviour.
