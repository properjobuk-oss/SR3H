export const AIDO_REPORT_URI = "ui://aido/discoverability-report-v9.html";
export const AIDO_REPORT_MIME = "text/html;profile=mcp-app";
const SIGNAL_WIDGET_DESCRIPTION = "Signal’s native interactive results card: charcoal Signal header, green accents, website checks or visibility measurements, findings, next step and expandable evidence. The business named in the report is the subject being assessed; it does not identify the card’s product. A MyLegend profile card is separate evidence under test. This resource renders the Signal report itself; avoid recreating a second report panel or repeating all its details in prose. If host rendering cannot be confirmed, describe that uncertainty rather than inventing a replacement card.";

export const AIDO_REPORT_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signal</title>
  <style>
    :root {
      color-scheme: light dark;
      --ink: #17251e; --muted: #52665a; --surface: #ffffff;
      --surface-2: #edf7f0; --line: #d8e2dc; --blue: #176c43;
      --good: #176c43; --warn: #945a13; --bad: #a72f38;
      --header: #17251e; --header-muted: #bacdc1; --accent: #b6ef80;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: transparent; color: var(--ink); font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .accent { height: 4px; background: var(--accent); }
    .body { padding: 22px; }
    .topline, .footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .topline { padding: 18px 22px; background: var(--header); }
    .brand { font-size: 26px; font-weight: 780; letter-spacing: -.055em; line-height: 1; color: #ffffff; }
    .kind { color: var(--header-muted); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-align: right; }
    h1 { margin: 0 0 9px; max-width: 760px; font-size: clamp(24px, 4vw, 34px); line-height: 1.12; letter-spacing: -.035em; }
    .summary { margin: 0; max-width: 760px; color: var(--muted); font-size: 14px; line-height: 1.6; }
    .status { display: inline-flex; align-items: center; gap: 7px; margin-top: 14px; color: var(--muted); font-size: 12px; font-weight: 650; }
    .dot { width: 7px; height: 7px; border-radius: 2px; background: var(--warn); }
    .status[data-status="clear"] .dot, .status[data-status="complete"] .dot { background: var(--good); }
    .status[data-status="blocked"] .dot { background: var(--bad); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin: 22px 0 4px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .metric { padding: 17px 14px 17px 0; min-width: 0; }
    .metric + .metric { padding-left: 14px; border-left: 1px solid var(--line); }
    .metric strong, .metric span { display: block; }
    .metric strong { font-size: 29px; line-height: 1.2; font-weight: 750; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
    .metric span { margin-top: 5px; color: var(--muted); font-size: 11px; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 22px; }
    .panel { padding-top: 2px; min-width: 0; }
    #recommendations details { margin-top: 10px; }
    #recommendations blockquote, #findingEvidence blockquote { margin: 12px 0; padding-left: 12px; border-left: 2px solid var(--line); overflow-wrap: anywhere; }
    #recommendations a { color: var(--blue); }
    .panel h2, .next h2 { margin: 0 0 10px; font-size: 12px; font-weight: 750; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 7px 0; font-size: 14px; line-height: 1.5; }
    li::marker { color: var(--good); }
    .next { margin-top: 22px; border-left: 3px solid var(--good); background: var(--surface-2); padding: 15px 17px; }
    .next p { margin: 0; font-size: 14px; line-height: 1.5; }
    details { margin-top: 18px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    summary { cursor: pointer; font-weight: 650; }
    summary:focus-visible, a:focus-visible { outline: 2px solid var(--good); outline-offset: 4px; }
    .sources { margin-top: 8px; padding-left: 0; list-style: none; }
    .sources a { color: var(--blue); overflow-wrap: anywhere; text-decoration-thickness: 1px; text-underline-offset: 2px; }
    .comparison { margin-top: 22px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; font-variant-numeric: tabular-nums; }
    th, td { padding: 12px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-size: 11px; font-weight: 650; }
    td:first-child { min-width: 210px; }
    caption { text-align: left; font-weight: 700; margin-bottom: 8px; }
    .footer { margin-top: 20px; padding-top: 13px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
    .footer a { color: inherit; text-decoration: none; }
    [hidden] { display: none !important; }
    @media (max-width: 540px) {
      .body, .topline { padding: 18px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric { padding: 14px 10px 14px 0; }
      .metric + .metric { padding-left: 10px; }
      .metric:nth-child(odd) { border-left: 0; padding-left: 0; }
      .metric:nth-child(n+3) { border-top: 1px solid var(--line); }
      .grid { grid-template-columns: 1fr; gap: 18px; }
      h1 { font-size: 25px; }
      table { table-layout: fixed; }
      td:first-child, th:first-child { min-width: 0; width: 50%; }
      th { font-size: 10px; padding-left: 4px; padding-right: 4px; }
      td { padding-left: 4px; padding-right: 4px; overflow-wrap: anywhere; }
    }
    @media (prefers-color-scheme: dark) {
      :root { --ink: #f0f5f1; --muted: #b1c1b6; --surface: #18241d; --surface-2: #23372b; --line: #384d40; --blue: #b6ef80; --good: #b6ef80; --warn: #f2ba69; --bad: #ff8c94; --header: #0f1913; }
    }
  </style>
</head>
<body>
  <main class="card" aria-live="polite">
    <div class="accent"></div>
    <header class="topline"><div class="brand">Signal</div><div class="kind" id="kind">Discoverability check</div></header>
    <div class="body">
      <h1 id="headline">Preparing the result…</h1>
      <p class="summary" id="summary"></p>
      <div class="status" id="status"><span class="dot"></span><span id="statusText"></span></div>
      <div class="metrics" id="metrics" hidden></div>
      <div class="grid" id="evidenceGrid" hidden>
        <section class="panel" id="highlightsPanel"><h2>What we found</h2><ul id="highlights"></ul></section>
        <section class="panel" id="gapsPanel"><h2>Where to improve</h2><ul id="gaps"></ul><div id="recommendations"></div></section>
      </div>
      <section class="comparison" id="comparisonPanel" hidden><table><caption>Before → after by question</caption><thead><tr><th scope="col">Question</th><th scope="col">Mentions</th><th scope="col">Recommended</th></tr></thead><tbody id="comparisonRows"></tbody></table></section>
      <section class="next" id="nextPanel"><h2>Best next step</h2><p id="nextAction"></p></section>
      <details id="details" hidden><summary>Evidence and limits</summary><div id="findingEvidence"></div><p id="limitations"></p><ul class="sources" id="sources"></ul></details>
      <footer class="footer"><span id="checkedAt"></span><a id="about" href="https://sr3h.uk/signal.html" target="_blank" rel="noreferrer">Signal</a></footer>
    </div>
  </main>
  <script>
    (() => {
      const byId = (id) => document.getElementById(id);
      const clean = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
      const pendingRequests = new Map();
      let nextRequestId = 1;
      let initialized = false;
      let lastSize = "";
      const notify = (method, params) => {
        if (!initialized && method !== "ui/notifications/initialized") return;
        const message = { jsonrpc: "2.0", method };
        if (params !== undefined) message.params = params;
        window.parent.postMessage(message, "*");
      };
      const request = (method, params) => new Promise((resolve, reject) => {
        const id = nextRequestId++;
        const timeout = window.setTimeout(() => {
          pendingRequests.delete(id);
          reject(new Error("MCP Apps host did not respond"));
        }, 5000);
        pendingRequests.set(id, {
          resolve: (value) => { window.clearTimeout(timeout); resolve(value); },
          reject: (error) => { window.clearTimeout(timeout); reject(error); }
        });
        window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
      });
      const setText = (id, value) => { byId(id).textContent = clean(value); };
      const fillList = (id, values) => {
        const list = byId(id);
        list.replaceChildren();
        for (const value of Array.isArray(values) ? values : []) {
          const li = document.createElement("li");
          li.textContent = clean(value);
          if (li.textContent) list.append(li);
        }
        return list.childElementCount;
      };
      const render = (raw) => {
        const root = raw && typeof raw === "object" ? raw : {};
        const data = root.presentation && typeof root.presentation === "object" ? root.presentation : root;
        const reportType = data.report_type === "visibility_comparison" ? "Before and after" : data.report_type === "visibility_study" ? "Visibility study" : data.report_type === "discovery_sample" ? "AI discovery sample" : "Website readiness";
        setText("kind", reportType);
        setText("headline", data.headline, "Signal result");
        setText("summary", data.summary);
        const status = clean(data.status, "partial");
        byId("status").dataset.status = status;
        setText("statusText", status === "clear" ? "Technical checks clear" : status === "complete" ? "Sample complete" : status === "blocked" ? "Access blocked" : status === "incomplete" ? "Sample incomplete" : "Some evidence needs attention");

        const metrics = byId("metrics");
        metrics.replaceChildren();
        for (const item of Array.isArray(data.metrics) ? data.metrics.slice(0, 4) : []) {
          const box = document.createElement("div");
          box.className = "metric";
          const value = document.createElement("strong");
          const label = document.createElement("span");
          value.textContent = clean(item && item.value);
          label.textContent = clean(item && item.label);
          if (value.textContent && label.textContent) { box.append(value, label); metrics.append(box); }
        }
        metrics.hidden = !metrics.childElementCount;

        const highlightCount = fillList("highlights", data.highlights);
        const recommendations = byId("recommendations");
        recommendations.replaceChildren();
        for (const item of Array.isArray(data.recommendation_details) ? data.recommendation_details.slice(0, 3) : []) {
          if (!item || !clean(item.title) || !clean(item.success_measure)) continue;
          const detail = document.createElement("details");
          const summary = document.createElement("summary"); summary.textContent = clean(item.title); detail.append(summary);
          for (const [label, value] of [["Change", item.change], ["Why", item.rationale], ["Success", item.success_measure], ["Retest", item.retest_when]]) {
            if (!clean(value)) continue;
            const line = document.createElement("p"); const strong = document.createElement("strong"); strong.textContent = label + ": ";
            line.append(strong, document.createTextNode(clean(value))); detail.append(line);
          }
          try {
            const url = new URL(item.target_url);
            if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
              const link = document.createElement("a"); link.href = url.href; link.textContent = "Page to change";
              link.target = "_blank"; link.rel = "noreferrer"; detail.append(link);
            }
          } catch { /* Ignore malformed evidence links. */ }
          for (const ref of Array.isArray(item.evidence) ? item.evidence.slice(0, 4) : []) {
            if (!clean(ref.quote)) continue;
            const quote = document.createElement("blockquote"); quote.textContent = clean(ref.quote); detail.append(quote);
          }
          recommendations.append(detail);
        }
        const gapCount = recommendations.childElementCount || fillList("gaps", data.gaps);
        byId("gaps").hidden = !!recommendations.childElementCount;
        byId("highlightsPanel").hidden = !highlightCount;
        byId("gapsPanel").hidden = !gapCount;
        byId("evidenceGrid").hidden = !(highlightCount || gapCount);
        const comparisonRows = byId("comparisonRows");
        comparisonRows.replaceChildren();
        for (const item of Array.isArray(data.comparison_rows) ? data.comparison_rows.slice(0, 10) : []) {
          if (!item || typeof item.question !== "string") continue;
          const row = document.createElement("tr");
          for (const value of [item.question + (item.kind === "branded" ? " (by name)" : ""),
            String(item.before_mentions) + " → " + String(item.after_mentions),
            String(item.before_recommendations) + " → " + String(item.after_recommendations)]) {
            const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
          }
          comparisonRows.append(row);
        }
        byId("comparisonPanel").hidden = !comparisonRows.childElementCount;
        setText("nextAction", data.next_action, "Review the evidence before making changes.");

        const findingEvidence = byId("findingEvidence");
        findingEvidence.replaceChildren();
        for (const item of Array.isArray(data.finding_details) ? data.finding_details.slice(0, 3) : []) {
          if (!item || !clean(item.reason)) continue;
          const label = document.createElement("p"); label.textContent = clean(item.reason); findingEvidence.append(label);
          for (const ref of Array.isArray(item.evidence) ? item.evidence.slice(0, 4) : []) {
            if (!clean(ref.quote)) continue;
            const quote = document.createElement("blockquote"); quote.textContent = clean(ref.quote); findingEvidence.append(quote);
          }
        }
        setText("limitations", data.limitations_note);
        const sources = byId("sources");
        sources.replaceChildren();
        for (const value of Array.isArray(data.source_urls) ? data.source_urls.slice(0, 10) : []) {
          try {
            const url = new URL(value);
            if (url.protocol !== "https:" && url.protocol !== "http:") continue;
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = url.href;
            link.target = "_blank";
            link.rel = "noreferrer";
            link.textContent = url.hostname;
            li.append(link);
            sources.append(li);
          } catch {}
        }
        byId("details").hidden = !(clean(data.limitations_note) || sources.childElementCount);
        const date = Date.parse(data.checked_at);
        setText("checkedAt", Number.isNaN(date) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date));
        byId("about").href = "https://sr3h.uk/signal.html";
      };
      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (Object.prototype.hasOwnProperty.call(message, "id") && pendingRequests.has(message.id)) {
          const pending = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          if (message.error) pending.reject(new Error(clean(message.error.message, "MCP Apps request failed")));
          else pending.resolve(message.result);
          return;
        }
        if (message.method === "ui/notifications/tool-result") render(message.params && message.params.structuredContent);
      });
      const reportCurrentSize = () => {
        const width = Math.ceil(document.documentElement.getBoundingClientRect().width);
        const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
        const size = width + "x" + height;
        if (!width || !height || size === lastSize) return;
        lastSize = size;
        notify("ui/notifications/size-changed", { width, height });
      };
      const connect = async () => {
        try {
          await request("ui/initialize", {
            appCapabilities: { availableDisplayModes: ["inline"] },
            appInfo: { name: "Signal", version: "0.15.0" },
            protocolVersion: "2026-01-26"
          });
          initialized = true;
          notify("ui/notifications/initialized");
          if (window.ResizeObserver) new ResizeObserver(reportCurrentSize).observe(document.body);
          reportCurrentSize();
          if (window.openai && window.openai.toolOutput) render(window.openai.toolOutput);
        } catch {
          if (window.openai && window.openai.toolOutput) render(window.openai.toolOutput);
        }
      };
      connect();
    })();
  </script>
</body>
</html>`;

export function registerAidoReportUi(server) {
  // Existing ChatGPT connections can retain the previous tool template URI until refreshed.
  for (const uri of [AIDO_REPORT_URI, 'ui://aido/discoverability-report-v8.html']) {
  server.registerResource(
    uri === AIDO_REPORT_URI ? "aido-discoverability-report" : "signal-report-previous-template",
    uri,
    {
      title: "Signal visibility report",
      description: SIGNAL_WIDGET_DESCRIPTION,
      mimeType: AIDO_REPORT_MIME,
      _meta: {
        "openai/widgetDescription": SIGNAL_WIDGET_DESCRIPTION,
        ui: {
          prefersBorder: false,
          domain: "https://mcp.sr3h.uk",
          csp: { connectDomains: [], resourceDomains: [] }
        }
      }
    },
    async () => ({
      contents: [{
        uri,
        mimeType: AIDO_REPORT_MIME,
        text: AIDO_REPORT_HTML,
        _meta: {
          "openai/widgetDescription": SIGNAL_WIDGET_DESCRIPTION,
          ui: {
            prefersBorder: false,
            domain: "https://mcp.sr3h.uk",
            csp: { connectDomains: [], resourceDomains: [] }
          }
        }
      }]
    })
  );
  }
}
