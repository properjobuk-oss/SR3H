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
  cleanupDelay: 1780,
  fallbackCloseDelay: 3600,
  playFailureDelay: 1200,
};

const REVEAL_SELECTOR = ".hero-copy, .section-inner, .work-item, .principles li";
const REVEAL_MAX_DELAY = 260;
const REVEAL_DELAY_STEP = 42;
const WATERMARK_DRIFT = 9;

setThemeColor(THEME_COLOR);
initIntro();
initMotion();

function setThemeColor(color) {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

function initIntro() {
  const root = document.documentElement;

  if (!root.classList.contains("intro-enabled")) {
    return;
  }

  const overlay = document.querySelector(".intro-overlay");
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

    window.setTimeout(() => {
      root.classList.add("intro-page-visible", "intro-exiting");
    }, INTRO_TIMING.pageRevealDelay);

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
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  initReveals();
  initWorkCardMotion();
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
