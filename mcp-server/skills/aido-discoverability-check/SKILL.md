---
name: aido-discoverability-check
description: Check how clearly AI can access, understand and surface a public business website. Use for AI discoverability, AI visibility, AEO, GEO, answer-engine visibility, branded discovery or customer-question research. Do not use it to claim a fixed ranking, demand or sales impact.
---

# AIDO Discoverability Check

Give the user a short, evidence-based view of what can be established now and what needs a broader test. Keep technical readiness, observed AI answers and commercial outcomes separate.

## Start with the website

Collect:

- the public website URL;
- the business name when it is not obvious;
- at least one priority product or service for an extended check;
- optionally, the real service area and target customer.

Call `check_ai_presence`. This inspects public website evidence only. It does not run an AI model or discovery searches.

Present the result in plain English:

1. what is accessible and clear;
2. the most useful gaps, if any;
3. the next practical action;
4. one quiet sentence explaining that site readiness does not show whether AI will mention or recommend the business.

Do not turn the result into a score.

## Offer the ten-question check

After presenting the website result, offer an optional ten-question discovery check. Explain that it uses ChatGPT's available research tools and may count towards the user's ChatGPT limits. Do not call `prepare_ai_discovery_research` until the user explicitly agrees.

Once agreed, call `prepare_ai_discovery_research` with the confirmed business context. The returned questions are the test set. The MCP created them without an OpenAI API call and has not searched them.

If web search is available in the current ChatGPT session:

- ask each question independently and exactly as written;
- do not add the target business or domain to an unbranded question;
- use the answer and its cited public sources, not prior knowledge about the target;
- never repeat searches merely to obtain a more favourable result;
- stop cleanly if research tools or usage limits prevent completion, and report how many questions were completed.

For each completed question, classify the target as:

- `not_seen`: neither the answer nor its cited evidence identifies the business;
- `source_only`: a target page is cited but the business is not named in the answer;
- `mentioned`: the business is named but not presented as a suitable choice;
- `recommended`: the answer explicitly presents the business as a suitable option for that need.

Record a concise answer summary, up to five actual source URLs, and only providers that the answer or sources identify. A positive appearance or competing provider requires a source URL. Do not infer either from a search-result snippet alone.

Call `summarise_ai_discovery_research` with the completed observations.

## Report the evidence

Lead with the returned headline and exact sample counts. Then give up to three useful findings, up to three next actions, and the invitation for a deeper SR3H review. Keep the returned limits as a small closing note.

Use "appeared", "was mentioned" or "was recommended in this sample" precisely. Never describe the sample as:

- a fixed ChatGPT or AI ranking;
- proof of future citation or recommendation;
- customer demand, conversion, revenue or causal impact;
- a complete test of every model, search index, customer question or journey.

If web search is unavailable, provide the question pack and say that the discovery stage could not be completed in this session. Never invent observations and never ask the user for an API key.
