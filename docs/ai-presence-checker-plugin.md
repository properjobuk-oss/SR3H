# AIDO Discoverability Check: MCP plugin boundary

## User goal

Give a business a free, evidence-bounded first check of how clearly its public website can be found and interpreted by AI systems, then identify what requires deeper human analysis.

## First tool

`check_ai_presence`

Inputs:

- Public website URL.
- Optional business name.
- Optional location or service area.
- Optional priority products or services.
- Optional target customer description.

Read-only checks:

1. Public page reachability and HTTPS.
2. `robots.txt`, including `OAI-SearchBot` access.
3. Sitemap and canonical URL discovery.
4. Page titles, descriptions and index directives.
5. Organization, Product, Service and LocalBusiness structured data.
6. Whether the business, services, location and evidence are stated consistently across up to five same-origin public pages.
7. Whether `llms.txt` or another explicit machine-readable profile exists.
8. When the provider is available, whether the site answers six business-specific questions and whether the business is observed in one branded and five unbranded AI-assisted searches.

Output:

- Observed facts, each linked to the public source URL.
- Missing or unclear signals.
- Technical discoverability status.
- Representation risks and questions.
- Explicit unknowns.
- A short next action.
- An optional invitation to contact `hello@sr3h.uk` for deeper analysis.

The search sample uses a strict structured response, at most six web-search calls, bounded output, disabled OpenAI API storage, a separate Cloudflare rate limit and a 24-hour edge cache. If that layer is unavailable, the technical check still returns a useful result.

## Commercial and evidence boundary

The tool must not turn a bounded search observation into a fixed ChatGPT ranking, independent recommendation, customer-demand or conversion claim. It must not describe metadata compliance as commercial success. Consumer observations, API tests and real conversion data remain separate evidence classes.

## OpenAI tool annotations

- `readOnlyHint: true`
- `openWorldHint: true`
- `destructiveHint: false`

## Deployment state

Version 0.3 remains deployed at `https://mcp.sr3h.uk/mcp`. Version 0.4 is implemented locally and requires a production secret, deployment, real output review and remote verification before it replaces the deployed version. OpenAI review and public plugin publication remain later, separate release gates.
