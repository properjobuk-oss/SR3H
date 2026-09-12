export const AIDO_REPORT_URI = "ui://aido/discoverability-report-v5.html";
export const AIDO_REPORT_MIME = "text/html;profile=mcp-app";

export const AIDO_REPORT_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIDO by SR3H</title>
  <style>
    :root {
      color-scheme: light dark;
      --ink: #0a1830;
      --muted: #5b6778;
      --surface: #ffffff;
      --surface-2: #f3f7fb;
      --line: #dce5ef;
      --blue: #0968e5;
      --teal: #00a7a0;
      --good: #087b68;
      --warn: #a14e0a;
      --bad: #a12d3d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: transparent;
      color: var(--ink);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--surface);
      box-shadow: 0 14px 40px rgba(8, 31, 64, .09);
    }
    .accent { height: 5px; background: linear-gradient(90deg, var(--blue), #168ee8 58%, var(--teal)); }
    .body { padding: 22px; }
    .topline, .footer, .metrics { display: flex; align-items: center; }
    .topline { justify-content: space-between; gap: 14px; }
    .brand { font-size: 13px; font-weight: 800; letter-spacing: .12em; color: var(--blue); }
    .kind {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 9px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }
    h1 { margin: 20px 0 8px; max-width: 760px; font-size: clamp(23px, 4vw, 34px); line-height: 1.08; letter-spacing: -.035em; }
    .summary { margin: 0; max-width: 760px; color: var(--muted); font-size: 15px; line-height: 1.55; }
    .status { display: inline-flex; align-items: center; gap: 7px; margin-top: 15px; color: var(--muted); font-size: 13px; font-weight: 700; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--warn); }
    .status[data-status="clear"] .dot, .status[data-status="complete"] .dot { background: var(--good); }
    .status[data-status="blocked"] .dot { background: var(--bad); }
    .metrics { gap: 8px; margin: 20px 0 4px; flex-wrap: wrap; }
    .metric { min-width: 120px; flex: 1 1 120px; border-radius: 14px; background: var(--surface-2); padding: 12px; }
    .metric strong, .metric span { display: block; }
    .metric strong { font-size: 19px; line-height: 1.2; }
    .metric span { margin-top: 4px; color: var(--muted); font-size: 11px; line-height: 1.3; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
    .panel { border-top: 1px solid var(--line); padding-top: 15px; }
    .panel h2, .next h2 { margin: 0 0 9px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 7px 0; font-size: 14px; line-height: 1.4; }
    .next { margin-top: 18px; border-radius: 15px; background: var(--surface-2); padding: 15px; }
    .next p { margin: 0; font-size: 14px; line-height: 1.45; }
    details { margin-top: 16px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    summary { cursor: pointer; font-weight: 700; }
    .sources { margin-top: 8px; padding-left: 0; list-style: none; }
    .sources a { color: var(--blue); overflow-wrap: anywhere; text-decoration-thickness: 1px; text-underline-offset: 2px; }
    .footer { justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 13px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
    .footer a { color: inherit; text-decoration: none; }
    [hidden] { display: none !important; }
    @media (max-width: 540px) {
      .body { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      h1 { font-size: 25px; }
    }
    @media (prefers-color-scheme: dark) {
      :root { --ink: #f6f9fc; --muted: #aab7c7; --surface: #0b1728; --surface-2: #14243a; --line: #263b54; --blue: #65a9ff; --teal: #40d4c9; --good: #52d5b4; --warn: #ffb062; --bad: #ff7e8d; }
      .card { box-shadow: 0 14px 40px rgba(0, 0, 0, .24); }
    }
  </style>
</head>
<body>
  <main class="card" aria-live="polite">
    <div class="accent"></div>
    <div class="body">
      <div class="topline"><div class="brand">AIDO</div><div class="kind" id="kind">Discoverability check</div></div>
      <h1 id="headline">Preparing the result…</h1>
      <p class="summary" id="summary"></p>
      <div class="status" id="status"><span class="dot"></span><span id="statusText"></span></div>
      <div class="metrics" id="metrics" hidden></div>
      <div class="grid" id="evidenceGrid" hidden>
        <section class="panel" id="highlightsPanel"><h2>What we found</h2><ul id="highlights"></ul></section>
        <section class="panel" id="gapsPanel"><h2>Where to improve</h2><ul id="gaps"></ul></section>
      </div>
      <section class="next" id="nextPanel"><h2>Best next step</h2><p id="nextAction"></p></section>
      <details id="details" hidden><summary>Evidence and limits</summary><p id="limitations"></p><ul class="sources" id="sources"></ul></details>
      <footer class="footer"><span id="checkedAt"></span><a id="about" href="https://sr3h.uk/aido-labs.html" target="_blank" rel="noreferrer">AIDO by SR3H</a></footer>
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
        const reportType = data.report_type === "discovery_sample" ? "AI discovery sample" : "Website readiness";
        setText("kind", reportType);
        setText("headline", data.headline, "AIDO result");
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
        const gapCount = fillList("gaps", data.gaps);
        byId("highlightsPanel").hidden = !highlightCount;
        byId("gapsPanel").hidden = !gapCount;
        byId("evidenceGrid").hidden = !(highlightCount || gapCount);
        setText("nextAction", data.next_action, "Review the evidence before making changes.");

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
        byId("about").href = "https://sr3h.uk/aido-labs.html";
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
            appInfo: { name: "AIDO by SR3H", version: "0.11.0" },
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
  server.registerResource(
    "aido-discoverability-report",
    AIDO_REPORT_URI,
    {
      title: "AIDO discoverability report",
      description: "A compact presentation of an already completed AIDO readiness or discovery result.",
      mimeType: AIDO_REPORT_MIME,
      _meta: {
        ui: {
          prefersBorder: false,
          domain: "https://mcp.sr3h.uk",
          csp: { connectDomains: [], resourceDomains: [] }
        }
      }
    },
    async () => ({
      contents: [{
        uri: AIDO_REPORT_URI,
        mimeType: AIDO_REPORT_MIME,
        text: AIDO_REPORT_HTML,
        _meta: {
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
