# SR3H AI Presence Check MCP

A public, read-only MCP service that checks observable website signals affecting AI-search discoverability. It reports sourced findings and explicit unknowns; it does not claim to measure rankings, recommendations or conversions.

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

Production uses a per-target-site Cloudflare rate-limit binding for audit calls, a 64 KB MCP request limit, Workers observability for bounded failure events, explicit input and output schemas, and no-store responses. Submitted website URLs and page contents are not written to application logs or persistent storage. Cloudflare's binding is intentionally permissive and eventually consistent, so it is an abuse-control layer rather than an exact accounting limit.

Public information: [support](https://sr3h.uk/ai-presence-support.html), [privacy](https://sr3h.uk/ai-presence-privacy.html), and [terms](https://sr3h.uk/ai-presence-terms.html).

## Deployment and review boundary

Deploying the Worker makes the MCP endpoint reachable. It does not publish the plugin in ChatGPT. Review submission remains a later, explicit step after deployed testing, privacy and support documentation, publisher verification and final approval of the tool behaviour.
