import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.argv[2];
const auditTarget = process.argv[3] || "https://sr3h.uk";
if (!endpoint) {
  console.error("Usage: npm run verify:remote -- https://host.example/mcp [https://site-to-check.example]");
  process.exit(2);
}

const client = new Client({ name: "sr3h-release-verifier", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));
try {
  const healthUrl = new URL("/health", endpoint);
  const health = await fetch(healthUrl, { headers: { accept: "application/json" } });
  if (!health.ok) throw new Error(`health endpoint returned HTTP ${health.status}`);
  if (health.headers.get("cache-control") !== "no-store") throw new Error("health endpoint is missing no-store");
  if (health.headers.get("x-content-type-options") !== "nosniff") throw new Error("health endpoint is missing nosniff");
  const healthBody = await health.json();
  if (healthBody.ok !== true) throw new Error("health endpoint did not report ok");
  if (healthBody.version !== "0.11.0") throw new Error(`expected version 0.11.0, received ${healthBody.version || "unknown"}`);
  if (healthBody.service !== "AIDO by SR3H") throw new Error(`expected service name AIDO by SR3H, received ${healthBody.service || "unknown"}`);

  await client.connect(transport);
  const serverVersion = client.getServerVersion();
  if (serverVersion?.name !== "AIDO by SR3H") throw new Error(`expected server name AIDO by SR3H, received ${serverVersion?.name || "unknown"}`);
  const tools = await client.listTools();
  const tool = tools.tools.find((candidate) => candidate.name === "check_ai_presence");
  const prepareTool = tools.tools.find((candidate) => candidate.name === "prepare_ai_discovery_research");
  const summaryTool = tools.tools.find((candidate) => candidate.name === "summarise_ai_discovery_research");
  if (!tool) throw new Error("check_ai_presence was not advertised");
  if (!prepareTool) throw new Error("prepare_ai_discovery_research was not advertised");
  if (!summaryTool) throw new Error("summarise_ai_discovery_research was not advertised");
  if (tools.tools.length !== 3) throw new Error(`expected 3 tools, received ${tools.tools.length}`);
  if (tool._meta?.ui?.resourceUri !== "ui://aido/discoverability-report-v5.html") throw new Error("check tool is missing its AIDO UI resource");
  if (summaryTool._meta?.ui?.resourceUri !== "ui://aido/discoverability-report-v5.html") throw new Error("summary tool is missing its AIDO UI resource");
  if (!/never infer/i.test(tool.inputSchema?.properties?.priority_services?.description || "")) throw new Error("check tool does not protect optional context provenance");
  if (!tool.outputSchema) throw new Error("check_ai_presence has no output schema");
  if (tool.annotations?.readOnlyHint !== true || tool.annotations?.openWorldHint !== true || tool.annotations?.destructiveHint !== false) {
    throw new Error("tool safety annotations are incomplete or inaccurate");
  }
  const result = await client.callTool({ name: tool.name, arguments: { website_url: auditTarget } });
  if (result.isError) throw new Error(result.content?.[0]?.text || "audit call failed");
  if (!result.structuredContent?.audit?.technical_readiness) throw new Error("audit result was not structured as expected");
  if (result.structuredContent?.presentation?.status !== result.structuredContent.audit.technical_readiness) throw new Error("server-generated card changed the technical status");
  const summary = await client.callTool({ name: summaryTool.name, arguments: {
    website_url: auditTarget,
    business_name: "Release Test Business",
    observations: [{
      question_id: "q2",
      question: "Which service should I use for this release test?",
      kind: "category",
      checked_at: new Date().toISOString(),
      appearance: "not_seen",
      answer_summary: "No target appearance was recorded in this protocol test.",
      evidence_urls: [],
      other_providers: []
    }]
  } });
  if (!summary.isError) throw new Error("extended summary accepted an unsupported absence without cited search evidence");
  const resources = await client.listResources();
  const reportResource = resources.resources.find((item) => item.uri === tool._meta.ui.resourceUri);
  if (!reportResource || reportResource.mimeType !== "text/html;profile=mcp-app") throw new Error("AIDO report UI resource was not advertised correctly");
  const reportContents = await client.readResource({ uri: reportResource.uri });
  if (!reportContents.contents?.[0]?.text?.includes("ui/notifications/tool-result")) throw new Error("AIDO report UI resource was not readable");
  const rejected = await client.callTool({ name: tool.name, arguments: { website_url: "http://127.0.0.1/private" } });
  if (rejected.isError !== true || !rejected.content?.[0]?.text?.includes("invalid_url")) {
    throw new Error("private-network target was not rejected as expected");
  }
  console.log(JSON.stringify({
    ok: true,
    health: healthBody,
    server: serverVersion,
    tools: tools.tools.map((candidate) => candidate.name),
    technical_readiness: result.structuredContent.audit.technical_readiness,
    mcp_openai_api_calls: 0,
    unsupported_summary_rejected: true,
    server_generated_report_card_verified: true,
    observations: result.structuredContent.observations.length,
    gaps: result.structuredContent.gaps.length,
    private_network_rejected: true
  }, null, 2));
} finally {
  await client.close();
}
