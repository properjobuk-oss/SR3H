const THEME_COLOR = "#eef3f1";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const INTRO_CLASSES = [
  "intro-enabled",
  "intro-ready",
  "intro-whiteout",
  "intro-page-visible",
  "intro-exiting",
];

const INTRO_TIMING = {
  pageRevealDelay: 520,
  headerSettleReleaseDelay: 620,
  cleanupDelay: 1780,
  fallbackCloseDelay: 3600,
  playFailureDelay: 1200,
};

const REVEAL_SELECTOR = ".hero-copy, .section-inner, .work-item";
const REVEAL_MAX_DELAY = 260;
const REVEAL_DELAY_STEP = 42;
const WATERMARK_DRIFT = 9;
const ANCHOR_LANDING_DURATION = 1400;
const CONTACT_FOCUS_DURATION = 1500;
const ANCHOR_SCROLL_SETTLE_DELAY = 360;
const AI_CHECK_COOLDOWN_MS = 20_000;
const AI_CHECK_ENDPOINT = "https://mcp.sr3h.uk/check";

setThemeColor(THEME_COLOR);
initFreshPageStart();
initIntro();
initMotion();
initAiPresenceChecker();

function setThemeColor(color) {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function initFreshPageStart() {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const requestedHash = window.location.hash;
  const isSilentHomeNavigation = requestedHash === "#home";

  if (isSilentHomeNavigation) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  if (!requestedHash || isSilentHomeNavigation) {
    window.scrollTo(0, 0);
    window.addEventListener("pageshow", () => window.scrollTo(0, 0), { once: true });
  }
}

function initIntro() {
  const root = document.documentElement;

  if (!root.classList.contains("intro-enabled")) {
    return;
  }

  const overlay = document.querySelector(".intro-overlay");
  const header = document.querySelector(".site-header");
  const video = document.querySelector(".intro-video");
  let fallbackTimer;

  function showIntroVideo() {
    if (!video || video.paused || video.ended) {
      return;
    }

    root.classList.add("intro-ready");
  }

  function closeIntro() {
    if (!root.classList.contains("intro-enabled") || root.classList.contains("intro-whiteout")) {
      return;
    }

    root.classList.add("intro-whiteout");

    if (!prefersReducedMotion()) {
      header?.classList.add("is-settling");
    }

    window.setTimeout(() => {
      root.classList.add("intro-page-visible", "intro-exiting");
    }, INTRO_TIMING.pageRevealDelay);

    window.setTimeout(() => {
      header?.classList.remove("is-settling");
    }, INTRO_TIMING.headerSettleReleaseDelay);

    window.setTimeout(() => {
      root.classList.remove(...INTRO_CLASSES);
    }, INTRO_TIMING.cleanupDelay);
  }

  if (!video) {
    closeIntro();
    return;
  }

  fallbackTimer = window.setTimeout(closeIntro, INTRO_TIMING.fallbackCloseDelay);

  video.addEventListener("playing", showIntroVideo);
  video.addEventListener("ended", () => {
    window.clearTimeout(fallbackTimer);
    closeIntro();
  });
  video.addEventListener("error", closeIntro);

  overlay?.addEventListener("click", closeIntro);

  if (!video.paused && !video.ended) {
    showIntroVideo();
  }

  video.play?.().catch(() => {
    window.setTimeout(closeIntro, INTRO_TIMING.playFailureDelay);
  });
}

function initMotion() {
  if (prefersReducedMotion()) {
    return;
  }

  initReveals();
  initWorkCardMotion();
  initAnchorLanding();
}

function initReveals() {
  if (!("IntersectionObserver" in window)) {
    return;
  }

  const revealItems = [...document.querySelectorAll(REVEAL_SELECTOR)];

  if (!revealItems.length) {
    return;
  }

  revealItems.forEach((item, index) => {
    item.dataset.reveal = "";
    item.style.setProperty(
      "--reveal-delay",
      `${Math.min(index * REVEAL_DELAY_STEP, REVEAL_MAX_DELAY)}ms`,
    );
  });

  document.documentElement.classList.add("motion-ready");

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.14,
    },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

function initWorkCardMotion() {
  document.querySelectorAll(".work-item").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * WATERMARK_DRIFT;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * WATERMARK_DRIFT;

      card.style.setProperty("--watermark-x", `${x.toFixed(2)}px`);
      card.style.setProperty("--watermark-y", `${y.toFixed(2)}px`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--watermark-x");
      card.style.removeProperty("--watermark-y");
    });
  });
}

function restartTimedClass(element, className, duration) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);

  window.setTimeout(() => {
    element.classList.remove(className);
  }, duration);
}

function initAnchorLanding() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (!link.hash) {
        return;
      }

      const target = document.querySelector(link.hash);

      if (!target) {
        return;
      }

      window.setTimeout(() => {
        restartTimedClass(target, "is-anchor-landing", ANCHOR_LANDING_DURATION);

        if (target.classList.contains("contact")) {
          restartTimedClass(target, "is-contact-focus", CONTACT_FOCUS_DURATION);
        }
      }, ANCHOR_SCROLL_SETTLE_DELAY);
    });
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function aiCheckTimestamp(value) {
  try {
    if (value !== undefined) window.sessionStorage.setItem("sr3h-ai-check-time", String(value));
    return Number(window.sessionStorage.getItem("sr3h-ai-check-time") || 0);
  } catch {
    return 0;
  }
}

function appendResultList(parent, items) {
  const list = makeElement("ul", "ai-check-list");
  items.forEach(({ title, text, source }) => {
    const item = document.createElement("li");
    if (title) item.append(makeElement("strong", "", title));
    item.append(document.createTextNode(text));
    if (typeof source === 'string' && /^https?:\/\//i.test(source)) {
      item.append(document.createTextNode(" "));
      const link = makeElement("a", "", "View source");
      link.href = source;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      item.append(link);
    }
    list.append(item);
  });
  parent.append(list);
}

function renderAiCheckResult(container, result, form) {
  const state = result.audit?.technical_readiness || "partial";
  const discovery = result.discoverability || { status: "unavailable" };
  const titles = {
    clear: "AI search crawlers can access your website.",
    partial: "Your website is accessible, but some information needs attention.",
    blocked: "A setting may be blocking AI search access."
  };
  const stateLabels = {
    clear: "Accessible",
    partial: "Review",
    blocked: "Action needed"
  };

  const quotaMessages = {
    global_daily_limit: "Today’s free AI checks have been used. Please try again tomorrow.",
    visitor_daily_limit: "You’ve used today’s free AI checks. Please try again tomorrow.",
    target_daily_limit: "This website has reached today’s free check limit. Please try again tomorrow."
  };
  const quotaNotice = quotaMessages[discovery.reason]
    ? makeElement("p", "ai-check-quota-notice", quotaMessages[discovery.reason])
    : null;

  const head = makeElement("div", "ai-check-result-head");
  const headCopy = document.createElement("div");
  headCopy.append(makeElement("h3", "", discovery.status === "complete" ? result.summary : "Website readiness check complete."));
  headCopy.append(makeElement("p", "", discovery.status === "complete"
    ? "A dated sample of six AI-assisted answers: one branded question and five questions based on customer needs."
    : quotaNotice
      ? "The AI answer sample was not run today. The technical website check below still completed."
      : "The AI answer sample was not run. This result only checks whether AI search can access the site and understand its public information."));
  const stateLabel = makeElement("span", "ai-check-state", stateLabels[state] || stateLabels.partial);
  stateLabel.dataset.state = state;
  head.append(headCopy, stateLabel);

  const snapshot = makeElement("div", "ai-check-snapshot");
  if (result.snapshot) {
    const { access, understanding, discovery: observed } = result.snapshot;
    [
      ["Website access", `${access.passed} of ${access.checked} checks passed`],
      ["Offer clarity", `${understanding.answered} of ${understanding.checked} questions answered`],
      ["AI visibility", `Appeared in ${observed.branded_found + observed.unbranded_found} of ${observed.branded_checked + observed.unbranded_checked} answers`],
      ["Recommendations", `Recommended in ${(observed.branded_recommended || 0) + (observed.unbranded_recommended || 0)} of ${observed.branded_checked + observed.unbranded_checked} answers`]
    ].forEach(([label, value]) => {
      const item = makeElement("div", "ai-check-snapshot-item");
      item.append(makeElement("span", "", label), makeElement("strong", "", value));
      snapshot.append(item);
    });
  }

  const grid = makeElement("div", "ai-check-result-grid");
  const findings = makeElement("div", "ai-check-result-block");
  const gaps = (result.gaps || []).slice(0, 4).map((gap) => ({
    title: gap.severity === "high" ? "Priority" : "Improvement",
    text: gap.finding
  }));
  const discoverabilityGuidance = [
    { title: "Make the offer clear", text: "State the main services and locations in the words customers use." },
    { title: "Show the proof", text: "Connect important claims to accreditations, reviews, case studies or product facts." },
    { title: "Test customer questions", text: "Check whether AI services mention the business for the questions customers actually ask." }
  ];
  const sampledFindings = discovery.status === "complete"
    ? (discovery.important_findings || []).map((text) => ({ text }))
    : [];
  findings.append(makeElement("h4", "", sampledFindings.length ? "What matters" : gaps.length ? "What to improve first" : "How to improve AI readiness"));
  appendResultList(findings, sampledFindings.length ? sampledFindings : gaps.length ? gaps : discoverabilityGuidance);

  const evidence = makeElement("div", "ai-check-result-block");
  evidence.append(makeElement("h4", "", discovery.status === "complete" ? "Questions sampled" : "What we checked"));
  const appearanceLabels = {
    not_seen: "Not seen",
    source_only: "Source only",
    mentioned: "Mentioned",
    recommended: "Recommended"
  };
  appendResultList(evidence, discovery.status === "complete"
    ? (discovery.questions || []).slice(0, 6).map((item) => ({
      title: `${appearanceLabels[item.appearance] || "Checked"} · ${item.question}`,
      text: item.answer_summary || item.finding,
      source: item.search_evidence_url || item.site_evidence_url
    }))
    : (result.observations || []).slice(0, 5).map((item) => ({ title: item.label, text: item.evidence, source: item.source_url })));
  grid.append(findings, evidence);

  const next = makeElement("p", "ai-check-next");
  next.append(makeElement("strong", "", "What to do next"));
  next.append(document.createTextNode(discovery.status === "complete"
    ? result.next_action
    : `${result.next_action} Then test the customer questions that matter and record whether the business is absent, mentioned or recommended.`));

  const actions = makeElement("div", "ai-check-result-actions");
  const contact = makeElement("a", "button primary", "Discuss a full review");
  contact.href = "mailto:hello@sr3h.uk?subject=AIDO%20discoverability%20review";
  const reset = makeElement("button", "ai-check-reset", "Check another website");
  reset.type = "button";
  reset.addEventListener("click", () => {
    container.hidden = true;
    container.replaceChildren();
    form.hidden = false;
    const status = document.querySelector("#ai-check-status");
    if (status) status.textContent = "";
    form.querySelector("input")?.focus();
  });
  actions.append(contact, reset);

  const fuller = makeElement("p", "ai-check-fuller", discovery.status === "complete"
    ? "A deeper AIDO review tests more customer questions across AI services, separates mentions from genuine recommendations, compares competing businesses and checks which changes improve visibility."
    : "To understand actual AI visibility, the next stage is to test the questions customers ask, record whether the business is mentioned or recommended, and compare it with the alternatives that appear instead.");
  const limitItems = (discovery.limits || result.unknowns || []).slice(0, 3);
  const limits = makeElement("p", "ai-check-limits", `About this check: ${limitItems.join(" ")}`);
  container.replaceChildren(...[quotaNotice, head, snapshot, grid, next, fuller, actions, limits].filter(Boolean));
  container.hidden = false;
  form.hidden = true;
  container.focus?.();
}

function initAiPresenceChecker() {
  const form = document.querySelector("#ai-check-form");
  const status = document.querySelector("#ai-check-status");
  const resultContainer = document.querySelector("#ai-check-result");
  if (!form || !status || !resultContainer) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.classList.remove("is-error");
    status.textContent = "";

    const data = new FormData(form);
    const services = String(data.get("priority_services") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (services.length > 8 || services.some((item) => item.length > 120)) {
      status.classList.add("is-error");
      status.textContent = "Use no more than eight short services, separated by commas.";
      return;
    }

    const previousCheck = aiCheckTimestamp();
    const remaining = AI_CHECK_COOLDOWN_MS - (Date.now() - previousCheck);
    if (remaining > 0) {
      status.classList.add("is-error");
      status.textContent = `Please wait ${Math.ceil(remaining / 1000)} seconds before another check.`;
      return;
    }

    const suppliedUrl = String(data.get("website_url") || "").trim();
    const websiteUrl = /^https?:\/\//i.test(suppliedUrl) ? suppliedUrl : `https://${suppliedUrl}`;
    const payload = {
      website_url: websiteUrl,
      company_website: String(data.get("company_website") || "")
    };
    const optionalFields = ["business_name", "location_or_service_area", "target_customer"];
    optionalFields.forEach((field) => {
      const value = String(data.get(field) || "").trim();
      if (value) payload[field] = value;
    });
    if (services.length) payload.priority_services = [...new Set(services)].slice(0, 8);

    const submit = form.querySelector('button[type="submit"]');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    form.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    status.textContent = "Checking the website and a small discovery sample…";
    aiCheckTimestamp(Date.now());

    try {
      const response = await fetch(AI_CHECK_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.result) throw new Error(body.error || "The check could not be completed.");
      status.textContent = "Discoverability check complete.";
      renderAiCheckResult(resultContainer, body.result, form);
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error?.name === "AbortError"
        ? "The check took too long. Try again in a moment."
        : error.message || "The check could not be completed.";
    } finally {
      window.clearTimeout(timeout);
      form.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
    }
  });
}
