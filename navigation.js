// Progressive enhancement: without JavaScript, all links remain visible.
(() => {
  const header = document.querySelector('.site-header');
  const nav = header?.querySelector('.nav');
  if (!nav) return;
  const mobile = window.matchMedia('(max-width: 760px)');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.textContent = 'Menu';
  nav.id = 'primary-navigation';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  nav.before(toggle);
  header.classList.add('menu-enhanced');

  function close(returnFocus = false) {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Menu';
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (header.classList.contains('menu-open')) return close();
    header.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = 'Close';
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) close(true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) close();
  });
  header.addEventListener('focusout', event => {
    if (!header.contains(event.relatedTarget)) close();
  });
  mobile.addEventListener('change', () => {
    const hiddenFocus = mobile.matches && nav.contains(document.activeElement);
    close(hiddenFocus);
  });
  window.addEventListener('pageshow', () => close());
})();
