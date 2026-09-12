const endpoint = process.argv[2] || "https://mcp.sr3h.uk/check";
const websiteUrl = process.argv[3] || "https://sr3h.uk";

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://sr3h.uk"
  },
  body: JSON.stringify({
    website_url: websiteUrl,
    business_name: "SR3H",
    location_or_service_area: "Oxford",
    priority_services: ["AI discoverability testing"],
    target_customer: "UK businesses"
  })
});

if (!response.ok) throw new Error(`website check returned HTTP ${response.status}: ${await response.text()}`);
const body = await response.json();
const result = body.result;
if (!result?.audit?.technical_readiness) throw new Error("website check did not return a technical readiness result");
if ("_analysis_context" in result) throw new Error("website check exposed private analysis context");
if (!result.discoverability?.status) throw new Error("website check did not report its discovery status");

console.log(JSON.stringify({
  ok: true,
  technical_readiness: result.audit.technical_readiness,
  observed_signals: result.observations?.length || 0,
  gaps: result.gaps?.length || 0,
  discovery_status: result.discoverability.status,
  discovery_reason: result.discoverability.reason || null,
  questions_completed: result.discoverability.questions?.length || 0,
  source_count: result.discoverability.sources?.length || 0,
  next_action: result.next_action
}, null, 2));
