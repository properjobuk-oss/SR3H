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
