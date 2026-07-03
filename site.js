const THEME_COLOR = "#8eabc9";
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

const REVEAL_SELECTOR = ".hero-copy, .section-inner, .work-item, .principles li";
const REVEAL_MAX_DELAY = 260;
const REVEAL_DELAY_STEP = 42;
const WATERMARK_DRIFT = 9;
const ANCHOR_LANDING_DURATION = 1400;
const CONTACT_FOCUS_DURATION = 1500;
const ANCHOR_SCROLL_SETTLE_DELAY = 360;

setThemeColor(THEME_COLOR);
initIntro();
initMotion();

function setThemeColor(color) {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
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
