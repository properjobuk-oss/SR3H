import { validatePublicUrl } from "./url-safety.js";

// Public references are evidence of an advertised connection, not an operation test.
export function publicReferences(html, baseUrl) {
  const found = {};
  const patterns = {
    mcp: /\bmcp\b|model\s+context\s+protocol/i,
    plugin: /\b(?:chatgpt|openai|ai)\s+(?:app|plugin)\b|apps\s+sdk|ai-plugin\.json/i,
    api: /\b(?:api|openapi|swagger)\b/i
  };
  const page = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const match of [...page.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 300)) {
    try {
      const href = validatePublicUrl(new URL(match[1].replace(/&amp;/g, "&"), baseUrl).href).href;
      const text = `${new URL(href).pathname.replace(/[-_/]/g, " ")} ${match[2].replace(/<[^>]*>/g, " ")}`;
      for (const [id, pattern] of Object.entries(patterns)) if (!found[id] && pattern.test(text)) found[id] = href;
    } catch { /* Ignore non-public and malformed links. */ }
  }
  return found;
}

export function richResultTypes(html) {
  const found = new Set();
  const nonempty = value => typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) ? value.length > 0 : value && typeof value === "object" && Object.keys(value).length > 0;
  const required = {
    Product: ["name"], Article: ["headline"], NewsArticle: ["headline"], BlogPosting: ["headline"],
    BreadcrumbList: ["itemListElement"], FAQPage: ["mainEntity"], Recipe: ["name", "image"],
    Event: ["name", "startDate", "location"], JobPosting: ["title", "description"],
    LocalBusiness: ["name", "address"], Organization: ["name"], SoftwareApplication: ["name"]
  };
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 20) return;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    for (const type of types) if (Object.hasOwn(required, type) && required[type].every(field => nonempty(value[field]))) found.add(type);
    Object.values(value).forEach(child => visit(child, depth + 1));
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Invalid JSON is not evidence. */ }
  }
  return [...found].sort();
}
