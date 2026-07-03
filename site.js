const introOverlay = document.querySelector(".intro-overlay");
const introVideo = document.querySelector(".intro-video");

if (document.documentElement.classList.contains("intro-enabled")) {
  const showIntroVideo = () => {
    if (!introVideo || introVideo.paused || introVideo.ended) {
      return;
    }

    document.documentElement.classList.add("intro-ready");
  };

  const closeIntro = () => {
    if (
      !document.documentElement.classList.contains("intro-enabled") ||
      document.documentElement.classList.contains("intro-whiteout")
    ) {
      return;
    }

    document.documentElement.classList.add("intro-whiteout");

    window.setTimeout(() => {
      document.documentElement.classList.add("intro-page-visible", "intro-exiting");
    }, 520);

    window.setTimeout(() => {
      document.documentElement.classList.remove(
        "intro-enabled",
        "intro-ready",
        "intro-whiteout",
        "intro-page-visible",
        "intro-exiting",
      );
    }, 1780);
  };

  const fallbackTimer = window.setTimeout(closeIntro, 3600);

  introVideo?.addEventListener("playing", showIntroVideo);

  if (introVideo && !introVideo.paused && !introVideo.ended) {
    showIntroVideo();
  }

  introVideo?.addEventListener("ended", () => {
    window.clearTimeout(fallbackTimer);
    closeIntro();
  });

  introVideo?.addEventListener("error", closeIntro);
  introOverlay?.addEventListener("click", closeIntro);

  introVideo?.play?.().catch(() => {
    window.setTimeout(closeIntro, 1200);
  });
}

document
  .querySelectorAll('meta[name="theme-color"]')
  .forEach((meta) => meta.setAttribute("content", "#2e6fd8"));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  if ("IntersectionObserver" in window) {
    const revealItems = [
      ...document.querySelectorAll(".hero-copy, .section-inner, .work-item, .principles li"),
    ];

    revealItems.forEach((item, index) => {
      item.dataset.reveal = "";
      item.style.setProperty("--reveal-delay", `${Math.min(index * 42, 260)}ms`);
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

  document.querySelectorAll(".work-item").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 9;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 9;

      card.style.setProperty("--watermark-x", `${x.toFixed(2)}px`);
      card.style.setProperty("--watermark-y", `${y.toFixed(2)}px`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--watermark-x");
      card.style.removeProperty("--watermark-y");
    });
  });
}
