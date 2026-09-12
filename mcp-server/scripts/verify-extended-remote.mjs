import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [endpoint, websiteUrl, businessName, priorityService, location = ""] = process.argv.slice(2);
if (!endpoint || !websiteUrl || !businessName || !priorityService) {
  console.error("Usage: node scripts/verify-extended-remote.mjs <mcp-url> <website-url> <business-name> <priority-service> [location]");
  process.exit(2);
}

const client = new Client({ name: "aido-extended-release-verifier", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const prepare = tools.tools.find((tool) => tool.name === "prepare_ai_discovery_research");
  const summarise = tools.tools.find((tool) => tool.name === "summarise_ai_discovery_research");
  if (!prepare || !summarise) throw new Error("extended research tools were not advertised");

  const prepared = await client.callTool({ name: prepare.name, arguments: {
    website_url: websiteUrl,
    business_name: businessName,
    priority_services: [priorityService],
    ...(location ? { location_or_service_area: location } : {})
  } });
  if (prepared.isError) throw new Error(prepared.content?.[0]?.text || "question pack failed");
  const pack = prepared.structuredContent;
  if (pack?.status !== "ready" || pack.question_count !== 10 || pack.questions?.length !== 10) {
    throw new Error(pack?.note || "question pack was not ready");
  }
  const businessKey = businessName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const leaked = pack.questions.some((item) => item.kind !== "branded" && item.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(businessKey));
  if (leaked) throw new Error("business name leaked into an unbranded question");
  if (!/no SR3H OpenAI API calls/i.test(pack.usage_note || "")) throw new Error("question pack did not state the API boundary");

  const observations = pack.questions.map((item) => ({
    question: item.question,
    kind: item.kind,
    appearance: "not_seen",
    answer_summary: "No search was run in this protocol verification."
  }));
  const summary = await client.callTool({ name: summarise.name, arguments: {
    website_url: websiteUrl,
    business_name: businessName,
    observations
  } });
  if (summary.isError || summary.structuredContent?.sample?.completed !== 10) throw new Error("summary tool failed");

  console.log(JSON.stringify({
    ok: true,
    server: client.getServerVersion(),
    question_count: pack.question_count,
    kinds: pack.questions.map((item) => item.kind),
    user_confirmation_required: pack.user_confirmation_required,
    searches_run_by_planner: 0,
    openai_api_calls_by_planner: 0,
    summary_completed: summary.structuredContent.sample.completed
  }, null, 2));
} finally {
  await client.close();
}
