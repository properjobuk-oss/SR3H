# AIDO Discoverability Check MCP

A public, read-only MCP service that checks website access and offer clarity and, when configured, runs a six-question branded and unbranded AI-assisted search sample. It reports exact observations and explicit limits rather than a score or ranking promise.

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

Production uses separate Cloudflare rate limits for technical checks and paid discovery samples, a 64 KB MCP request limit, bounded website fetches, at most six web-search tool calls, a short structured response and no-store OpenAI API requests. Completed discovery results may be cached for 24 hours to avoid paying for the same check repeatedly. Submitted page contents are not written to application logs or an application database. Cloudflare rate limits are abuse controls rather than exact accounting limits.

Set the OpenAI secret without committing it:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Without that secret, the deterministic technical check still completes and explicitly marks the live discovery sample unavailable.

Public information: [support](https://sr3h.uk/ai-presence-support.html), [privacy](https://sr3h.uk/ai-presence-privacy.html), and [terms](https://sr3h.uk/ai-presence-terms.html).

## Deployment and review boundary

Deploying the Worker makes the MCP endpoint reachable. It does not publish the plugin in ChatGPT. Review submission remains a later, explicit step after deployed testing, privacy and support documentation, publisher verification and final approval of the tool behaviour.
