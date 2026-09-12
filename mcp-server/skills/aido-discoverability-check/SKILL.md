---
name: aido-discoverability-check
description: Check whether AI can access, understand and surface a public business website. Use for AI discoverability, AI visibility, AEO, GEO, branded discovery, customer-question research, or why a business is absent from AI answers. Do not use it to claim a fixed ranking or predict demand or sales.
---

# AIDO Discoverability Check

Give the user a short, sourced view of two separate questions:

1. Can AI and search systems access and understand the public website?
2. Does the business appear when representative customer questions are researched in this ChatGPT session?

The user's instructions take precedence over this workflow. Never claim evidence that the tools or cited sources do not establish.

## Website readiness check

Obtain the public website URL. Use the business name if supplied or clearly stated on the site. Optional service area, priority services and target customer improve relevance but remain user-supplied context.

Call `check_ai_presence`. It fetches public website evidence only; it does not run an AI model or discovery searches.

Report, in plain English:

- what is accessible and clearly explained;
- up to three material gaps;
- the most useful next action;
- one quiet note that website readiness does not show whether AI will mention or recommend the business.

Do not invent a score or turn a technical check into a ranking claim.

## Optional ten-question discovery sample

Offer the extended sample after the website result. A direct request for the ten-question test already counts as consent; otherwise continue only after the user agrees. Explain briefly that it uses research tools available in their ChatGPT session and may count towards their ChatGPT limits.

Call `prepare_ai_discovery_research` with the confirmed business context. The returned questions are the complete test set. The MCP generated them without an OpenAI API call and has not searched them.

If web research is available:

1. Search each returned question separately and exactly as written.
2. For unbranded questions, never add the target business, domain or hints about it.
3. Use only the resulting answer and its cited sources when classifying the target.
4. Record the question ID, kind, completion time, concise answer summary and up to five cited source URLs.
5. Stop if research tools or usage limits prevent completion. Summarise only completed, sourced questions and state the completed count.

Do not count a question when the answer has no cited public source. Do not repeat or rephrase a search to obtain a more favourable result. This is a dated within-session sample, not a blind benchmark: the conversation already contains the target business.

Before classifying or reporting the discovery sample, read [references/evidence-and-reporting.md](references/evidence-and-reporting.md).

Call `summarise_ai_discovery_research` only with observations that meet those evidence rules.

If web research is unavailable, give the user the question pack and say the discovery stage could not be completed in this session. Never invent observations, ask for an API key or imply that the MCP ran the searches.

## Unsupported requests

- For a fixed ChatGPT or AI ranking, explain that this workflow provides dated observations, not a permanent rank.
- For private, local or authenticated websites, explain that the checker accepts only public HTTP or HTTPS pages.
- For requests to change a website, return findings only unless the user separately authorises work in a website project.
- Never claim demand, conversion, revenue or causal impact from this check.
