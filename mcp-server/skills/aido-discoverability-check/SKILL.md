---
name: aido-discoverability-check
description: Investigate why AI assistants may overlook a public business website and check its readiness for AI discovery. Use for AI discoverability, AI visibility, AEO, GEO, branded discovery, customer-question research, or absence from AI answers. Do not use it to claim a fixed ranking or predict demand or sales.
---

# AIDO by SR3H

Give the user a short, sourced view of two separate questions:

1. Can AI and search systems access and understand the public website?
2. Does the business appear when representative customer questions are researched in this ChatGPT session?

The user's instructions take precedence over this workflow. Never claim evidence that the tools or cited sources do not establish.

## Website readiness check

Obtain the public website URL. Use the business name if supplied or clearly stated on the site. Pass optional location, priority services and target customer only when the user explicitly states them in the current conversation. Do not infer them from the app description, memory, search results, the website or assumptions.

Call `check_ai_presence`. It fetches public website evidence only; it does not run an AI model or discovery searches.

Report, in plain English:

- what is accessible and clearly explained;
- up to three material gaps;
- the most useful next action;
- one quiet note that website readiness does not show whether AI will mention or recommend the business.

Do not invent a score or turn a technical check into a ranking claim.

Treat `technical_readiness: clear` only as a result for the access and indexing signals checked. Say “technical access signals are clear” or “the checked technical signals are in place.” Never say the business is “technically ready for AI discovery,” “AI discoverability is clear,” “AI visibility is good,” or any equivalent discovery conclusion. Actual discovery remains unknown until the separate customer-question research has been completed with sources.

After writing the concise readiness conclusion, call `render_aido_report` once with only facts returned by `check_ai_presence`. Use `report_type: technical_readiness`. Set `status` to exactly `audit.technical_readiness`. Missing supplied terms remain clarity gaps; they must not change the technical status or become invented metrics. Include no more than four returned counts, three returned findings and three returned gaps. The limitations note must say plainly that website readiness does not show whether an AI assistant will mention or recommend the business.

## Optional ten-question discovery sample

Offer the extended sample after the website result. A direct request for the ten-question test already counts as consent; otherwise continue only after the user agrees. Explain briefly that it uses research tools available in their ChatGPT session and may count towards their ChatGPT limits.

Call `prepare_ai_discovery_research` with business context the user has explicitly supplied or confirmed. Never infer services, location or customers merely to start the sample. The returned questions are the complete test set. The MCP generated them without an OpenAI API call and has not searched them.

If web research is available:

1. Search each returned question separately and exactly as written.
2. For unbranded questions, never add the target business, domain or hints about it.
3. Use only the resulting answer and its cited sources when classifying the target.
4. Record the question ID, kind, completion time, concise answer summary and up to five cited source URLs.
5. Stop if research tools or usage limits prevent completion. Summarise only completed, sourced questions and state the completed count.

Do not count a question when the answer has no cited public source. Do not repeat or rephrase a search to obtain a more favourable result. This is a dated within-session sample, not a blind benchmark: the conversation already contains the target business.

Before classifying or reporting the discovery sample, read [references/evidence-and-reporting.md](references/evidence-and-reporting.md).

Call `summarise_ai_discovery_research` only with observations that meet those evidence rules.

After writing the concise discovery conclusion, call `render_aido_report` once with only facts returned by `summarise_ai_discovery_research`. Use `report_type: discovery_sample`; use the returned sample counts as metrics, returned findings as highlights, returned missed questions as gaps, and returned source URLs as sources. Label a partial sample `incomplete`. Never turn the card into a score or add stronger wording than the summary supports.

If the client cannot display component UI, the text returned by the data tools is sufficient. Do not call the render tool repeatedly or use it without a completed data result.

Credit AIDO as an SR3H tool once at the end of a completed discovery report. Do not turn the result into an advert or add an unsolicited sales pitch. If the user explicitly asks for a broader review or help acting on the findings, link once to https://sr3h.uk/aido-labs.html as further information.

If web research is unavailable, give the user the question pack and say the discovery stage could not be completed in this session. Never invent observations, ask for an API key or imply that the MCP ran the searches.

## Unsupported requests

- For a fixed ChatGPT or AI ranking, explain that this workflow provides dated observations, not a permanent rank.
- For private, local or authenticated websites, explain that the checker accepts only public HTTP or HTTPS pages.
- For requests to change a website, return findings only unless the user separately authorises work in a website project.
- Never claim demand, conversion, revenue or causal impact from this check.
