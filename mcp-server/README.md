# Signal

Signal is a ChatGPT plugin for a complete visibility research cycle: check visibility, understand evidence, choose a change, and check again. Its existing Cloudflare Worker and MCP endpoint are preserved at `https://mcp.sr3h.uk/mcp`.

Version 0.12.0 adds saved studies, an automatic Durable Object runner, fresh GPT API web searches, separate answer assessment, evidence-linked reasons and intervention suggestions, immutable implementation records and matched before-and-after comparisons. Deployment and host-refresh evidence are recorded separately in RELEASE_READINESS.md.

## Customer flow

The user supplies a public business website and a confirmed service. Signal freezes ten questions and three repeats by default; a focused study can use two to ten custom questions and one to three repeats. Branded diagnostics remain separate from unbranded customer questions.

The background runner captures each raw answer with sources, citations, actual model, request time and usage. The neutral capture receives only the question and frozen settings, with API storage disabled and no personal history or target briefing. A separate request introduces the target to classify the already saved answer. Missing searches, incomplete answers, unsupported classifications and interrupted captures remain explicit failures, not negative visibility results. Interrupted requests are never silently replayed.

The findings distinguish checked website gaps from hypotheses explaining non-appearance. Each suggested change links to saved evidence and the frozen questions to retest. The user chooses a change and confirms its implementation date and evidence. Signal retains the baseline and reruns the same questions. Comparison checks actual model identity and matched coverage, reports mentions and recommendations separately, and preserves increases, decreases, mixed results and no clear change. Missing pairs or model drift make the conclusion inconclusive. It does not prove statistical significance, causation, demand or consumer ChatGPT visibility.

## MCP tools

- `create_visibility_study`: check the public site and save the frozen plan; no GPT searches.
- `run_visibility_study`: start an idempotent baseline or reassessment in the background.
- `get_visibility_study`: read progress, findings and paginated raw evidence without new API calls.
- `record_visibility_intervention`: record a chosen proposal or confirmed implementation; does not change the website.
- `compare_visibility_runs`: compare saved, matched before-and-after results without new API calls.
- `retry_visibility_run`: explicitly recover failed answers or analysis while retaining prior evidence and failure history.
- `cancel_visibility_run`: stop a requested run and retain completed evidence.
- `delete_visibility_study`: delete a study and its evidence only at the user's explicit request.

The three existing technical/within-chat tools remain compatible: `check_ai_presence`, `prepare_ai_discovery_research` and `summarise_ai_discovery_research`. Those tools still make no SR3H OpenAI API calls. They are distinct from the saved isolated research path.

## Storage and access

The Worker uses the existing encrypted `OPENAI_API_KEY` and `ABUSE_HASH_SECRET` secrets. `VISIBILITY_STUDIES` stores one Durable Object per cryptographically random 256-bit private reference. Raw answers use separate storage records to stay below individual value limits. No study list is exposed. Anyone holding a reference can access its study; this is capability access, not an authenticated user account. Keep references in the private chat and out of public reports, URLs and logs. The user can delete stored records. In-flight results cannot recreate a deleted study. Up to eight runs and ten implementation records are retained per study.

The isolated runner has a separate persistent allowance from the website form: at most 80 sample/analysis reservations per UTC day globally, 80 per hashed visitor and 80 per target website. The default thirty-answer baseline plus reassessment and their analyses fit within that allowance. A sample allows one capture and one assessment; run analysis also reserves allowance. Settings are configurable through the SIGNAL_DAILY_* Worker variables. These are bounded service allowances, not monetary billing caps. Failed calls can incur usage; no automatic provider retry is made.

The existing website form retains its independent six-question sample, quota and 24-hour result cache. Saved study reruns never use that cache.

## Verification and deployment

```sh
npm run check
npm test
npm run deploy
npm run verify:remote -- https://mcp.sr3h.uk/mcp https://sr3h.uk
npm run verify:skill:remote -- https://mcp.sr3h.uk/mcp
```

The UI card is self-contained, responsive and safe for returned text. The skill retains its existing internal identity and digest-verified resources; its human-visible name and workflow are Signal. Refresh imported tools and skills in the existing ChatGPT connection after deployment. Server publication does not itself prove the host imported the update or that an intervention improved a customer's visibility. Public directory submission remains a separate explicit action.
