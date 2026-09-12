# Release notes — AIDO by SR3H 0.11.0

AIDO provides a read-only check of whether a public business website is accessible and clearly explained, plus an optional ten-question AI discovery sample researched with tools available in the user's ChatGPT session.

This release adds:

- a compact, accessible inline result card for completed readiness and discovery results;
- server-generated cards attached directly to the readiness and discovery-summary tools, removing a model-authored rendering step;
- clearer activation and non-activation descriptions for every tool;
- explicit activation language for businesses asking why AI assistants overlook them, including AI visibility, AEO and GEO requests;
- source URLs in the deterministic discovery summary;
- stricter skill instructions and required answer summaries for every researched observation;
- explicit provenance rules so optional location, service and customer context is never inferred;
- exact preservation of the technical readiness status in the final card;
- plain technical-access wording that does not overstate readiness as observed AI discovery;
- five positive and five negative submission test cases;
- no external UI scripts, fonts, tracking, iframe or network requests.

The MCP makes no SR3H OpenAI API calls, requires no login, does not alter websites and does not claim a permanent ranking, demand or sales impact.

Deployment and developer-mode evidence are recorded separately in `../RELEASE_READINESS.md`; this note must not be treated as proof of deployment or OpenAI approval.
