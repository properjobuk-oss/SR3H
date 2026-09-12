import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.argv[2];
const auditTarget = process.argv[3] || "https://sr3h.uk";
if (!endpoint) {
  console.error("Usage: npm run probe:remote -- https://host.example/mcp [https://site-to-check.example]");
  process.exit(2);
}

const optionalContext = {
  business_name: "SR3H",
  location_or_service_area: "Oxford",
  priority_services: ["software", "human-AI systems"],
  target_customer: "organisations with complex software requirements"
};
const optionalFieldNames = Object.keys(optionalContext);
const client = new Client({ name: "sr3h-production-probe", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  const healthUrl = new URL("/health", endpoint);
  const health = await fetch(healthUrl, { headers: { accept: "application/json" } });
  if (!health.ok) throw new Error(`health endpoint returned HTTP ${health.status}`);
  const healthBody = await health.json();

  await client.connect(transport);
  const tools = await client.listTools();
  const tool = tools.tools.find((candidate) => candidate.name === "check_ai_presence");
  if (!tool) throw new Error("check_ai_presence was not advertised");

  const properties = tool.inputSchema?.properties || {};
  const missingOptionalFields = optionalFieldNames.filter((name) => !properties[name]);
  if (missingOptionalFields.length) {
    throw new Error(`tool schema is missing optional fields: ${missingOptionalFields.join(", ")}`);
  }

  const result = await client.callTool({
    name: tool.name,
    arguments: { website_url: auditTarget, ...optionalContext }
  });
  if (result.isError) throw new Error(result.content?.[0]?.text || "audit call failed");

  const structured = result.structuredContent;
  if (!structured?.audit?.technical_readiness) throw new Error("audit result was not structured as expected");
  if (structured.supplied_context?.target_customer !== optionalContext.target_customer) {
    throw new Error("target_customer did not reach the structured result");
  }
  const returnedTerms = new Set((structured.supplied_context_presence || []).map((item) => item.term));
  const missingTerms = [optionalContext.business_name, optionalContext.location_or_service_area, ...optionalContext.priority_services]
    .filter((term) => !returnedTerms.has(term));
  if (missingTerms.length) throw new Error(`optional terms did not reach the audit: ${missingTerms.join(", ")}`);

  console.log(JSON.stringify({
    ok: true,
    health: healthBody,
    server: client.getServerVersion(),
    tool: tool.name,
    optional_fields_advertised: optionalFieldNames,
    optional_fields_received: true,
    technical_readiness: structured.audit.technical_readiness,
    discoverability_status: structured.discoverability?.status || "not_in_this_version"
  }, null, 2));
} finally {
  await client.close();
}
