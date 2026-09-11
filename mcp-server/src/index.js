import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { auditWebsite } from "./audit.js";

const SERVICE_VERSION = "0.2.0";
const MAX_MCP_REQUEST_BYTES = 64_000;
const signalStatusSchema = z.enum(["clear", "partial", "gap", "missing", "blocked", "unverified"]);
const auditResultSchema = z.object({
  audit: z.object({
    requested_url: z.string().url(),
    final_url: z.string().url(),
    checked_at: z.string().datetime(),
    technical_readiness: z.enum(["clear", "partial", "blocked"])
  }),
  summary: z.string(),
  observations: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: signalStatusSchema,
    evidence: z.string(),
    source_url: z.string().url()
  })),
  supplied_context_presence: z.array(z.object({ term: z.string(), found: z.boolean() })),
  supplied_context: z.object({
    target_customer: z.string().nullable(),
    note: z.string().nullable()
  }),
  gaps: z.array(z.object({
    id: z.string(),
    severity: z.enum(["high", "medium", "low"]),
    finding: z.string(),
    action: z.string()
  })),
  unknowns: z.array(z.string()),
  next_action: z.string(),
  deeper_analysis: z.string()
});

function errorCode(error) {
  if (error?.name === "AbortError") return "timeout";
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("publicly reachable") || message.includes("complete public") || message.includes("credentials") || message.includes("only public http")) return "invalid_url";
  if (message.includes("larger than")) return "response_too_large";
  if (message.includes("redirect")) return "redirect_error";
  if (message.includes("did not return an html")) return "non_html";
  if (message.includes("http ")) return "upstream_http_error";
  return "fetch_failed";
}

function publicErrorMessage(code) {
  const messages = {
    timeout: "The website took too long to respond.",
    invalid_url: "Enter a complete, publicly reachable HTTP or HTTPS website URL.",
    response_too_large: "The website response exceeded the audit size limit.",
    redirect_error: "The website could not be checked because its redirect chain was invalid or too long.",
    non_html: "The supplied URL did not return an HTML webpage.",
    upstream_http_error: "The website returned an unsuccessful HTTP response.",
    fetch_failed: "The website could not be reached from the audit service."
  };
  return messages[code] || messages.fetch_failed;
}

function conciseResult(result) {
  const lead = `${result.audit.technical_readiness.toUpperCase()}: ${result.summary}`;
  if (!result.gaps.length) return `${lead}\nNext: ${result.next_action}`;
  const gaps = result.gaps.slice(0, 3).map((gap) => `- ${gap.finding}`).join("\n");
  return `${lead}\nMain findings:\n${gaps}\nNext: ${result.next_action}`;
}

export function createServer(fetchImpl = fetch) {
  const server = new McpServer({
    name: "SR3H AI Presence Check",
    version: SERVICE_VERSION,
    websiteUrl: "https://sr3h.uk"
  }, {
    instructions: "Use check_ai_presence for a read-only, one-page technical discoverability check of a public website. Present its observations as crawl evidence only. Never turn the result into a claim about AI ranking, citation, recommendation, customer demand or conversion."
  });

  server.registerTool("check_ai_presence", {
    title: "Check website AI presence",
    description: "Inspect a public website for observable technical and representation signals that affect AI-search discoverability. Returns sourced findings, gaps and explicit unknowns. It does not claim to measure ChatGPT ranking, recommendations or conversions.",
    inputSchema: {
      website_url: z.string().url().max(2048).describe("Complete public website URL beginning with https:// or http://"),
      business_name: z.string().trim().min(1).max(120).optional().describe("Business or organisation name to look for on the checked page"),
      location_or_service_area: z.string().trim().min(1).max(160).optional().describe("Important location or service area to look for"),
      priority_services: z.array(z.string().trim().min(1).max(120)).max(8).optional().describe("Up to eight priority products or services to look for"),
      target_customer: z.string().trim().min(1).max(300).optional().describe("Optional target customer context for interpreting clarity; it is not used to infer demand")
    },
    outputSchema: auditResultSchema,
    annotations: {
      title: "Check website AI presence",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  }, async (input) => {
    try {
      const result = await auditWebsite(input, fetchImpl);
      return {
        content: [{ type: "text", text: conciseResult(result) }],
        structuredContent: result
      };
    } catch (error) {
      const code = errorCode(error);
      console.error(JSON.stringify({ event: "audit_failed", error_code: code }));
      return {
        isError: true,
        content: [{ type: "text", text: `The website could not be checked (${code}). ${publicErrorMessage(code)}` }]
      };
    }
  });
  return server;
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, HEAD, POST, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, mcp-protocol-version, mcp-session-id, last-event-id");
  headers.set("access-control-expose-headers", "mcp-session-id");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (url.pathname === "/health" && ["GET", "HEAD"].includes(request.method)) {
    return cors(new Response(request.method === "HEAD" ? null : JSON.stringify({ ok: true, service: "SR3H AI Presence Check", version: SERVICE_VERSION }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    }));
  }
  if (url.pathname !== "/mcp") return cors(new Response("Not found", { status: 404 }));

  if (request.method === "POST") {
    const declaredBytes = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_MCP_REQUEST_BYTES) {
      return cors(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "MCP request exceeds the 64 KB limit." }
      }), { status: 413, headers: { "content-type": "application/json" } }));
    }
  }

  if (request.method === "POST" && env.AUDIT_RATE_LIMITER) {
    try {
      const rpc = await request.clone().json();
      if (rpc?.method === "tools/call") {
        let target = "invalid-target";
        try { target = new URL(rpc?.params?.arguments?.website_url).hostname.toLowerCase() || target; } catch { /* invalid input shares a bounded key */ }
        const key = `audit:${target}`;
        const { success } = await env.AUDIT_RATE_LIMITER.limit({ key });
        if (!success) {
          console.warn(JSON.stringify({ event: "audit_rate_limited" }));
          return cors(new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: rpc.id ?? null,
            error: { code: -32000, message: "Rate limit exceeded. Wait one minute before trying again." }
          }), { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } }));
        }
      }
    } catch {
      // Let the MCP transport return the protocol-level parse or validation error.
    }
  }

  try {
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return cors(await transport.handleRequest(request));
  } catch (error) {
    console.error(JSON.stringify({ event: "mcp_request_failed", error_code: errorCode(error) }));
    return cors(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "The MCP request could not be completed." }
    }), { status: 500, headers: { "content-type": "application/json" } }));
  }
}

export default {
  fetch: handleRequest
};
