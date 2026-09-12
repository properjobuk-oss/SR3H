# AIDO Discoverability Check

AIDO is the product. This repository contains its public, read-only checking service and the MCP interface that lets ChatGPT and other compatible clients call it. It checks website access and offer clarity and, when configured, runs a six-question branded and unbranded AI-assisted search sample. It reports exact observations and explicit limits rather than a score or ranking promise.

The checker is not a standalone autonomous agent. ChatGPT supplies the conversational intelligence, chooses when to call the MCP tool and explains the structured result to the user.

The only required input is the public website URL. Optional business name, location or service area, priority products or services, and target-customer context make the questions more relevant. They are treated as supplied context, not as verified facts or proof of demand.

## Version status

- Production and the repository report `0.5.0`.
- The public health endpoint is `https://mcp.sr3h.uk/health` and the MCP endpoint is `https://mcp.sr3h.uk/mcp`.
- The technical check remains available if the optional paid discovery layer is unavailable.

See [RELEASE_READINESS.md](RELEASE_READINESS.md) for the evidence boundary and remaining release checks.

## Endpoints

- `GET https://mcp.sr3h.uk/health` — deployment health.
- `POST https://mcp.sr3h.uk/mcp` — stateless Streamable HTTP MCP endpoint.

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

Production uses separate Cloudflare burst limits for technical checks and paid discovery samples, plus a persistent daily allowance for the paid layer: 20 samples in total, no more than two per visitor and two per target website per UTC day. Once an allowance is reached, the technical check remains available but no paid model call is made. Requests also have a 64 KB MCP limit, bounded website fetches, at most six web-search tool calls, a short structured response and no-store OpenAI API requests. Completed discovery results may be cached for 24 hours to avoid paying for the same check repeatedly. Submitted page contents and raw visitor IP addresses are not written to application logs or an application database.

Set the OpenAI secret without committing it:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Without that secret, the deterministic technical check still completes and explicitly marks the live discovery sample unavailable.

Public information: [support](https://sr3h.uk/ai-presence-support.html), [privacy](https://sr3h.uk/ai-presence-privacy.html), and [terms](https://sr3h.uk/ai-presence-terms.html).

## Deployment and review boundary

Cloudflare Workers hosts the public HTTPS service at `mcp.sr3h.uk`. Cloudflare was chosen because SR3H already uses its domain infrastructure and because Workers provides the custom HTTPS route, edge execution, rate limiting, persistent quota storage and observability used by this service. MCP does not require Cloudflare; another production host could be used if it provided the same security, reliability and operational controls.

Deploying the Worker makes the MCP endpoint reachable. It does not publish the plugin in ChatGPT. Review submission remains a later, explicit step after deployed testing, privacy and support documentation, publisher verification and final approval of the tool behaviour.
