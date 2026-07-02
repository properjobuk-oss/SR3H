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
