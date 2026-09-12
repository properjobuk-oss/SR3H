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
  if (healthBody.version !== "0.7.0") throw new Error(`expected version 0.7.0, received ${healthBody.version || "unknown"}`);

  await client.connect(transport);
  const serverVersion = client.getServerVersion();
  const tools = await client.listTools();
  const tool = tools.tools.find((candidate) => candidate.name === "check_ai_presence");
  const prepareTool = tools.tools.find((candidate) => candidate.name === "prepare_ai_discovery_research");
  const summaryTool = tools.tools.find((candidate) => candidate.name === "summarise_ai_discovery_research");
  if (!tool) throw new Error("check_ai_presence was not advertised");
  if (!prepareTool) throw new Error("prepare_ai_discovery_research was not advertised");
  if (!summaryTool) throw new Error("summarise_ai_discovery_research was not advertised");
  if (!tool.outputSchema) throw new Error("check_ai_presence has no output schema");
  if (tool.annotations?.readOnlyHint !== true || tool.annotations?.openWorldHint !== true || tool.annotations?.destructiveHint !== false) {
    throw new Error("tool safety annotations are incomplete or inaccurate");
  }
  const result = await client.callTool({ name: tool.name, arguments: { website_url: auditTarget } });
  if (result.isError) throw new Error(result.content?.[0]?.text || "audit call failed");
  if (!result.structuredContent?.audit?.technical_readiness) throw new Error("audit result was not structured as expected");
  const summary = await client.callTool({ name: summaryTool.name, arguments: {
    website_url: auditTarget,
    business_name: "Release Test Business",
    observations: [{
      question: "Which service should I use for this release test?",
      kind: "category",
      appearance: "not_seen",
      answer_summary: "No target appearance was recorded in this protocol test.",
      evidence_urls: [],
      other_providers: []
    }]
  } });
  if (summary.isError || summary.structuredContent?.sample?.completed !== 1) throw new Error("extended summary tool did not return the expected structured result");
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
    discoverability_status: result.structuredContent.discoverability?.status,
    summary_tool_verified: true,
    observations: result.structuredContent.observations.length,
    gaps: result.structuredContent.gaps.length,
    private_network_rejected: true
  }, null, 2));
} finally {
  await client.close();
}
