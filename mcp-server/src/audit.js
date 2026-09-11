import { validatePublicUrl } from "./url-safety.js";

export const LIMITS = Object.freeze({ redirects: 4, bytes: 1_000_000, timeoutMs: 10_000 });
const USER_AGENT = "SR3H-AIPresenceCheck/0.2 (+https://sr3h.uk/ai-presence-support.html)";

function compactSpace(value = "") {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ").trim();
}

function boundedText(value, limit) {
  if (!value) return null;
  const compact = compactSpace(value);
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readLimitedText(response, limit = LIMITS.bytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error(`Response is larger than the ${Math.round(limit / 1_000_000)} MB audit limit.`);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`Response is larger than the ${Math.round(limit / 1_000_000)} MB audit limit.`);
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

async function safeFetch(startUrl, fetchImpl, { accept = "text/html,*/*;q=0.8" } = {}) {
  let current = validatePublicUrl(startUrl);
  for (let redirects = 0; redirects <= LIMITS.redirects; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIMITS.timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept, "user-agent": USER_AGENT },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Website returned a redirect without a destination.");
      if (redirects === LIMITS.redirects) throw new Error("Website exceeded the redirect limit.");
      current = validatePublicUrl(new URL(location, current).href);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Website exceeded the redirect limit.");
}

function robotsGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const split = line.indexOf(":");
    if (split < 0) continue;
    const key = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (key === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if (agents.length && (key === "allow" || key === "disallow")) {
      rules.push({ type: key, path: value });
    }
  }
  flush();
  return groups;
}

export function evaluateRobots(text, userAgent = "oai-searchbot", path = "/") {
  const groups = robotsGroups(text);
  let selected = groups.filter((group) => group.agents.includes(userAgent.toLowerCase()));
  if (!selected.length) selected = groups.filter((group) => group.agents.includes("*"));
  if (!selected.length) return { allowed: true, matchedRule: null, sourceGroup: "none" };

  const matching = selected.flatMap((group) => group.rules)
    .map((rule) => {
      if (!rule.path) return null;
      const anchored = rule.path.endsWith("$");
      const raw = anchored ? rule.path.slice(0, -1) : rule.path;
      const pattern = raw.split("*").map(escapeRegExp).join(".*");
      const matches = new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path);
      return matches ? { ...rule, specificity: raw.replaceAll("*", "").length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.specificity - a.specificity || (a.type === "allow" ? -1 : 1));
  const match = matching[0] || null;
  return {
    allowed: !match || match.type === "allow",
    matchedRule: match,
    sourceGroup: selected.some((group) => group.agents.includes(userAgent.toLowerCase())) ? userAgent : "*"
  };
}

function attr(html, tagPattern, attribute) {
  const match = html.match(tagPattern);
  if (!match) return null;
  const attributeMatch = match[0].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return attributeMatch ? compactSpace(attributeMatch[1]) : null;
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = attr(tag, /<meta\b[^>]*>/i, "name") || attr(tag, /<meta\b[^>]*>/i, "property");
    if (key?.toLowerCase() === name.toLowerCase()) return attr(tag, /<meta\b[^>]*>/i, "content");
  }
  return null;
}

function canonicalHref(html, baseUrl) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const link of links) {
    const rel = attr(link, /<link\b[^>]*>/i, "rel")?.toLowerCase().split(/\s+/) || [];
    if (rel.includes("canonical")) {
      const href = attr(link, /<link\b[^>]*>/i, "href");
      if (href) {
        try {
          const url = new URL(href, baseUrl);
          if (["http:", "https:"].includes(url.protocol) && url.href.length <= 2048) return url.href;
        } catch { /* malformed canonicals are reported as absent */ }
      }
    }
  }
  return null;
}

function jsonLdTypes(html) {
  const types = new Set();
  let parseErrors = 0;
  const scripts = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    const type = value["@type"];
    if (Array.isArray(type)) type.forEach((item) => types.add(String(item)));
    else if (type) types.add(String(type));
    Object.values(value).forEach(visit);
  };
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try { visit(JSON.parse(body)); } catch { parseErrors += 1; }
  }
  return { types: [...types].sort().slice(0, 40), blocks: scripts.length, parseErrors };
}

export function inspectHtml(html, baseUrl, xRobotsTag = "") {
  const title = boundedText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "", 300);
  const description = boundedText(metaContent(html, "description"), 500);
  const robots = [metaContent(html, "robots"), xRobotsTag].filter(Boolean).join(", ").toLowerCase();
  const structuredData = jsonLdTypes(html);
  return {
    title,
    description,
    canonical: canonicalHref(html, baseUrl),
    noindex: /(?:^|[,\s])noindex(?:[,\s]|$)/.test(robots),
    structuredData,
    visibleText: compactSpace(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).slice(0, 200_000)
  };
}

function signal(id, label, status, evidence, sourceUrl) {
  return { id, label, status, evidence, source_url: sourceUrl };
}

function presence(text, terms = []) {
  return terms.map((term) => ({ term, found: new RegExp(escapeRegExp(term), "i").test(text) }));
}

export async function auditWebsite(input, fetchImpl = fetch) {
  const requested = validatePublicUrl(input.website_url);
  const page = await safeFetch(requested, fetchImpl);
  const contentType = page.response.headers.get("content-type") || "";
  if (!page.response.ok) throw new Error(`Website returned HTTP ${page.response.status}.`);
  if (!contentType.toLowerCase().includes("text/html")) throw new Error("The supplied URL did not return an HTML webpage.");
  const html = await readLimitedText(page.response);
  const inspected = inspectHtml(html, page.finalUrl, page.response.headers.get("x-robots-tag") || "");
  const origin = page.finalUrl.origin;

  let robotsStatus = "missing";
  let robotsEvidence = "robots.txt was not found; no crawler restriction was observed there.";
  let robotsSource = `${origin}/robots.txt`;
  let sitemapCandidates = [];
  try {
    const robotsFetch = await safeFetch(robotsSource, fetchImpl, { accept: "text/plain,*/*;q=0.5" });
    robotsSource = robotsFetch.finalUrl.href;
    if (robotsFetch.response.ok) {
      const robotsText = await readLimitedText(robotsFetch.response);
      const looksLikeHtml = /<\s*(?:!doctype\s+html|html|head|body)\b/i.test(robotsText);
      if (looksLikeHtml) {
        robotsEvidence = "robots.txt returned HTML rather than a robots file; no crawler rule was verified there.";
      } else {
        const decision = evaluateRobots(robotsText);
        robotsStatus = decision.allowed ? "clear" : "blocked";
        robotsEvidence = decision.allowed
          ? `OAI-SearchBot is not blocked for /. Rules evaluated from ${decision.sourceGroup}.`
          : `OAI-SearchBot is blocked for / by ${decision.matchedRule?.type}: ${decision.matchedRule?.path}.`;
        sitemapCandidates = [...robotsText.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((match) => match[1]);
      }
    } else if (robotsFetch.response.status !== 404) {
      robotsStatus = "unverified";
      robotsEvidence = `robots.txt returned HTTP ${robotsFetch.response.status}.`;
    }
  } catch (error) {
    robotsStatus = "unverified";
    robotsEvidence = `robots.txt could not be checked: ${error.message}`;
  }

  if (!sitemapCandidates.length) sitemapCandidates = [`${origin}/sitemap.xml`];
  let sitemap = { status: "missing", url: sitemapCandidates[0], evidence: "No readable sitemap was found." };
  for (const candidate of sitemapCandidates.slice(0, 3)) {
    try {
      const result = await safeFetch(new URL(candidate, origin).href, fetchImpl, { accept: "application/xml,text/xml,*/*;q=0.5" });
      if (result.response.ok) {
        const body = await readLimitedText(result.response);
        if (/<(?:urlset|sitemapindex)\b/i.test(body)) {
          sitemap = { status: "clear", url: result.finalUrl.href, evidence: "A readable XML sitemap was found." };
          break;
        }
      }
    } catch { /* reflected as missing */ }
  }

  let llms = { status: "missing", url: `${origin}/llms.txt`, evidence: "No llms.txt file was found. This file is optional and is not an OpenAI ranking signal." };
  try {
    const result = await safeFetch(llms.url, fetchImpl, { accept: "text/plain,*/*;q=0.5" });
    if (result.response.ok) {
      const body = await readLimitedText(result.response);
      const looksLikeHtml = /<\s*(?:!doctype\s+html|html|head|body)\b/i.test(body);
      if (body.trim() && !looksLikeHtml) llms = { status: "clear", url: result.finalUrl.href, evidence: "A non-empty llms.txt file was found. It is supplementary machine-readable context, not a ranking guarantee." };
    }
  } catch { /* reflected as missing */ }

  const suppliedTerms = [input.business_name, input.location_or_service_area, ...(input.priority_services || [])].filter(Boolean);
  const termPresence = presence(`${inspected.title || ""} ${inspected.description || ""} ${inspected.visibleText}`, suppliedTerms);
  const observations = [
    signal("reachability", "Public webpage", "clear", `HTTP ${page.response.status}; final URL ${page.finalUrl.href}`, page.finalUrl.href),
    signal("https", "HTTPS", page.finalUrl.protocol === "https:" ? "clear" : "gap", page.finalUrl.protocol === "https:" ? "The final page uses HTTPS." : "The final page uses unencrypted HTTP.", page.finalUrl.href),
    signal("oai_searchbot", "OAI-SearchBot access", robotsStatus, robotsEvidence, robotsSource),
    signal("indexing", "Index directive", inspected.noindex ? "blocked" : "clear", inspected.noindex ? "A noindex directive was found." : "No noindex directive was found on the checked page.", page.finalUrl.href),
    signal("sitemap", "XML sitemap", sitemap.status, sitemap.evidence, sitemap.url),
    signal("canonical", "Canonical URL", inspected.canonical ? "clear" : "gap", inspected.canonical ? `Canonical URL: ${inspected.canonical}` : "No canonical link was found on the checked page.", page.finalUrl.href),
    signal("metadata", "Page title and description", inspected.title && inspected.description ? "clear" : "gap", `Title: ${inspected.title || "missing"}; description: ${inspected.description || "missing"}`, page.finalUrl.href),
    signal("structured_data", "Structured data", inspected.structuredData.types.length && !inspected.structuredData.parseErrors ? "clear" : inspected.structuredData.blocks ? "partial" : "gap", inspected.structuredData.blocks ? `Types: ${inspected.structuredData.types.join(", ") || "none parsed"}; parse errors: ${inspected.structuredData.parseErrors}.` : "No JSON-LD structured data blocks were found.", page.finalUrl.href),
    signal("llms_txt", "Supplementary AI profile", llms.status, llms.evidence, llms.url)
  ];

  const gaps = [];
  const addGap = (condition, id, severity, finding, action) => { if (condition) gaps.push({ id, severity, finding, action }); };
  addGap(robotsStatus === "blocked", "oai_searchbot_blocked", "high", "OAI-SearchBot is blocked from the homepage.", "Review the OAI-SearchBot rules in robots.txt if search inclusion is intended.");
  addGap(inspected.noindex, "noindex", "high", "The checked page asks search engines not to index it.", "Remove noindex only if this page is intended to be public and searchable.");
  addGap(page.finalUrl.protocol !== "https:", "https", "high", "The final page is not served over HTTPS.", "Serve the site over HTTPS and redirect HTTP to HTTPS.");
  addGap(!inspected.title || !inspected.description, "metadata", "medium", "The page title or meta description is missing.", "Add a specific title and concise description that accurately state the business and its offer.");
  addGap(!inspected.canonical, "canonical", "medium", "No canonical URL was found.", "Add a canonical link for the preferred public URL.");
  addGap(sitemap.status !== "clear", "sitemap", "medium", "No readable XML sitemap was found.", "Publish an XML sitemap and reference it in robots.txt.");
  addGap(!inspected.structuredData.types.length, "structured_data", "medium", "No parseable JSON-LD types were found.", "Add accurate Organization or LocalBusiness data and relevant Service or Product entities.");
  addGap(inspected.structuredData.parseErrors > 0, "structured_data_invalid", "medium", "At least one JSON-LD block could not be parsed.", "Validate and correct the page JSON-LD.");
  const missingTerms = termPresence.filter((item) => !item.found).map((item) => item.term);
  addGap(missingTerms.length, "supplied_terms", "medium", `Supplied business context not found on the checked page: ${missingTerms.join(", ")}.`, "State these facts plainly on the page if they are accurate and important to customers.");

  const blocked = robotsStatus === "blocked" || inspected.noindex || page.finalUrl.protocol !== "https:";
  const partial = gaps.length > 0 || robotsStatus === "unverified";
  const technicalReadiness = blocked ? "blocked" : partial ? "partial" : "clear";
  return {
    audit: {
      requested_url: requested.href,
      final_url: page.finalUrl.href,
      checked_at: new Date().toISOString(),
      technical_readiness: technicalReadiness
    },
    summary: technicalReadiness === "clear"
      ? "The checked page exposes the main technical signals in this audit. This does not prove AI ranking, citation or recommendation."
      : technicalReadiness === "blocked"
        ? "A high-impact technical condition may prevent or materially limit discovery of the checked page."
        : "The page is publicly reachable, but one or more technical or representation signals could be clearer.",
    observations,
    supplied_context_presence: termPresence,
    supplied_context: {
      target_customer: input.target_customer || null,
      note: input.target_customer ? "Recorded as user-supplied context only; this crawl does not validate demand or customer fit." : null
    },
    gaps,
    unknowns: [
      "This crawl does not measure ChatGPT ranking, citation or recommendation.",
      "It does not measure customer demand, conversion, revenue or causal impact.",
      "It does not test every page, external mention, model, search index or user journey.",
      "llms.txt is supplementary context and is not an official OpenAI inclusion or ranking mechanism."
    ],
    next_action: gaps[0]?.action || "Keep the public facts current and verify important user questions with separate, dated tests.",
    deeper_analysis: "For evidence-led AI visibility analysis across pages, prompts and outcomes, contact hello@sr3h.uk."
  };
}
