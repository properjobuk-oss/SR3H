export const RESEARCH_KINDS = Object.freeze([
  "branded",
  "category",
  "problem",
  "high_intent",
  "differentiator",
  "location",
  "comparison",
  "evidence",
  "use_case",
  "alternative"
]);

function cleanString(value, limit = 400) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalise(value) {
  return cleanString(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function validatePlan(value, fallbackBusiness, target) {
  if (!value || typeof value !== "object" || !Array.isArray(value.questions) || value.questions.length !== 10) {
    throw new Error("invalid_research_plan");
  }
  const kinds = new Set(RESEARCH_KINDS);
  const questions = value.questions.map((item, index) => {
    const kind = cleanString(item?.kind, 40);
    const question = cleanString(item?.question, 280);
    if (!kinds.has(kind) || !question) throw new Error("invalid_research_plan");
    return { id: `q${index + 1}`, kind, question };
  });
  if (new Set(questions.map((item) => item.kind)).size !== RESEARCH_KINDS.length) throw new Error("invalid_research_mix");
  if (new Set(questions.map((item) => normalise(item.question))).size !== questions.length) throw new Error("duplicate_research_question");

  const business = cleanString(value.business, 120) || fallbackBusiness;
  const businessKey = normalise(business);
  const targetKey = normalise(target.replace(/^www\./, ""));
  for (const item of questions) {
    if (item.kind === "branded") continue;
    const questionKey = normalise(item.question);
    if ((businessKey.length > 2 && questionKey.includes(businessKey)) || (targetKey.length > 2 && questionKey.includes(targetKey))) {
      throw new Error("target_leaked_into_unbranded_question");
    }
  }
  return { business, questions };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanResearchPhrase(value, business, target, fallback, limit = 100) {
  let phrase = cleanString(value, limit);
  const domain = target.replace(/^www\./, "");
  const domainStem = domain.split(".")[0];
  for (const protectedValue of [business, domain, domainStem]) {
    const term = cleanString(protectedValue, 120);
    if (term.length > 2) phrase = phrase.replace(new RegExp(escapeRegExp(term), "gi"), " ");
  }
  phrase = phrase.replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "");
  return phrase || fallback;
}

function buildQuestionPlan(input, target) {
  const business = cleanString(input.business_name, 120);
  const service = cleanResearchPhrase(input.priority_services?.[0], business, target, "this type of service", 120);
  const audience = cleanResearchPhrase(input.target_customer, business, target, "someone choosing a provider");
  const rawLocation = cleanResearchPhrase(input.location_or_service_area, business, target, "my area");
  const location = /^(?:united kingdom|united states|united arab emirates|netherlands)$/i.test(rawLocation)
    ? `the ${rawLocation}`
    : rawLocation;
  const plan = {
    business,
    questions: [
      { kind: "branded", question: `What does ${business} offer, who is it for, and what evidence supports its claims?` },
      { kind: "category", question: `Which providers offer ${service}?` },
      { kind: "problem", question: `I need ${service}. What should I look for, and which providers could help?` },
      { kind: "high_intent", question: `Which providers are worth considering for ${service}?` },
      { kind: "differentiator", question: `Which providers for ${service} clearly explain their method, scope and limitations?` },
      { kind: "location", question: `Who provides ${service} in ${location}?` },
      { kind: "comparison", question: `How do the main options for ${service} compare?` },
      { kind: "evidence", question: `Which providers of ${service} show credible examples, independent evidence or results?` },
      { kind: "use_case", question: `Which options for ${service} are best suited to ${audience}?` },
      { kind: "alternative", question: `What are the alternatives to using a specialist provider for ${service}?` }
    ]
  };
  return validatePlan(plan, business, target);
}

export async function prepareExtendedResearch(input, auditResult) {
  const target = new URL(auditResult.audit.final_url).hostname.toLowerCase();
  const plan = buildQuestionPlan(input, target);
  return {
    status: "ready",
    business: plan.business,
    website_url: auditResult.audit.final_url,
    created_at: new Date().toISOString(),
    question_count: 10,
    questions: plan.questions,
    user_confirmation_required: true,
    search_note: "No AI searches have been run. If the user agreed to continue and ChatGPT web search is available, ask each question separately and record only what the answer and cited sources show. If search is unavailable, say so and do not invent results.",
    usage_note: "The question pack uses no SR3H OpenAI API calls. Any further research uses ChatGPT’s available tools and may count towards the user’s ChatGPT limits.",
    next_tool: "summarise_ai_discovery_research"
  };
}

function providerCounts(observations) {
  const providers = new Map();
  for (const item of observations) {
    for (const provider of item.other_providers || []) {
      const name = cleanString(provider, 120);
      const key = normalise(name);
      if (!key) continue;
      const current = providers.get(key) || { name, appearances: 0 };
      current.appearances += 1;
      providers.set(key, current);
    }
  }
  return [...providers.values()].sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name)).slice(0, 5);
}

function validateObservations(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) throw new Error("invalid_observation_count");
  const ids = new Set();
  const kinds = new Set();
  const questions = new Set();
  for (const item of items) {
    if (!/^q(?:[1-9]|10)$/.test(item.question_id || "") || ids.has(item.question_id)) throw new Error("invalid_or_duplicate_question_id");
    if (!RESEARCH_KINDS.includes(item.kind) || kinds.has(item.kind)) throw new Error("invalid_or_duplicate_question_kind");
    const questionKey = normalise(item.question);
    if (!questionKey || questions.has(questionKey)) throw new Error("invalid_or_duplicate_question");
    if (!item.checked_at || Number.isNaN(Date.parse(item.checked_at))) throw new Error("invalid_checked_at");
    if (!cleanString(item.answer_summary, 600)) throw new Error("missing_answer_summary");
    if (!Array.isArray(item.evidence_urls) || item.evidence_urls.length < 1 || item.evidence_urls.length > 5) throw new Error("missing_search_evidence");
    const positive = item.appearance !== "not_seen";
    if (positive && (!item.target_evidence_url || !item.evidence_urls.includes(item.target_evidence_url))) throw new Error("missing_target_evidence");
    if (!positive && item.target_evidence_url) throw new Error("unexpected_target_evidence");
    ids.add(item.question_id);
    kinds.add(item.kind);
    questions.add(questionKey);
  }
}

export function summariseExtendedResearch(input) {
  validateObservations(input.observations);
  const observations = input.observations.map((item) => ({
    ...item,
    question: cleanString(item.question, 280),
    answer_summary: cleanString(item.answer_summary, 600),
    other_providers: (item.other_providers || []).map((value) => cleanString(value, 120)).filter(Boolean)
  }));
  const unbranded = observations.filter((item) => item.kind !== "branded");
  const appeared = (item) => item.appearance !== "not_seen";
  const recommended = (item) => item.appearance === "recommended";
  const unbrandedFound = unbranded.filter(appeared);
  const unbrandedRecommended = unbranded.filter(recommended);
  const branded = observations.filter((item) => item.kind === "branded");
  const brandedFound = branded.filter(appeared).length;
  const sourceUrls = [...new Set(observations.flatMap((item) => item.evidence_urls || []))].slice(0, 20);
  const evidenceSources = sourceUrls.length;

  const headline = !unbranded.length
    ? brandedFound
      ? `${input.business_name} was found in the branded check; no unbranded customer questions were completed.`
      : `${input.business_name} was not seen in the only question completed.`
    : unbrandedRecommended.length
      ? `${input.business_name} was recommended in ${unbrandedRecommended.length} of ${unbranded.length} customer-need searches.`
      : unbrandedFound.length
        ? `${input.business_name} appeared in ${unbrandedFound.length} of ${unbranded.length} customer-need searches, but was not recommended.`
        : brandedFound
          ? `${input.business_name} was found by name, but not in ${unbranded.length} customer-need searches.`
          : `${input.business_name} was not seen in this ${observations.length}-question sample.`;

  const notSeen = unbranded.filter((item) => item.appearance === "not_seen");
  const onlyMentioned = unbranded.filter((item) => ["mentioned", "source_only"].includes(item.appearance));
  const findings = unbranded.length ? [
    unbrandedFound.length
      ? `It appeared for ${unbrandedFound.length} of ${unbranded.length} unbranded customer questions.`
      : `It did not appear for the ${unbranded.length} unbranded customer questions completed.`,
    unbrandedRecommended.length
      ? `It was presented as a suitable option ${unbrandedRecommended.length} time${unbrandedRecommended.length === 1 ? "" : "s"}.`
      : onlyMentioned.length
        ? `It was visible in some answers, but none presented it as a suitable option.`
        : `No unbranded answer presented it as a suitable option.`,
    notSeen.length
      ? `It was not seen for questions including “${notSeen.slice(0, 2).map((item) => item.question).join("” and “")}”.`
      : "The business appeared in every unbranded question completed in this sample."
  ] : [
    "Discovery beyond the business name remains untested because no unbranded customer question was completed.",
    brandedFound ? "The branded question returned the business with cited evidence." : "The branded question did not return the business.",
    "Complete at least one unbranded customer question before drawing a discovery conclusion."
  ];

  const nextActions = [];
  if (!unbranded.length) nextActions.push("Complete the unbranded customer questions with cited web research before changing the website.");
  if (notSeen.length) nextActions.push(`Start with the most commercially important missed question: “${notSeen[0].question}” Check whether one clear public page answers it and supports the answer with evidence.`);
  if (onlyMentioned.length) nextActions.push("Where the business was only mentioned or cited, strengthen the proof that makes it a suitable choice, such as clear scope, evidence, case studies or independent validation.");
  if (notSeen.some((item) => item.kind === "location")) nextActions.push("Make the genuine service area explicit on the relevant service page and in consistent organisation or service details.");
  if (nextActions.length < 3) nextActions.push("Compare the sources and providers that appeared for missed questions before creating new pages or changing wording.");
  if (nextActions.length < 3) nextActions.push("Repeat the same dated questions after a meaningful change; do not treat a single run as a fixed ranking.");

  return {
    status: observations.length === 10 ? "complete" : "partial",
    business: input.business_name,
    website_url: input.website_url,
    checked_at: new Date().toISOString(),
    headline,
    sample: {
      expected: 10,
      completion_status: observations.length === 10 ? "complete" : "partial",
      evidence_sources: evidenceSources,
      completed: observations.length,
      branded_found: brandedFound,
      branded_checked: branded.length,
      unbranded_found: unbrandedFound.length,
      unbranded_checked: unbranded.length,
      unbranded_recommended: unbrandedRecommended.length
    },
    findings,
    strongest_questions: unbrandedFound.slice(0, 3).map((item) => ({ question: item.question, appearance: item.appearance })),
    missed_questions: notSeen.slice(0, 3).map((item) => item.question),
    other_providers: providerCounts(observations),
    source_urls: sourceUrls,
    next_actions: nextActions.slice(0, 3),
    limits: [
      "A dated sample of the searches completed in this conversation; results can vary between services and over time.",
      "It does not establish a fixed ranking or measure demand, enquiries, sales or revenue."
    ],
    deeper_review: "AIDO is developed by SR3H. Learn about the method and its limits at https://sr3h.uk/aido-labs.html."
  };
}

export const EXTENDED_RESEARCH_LIMITS = Object.freeze({ questionCount: 10, openAiApiCalls: 0, webSearchCalls: 0 });
