import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { auditWebsite } from "./audit.js";

const SERVICE_VERSION = "0.3.1";
const MAX_MCP_REQUEST_BYTES = 64_000;
const MAX_WEB_REQUEST_BYTES = 8_000;
const WEB_ORIGINS = new Set([
  "https://sr3h.uk",
  "https://www.sr3h.uk",
  "http://127.0.0.1:4175",
  "http://localhost:4175"
]);
const signalStatusSchema = z.enum(["clear", "partial", "gap", "missing", "blocked", "unverified"]);
const auditInputShape = {
  website_url: z.string().url().max(2048).describe("Complete public website URL beginning with https:// or http://"),
  business_name: z.string().trim().min(1).max(120).optional().describe("Business or organisation name to look for on the checked page"),
  location_or_service_area: z.string().trim().min(1).max(160).optional().describe("Important location or service area to look for"),
  priority_services: z.array(z.string().trim().min(1).max(120)).max(8).optional().describe("Up to eight priority products or services to look for"),
  target_customer: z.string().trim().min(1).max(300).optional().describe("Optional target customer context for interpreting clarity; it is not used to infer demand")
};
const webAuditInputSchema = z.object({
  ...auditInputShape,
  company_website: z.literal("").optional()
}).strict();
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
  const labels = {
    clear: "AI search crawlers can access this website",
    partial: "Website visible, with improvements",
    blocked: "Access issue found"
  };
  const lead = `${labels[result.audit.technical_readiness] || labels.partial}\n${result.summary}`;
  if (!result.gaps.length) return `${lead}\nNext useful step: ${result.next_action}`;
  const gaps = result.gaps.slice(0, 3).map((gap) => `- ${gap.finding}`).join("\n");
  return `${lead}\nWhat to improve:\n${gaps}\nNext useful step: ${result.next_action}`;
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
    inputSchema: auditInputShape,
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

function webCors(response, origin) {
  const headers = new Headers(response.headers);
  if (origin && WEB_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cross-origin-resource-policy", "cross-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

async function readJsonBodyLimited(request, limit) {
  const declaredBytes = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > limit) throw new Error("request_too_large");
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(joined));
}

async function rateLimitAudit(env, target, request, prefix = "audit") {
  const limiter = prefix === "web-check"
    ? env.WEB_RATE_LIMITER || env.AUDIT_RATE_LIMITER
    : env.AUDIT_RATE_LIMITER;
  if (!limiter) return true;
  const targetKey = `${prefix}-target:${target}`;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipKey = `${prefix}-ip:${ip}`;
  const [targetResult, ipResult] = await Promise.all([
    limiter.limit({ key: targetKey }),
    limiter.limit({ key: ipKey })
  ]);
  return targetResult.success && ipResult.success;
}

async function handleWebCheck(request, env, fetchImpl) {
  const origin = request.headers.get("origin") || "";
  if (origin && !WEB_ORIGINS.has(origin)) {
    return webCors(jsonResponse({ error: "This checker can only be used from the SR3H website." }, 403), origin);
  }
  if (request.method === "OPTIONS") return webCors(new Response(null, { status: 204 }), origin);
  if (request.method !== "POST") return webCors(jsonResponse({ error: "Method not allowed." }, 405), origin);

  let parsed;
  try {
    const body = await readJsonBodyLimited(request, MAX_WEB_REQUEST_BYTES);
    parsed = webAuditInputSchema.safeParse(body);
  } catch (error) {
    const tooLarge = error?.message === "request_too_large";
    return webCors(jsonResponse({ error: tooLarge ? "The request is too large." : "The request was not valid JSON." }, tooLarge ? 413 : 400), origin);
  }
  if (!parsed.success) {
    return webCors(jsonResponse({ error: "Check the website address and optional details, then try again." }, 400), origin);
  }

  const { company_website: _honeypot, ...input } = parsed.data;
  let target = "invalid-target";
  try { target = new URL(input.website_url).hostname.toLowerCase() || target; } catch { /* schema reports malformed URLs */ }
  try {
    if (!(await rateLimitAudit(env, target, request, "web-check"))) {
      return webCors(jsonResponse({ error: "Too many checks. Wait one minute before trying again." }, 429, { "retry-after": "60" }), origin);
    }
  } catch {
    return webCors(jsonResponse({ error: "The checker is temporarily unavailable. Try again shortly." }, 503), origin);
  }

  try {
    const result = await auditWebsite(input, fetchImpl);
    return webCors(jsonResponse({ result }), origin);
  } catch (error) {
    const code = errorCode(error);
    console.error(JSON.stringify({ event: "web_audit_failed", error_code: code }));
    return webCors(jsonResponse({ error: publicErrorMessage(code), code }, code === "invalid_url" ? 400 : 422), origin);
  }
}

export async function handleRequest(request, env = {}, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname === "/check") return handleWebCheck(request, env, fetchImpl);
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
        const success = await rateLimitAudit(env, target, request);
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
    const server = createServer(fetchImpl);
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

export function createWorker(fetchImpl = fetch) {
  return {
    fetch(request, env) {
      return handleRequest(request, env, fetchImpl);
    }
  };
}

export default createWorker();
