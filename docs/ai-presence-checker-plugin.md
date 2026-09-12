# AIDO by SR3H: MCP app boundary

## User goal

Give a business a free, evidence-bounded first look at whether its public site is technically accessible and clearly described, then optionally observe how it appears in customer-question research performed in the user's ChatGPT session.

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

Output:

- Observed facts, each linked to the public source URL.
- Missing or unclear signals.
- Technical discoverability status.
- Explicit unknowns.
- A short next action.
- A restrained next action, with further SR3H information only when the user asks for broader help.

This MCP tool makes no OpenAI API call and runs no AI search. The separate first-party website form at `sr3h.uk` may run a bounded API-backed six-question sample using SR3H's API project. That website route has separate quotas, storage disclosures and failure handling.

## Optional extended workflow

After the first result, ChatGPT may offer a broader ten-question check. It must wait for the user to agree before preparing the pack.

1. `prepare_ai_discovery_research` deterministically creates ten business-specific questions. It calls no model and does not search them.
2. If the ChatGPT client has web search, it searches each question independently and records only sourced appearances.
3. `summarise_ai_discovery_research` reports exact mention and recommendation counts, missed questions, recurring alternative providers and up to three next actions.
4. The readiness and summary tools return a compact card generated directly from their supported result; the model cannot supply or strengthen its status, metrics or findings.

The MCP cannot force ChatGPT's host tools to run or guarantee how that activity counts against the user's plan. If host search is unavailable, it returns the question pack without inventing results. The user is never asked for an OpenAI API key. The question mix is visible, while analysis and prioritisation remain bounded by the MCP result schema and the packaged skill.

## Packaged ChatGPT skill

`mcp-server/skills/aido-discoverability-check/SKILL.md` defines when to call each tool, requires explicit agreement before the ten-question stage, keeps unbranded questions neutral, and distinguishes a source appearance, mention and recommendation. It also controls the final report shape and preserves the evidence boundary. Upload or import the skill during plugin submission and repeat developer-mode tests after every imported-skill refresh.

## Commercial and evidence boundary

The tool must not turn a bounded search observation into a fixed ChatGPT ranking, independent recommendation, customer-demand or conversion claim. It must not describe metadata compliance as commercial success. Consumer observations, API tests and real conversion data remain separate evidence classes.

## OpenAI tool annotations

- `readOnlyHint: true`
- `openWorldHint: true`
- `destructiveHint: false`

## Deployment state

Version 0.11.0 is deployed and remotely verified. It separates the API-backed website form from the API-free MCP workflow. Its three tools work without component UI; the readiness and summary tools also return a server-generated result card. Refresh imported tools and skills before testing the updated ChatGPT experience. OpenAI review submission and public listing remain separate release states.
