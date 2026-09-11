# SR3H AI Presence Check: MCP plugin boundary

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
6. Whether the business, services, location and evidence are stated consistently.
7. Whether `llms.txt` or another explicit machine-readable profile exists.

Output:

- Observed facts, each linked to the public source URL.
- Missing or unclear signals.
- Technical discoverability status.
- Representation risks and questions.
- Explicit unknowns.
- A short next action.
- An optional invitation to contact `hello@sr3h.uk` for deeper analysis.

## Commercial and evidence boundary

The tool must not claim to measure ChatGPT ranking, citation, recommendation, customer demand or conversion from a website crawl. It must not describe metadata compliance as commercial success. Consumer observations, API tests and real conversion data remain separate evidence classes.

## OpenAI tool annotations

- `readOnlyHint: true`
- `openWorldHint: true`
- `destructiveHint: false`

## Deployment state

The MCP service is deployed at `https://mcp.sr3h.uk/mcp` with a health endpoint at `https://mcp.sr3h.uk/health`. Its schemas, annotations, rate limits and public support, privacy and terms pages have been tested. ChatGPT developer-mode testing, publisher verification, OpenAI review and public plugin publication remain separate release gates.
