// Existing shared article links keep working after the move to individual pages.
(() => {
  function openSharedArticle() {
    if (!window.location.hash) return;
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const entry = document.getElementById(id);
    const link = entry?.querySelector('.blog-card-link');
    if (!link) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin === window.location.origin) {
      window.location.replace(destination.href);
    }
  }
  openSharedArticle();
  window.addEventListener('hashchange', openSharedArticle);
})();
