# Signal plugin

The existing AIDO connection is upgraded in place to Signal. Its hosting and MCP endpoint remain `https://mcp.sr3h.uk/mcp`.

The full workflow is implemented in `mcp-server/src/visibility-tools.js`, `visibility-study.js` and `visibility-model.js`: create a frozen plan, run independent API searches in a durable background job, inspect retained answers, review evidence-linked hypotheses and interventions, record a user-chosen change, rerun and compare. Each capture excludes target and conversation context. Target-aware assessment occurs only after the raw answer is saved. Read results without paying for another search.

The existing website-only and within-chat question tools remain compatible and distinct. The latter are not blind tests because the current conversation contains the target. API samples are also distinct from consumer ChatGPT Temporary Chats.

The Signal skill defines the simple customer journey and retains its internal identifier for compatibility. Each saved study is accessed by an unguessable private reference rather than a user account. Anyone with the reference can access that study; the reference must stay out of public reports. Study deletion and run cancellation are supported.

Before-and-after comparison uses frozen questions and settings, actual captured model identities and matching repetitions. Failed captures are not absences. Results show observed increases, decreases, mixed outcomes or no clear change; incomplete coverage and model drift are inconclusive. Causation, statistical significance, demand and sales remain unmeasured.

See `mcp-server/README.md` for limits and deployment commands and `mcp-server/RELEASE_READINESS.md` for retained verification evidence. No public directory submission is implied by deployment.
