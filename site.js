const introOverlay = document.querySelector(".intro-overlay");
const introVideo = document.querySelector(".intro-video");

if (document.documentElement.classList.contains("intro-enabled")) {
  const closeIntro = () => {
    if (!document.documentElement.classList.contains("intro-enabled")) {
      return;
    }

    try {
      window.sessionStorage.setItem("sr3hIntroSeen", "1");
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }

    document.documentElement.classList.add("intro-exiting");

    window.setTimeout(() => {
      document.documentElement.classList.remove("intro-enabled", "intro-exiting");
    }, 1160);
  };

  const fallbackTimer = window.setTimeout(closeIntro, 2600);

  introVideo?.addEventListener("ended", () => {
    window.clearTimeout(fallbackTimer);
    closeIntro();
  });

  introVideo?.addEventListener("error", closeIntro);
  introOverlay?.addEventListener("click", closeIntro);
}

const themeColor = document.querySelector("#theme-color");
const themedSections = [...document.querySelectorAll("[data-theme-color]")];

if (themeColor && themedSections.length) {
  let ticking = false;

  const syncThemeColor = () => {
    const marker = window.scrollY + window.innerHeight * 0.28;
    let active = themedSections[0];

    themedSections.forEach((section) => {
      if (section.offsetTop <= marker) {
        active = section;
      }
    });

    themeColor.setAttribute("content", active.dataset.themeColor);
    ticking = false;
  };

  const queueThemeColor = () => {
    if (!ticking) {
      window.requestAnimationFrame(syncThemeColor);
      ticking = true;
    }
  };

  syncThemeColor();
  window.addEventListener("scroll", queueThemeColor, { passive: true });
  window.addEventListener("resize", queueThemeColor);
}
