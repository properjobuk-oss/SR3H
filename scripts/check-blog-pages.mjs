import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const index = read('journal.html');
const cards = [...index.matchAll(/<article class="journal-entry blog-card" id="([^"]+)">\s*<a class="blog-card-link" href="([^"]+)"/g)];
assert.equal(cards.length, 8, 'All eight posts must be linked from the index');
assert(!index.includes('class="journal-article-body"'), 'The index should contain summaries, not duplicate full articles');
const entries = new Map();
for (const [, slug, path] of cards) {
  assert.equal(path, `blog/${slug}.html`);
  assert(existsSync(new URL(path, root)), `Missing page: ${path}`);
  const page = read(path);
  assert(!page.includes('<details'), `Article must be open without JavaScript: ${path}`);
  assert(page.includes('Related research notes'), `Missing related links: ${path}`);
  assert(page.includes('min read'), `Missing reading time: ${path}`);
  entries.set(slug, { querySelector: () => ({ href: `https://sr3h.uk/${path}` }) });
}
let redirected;
const handlers = {};
const window = {
  location: { hash: '#who-owns-the-context', href: 'https://sr3h.uk/journal.html#who-owns-the-context', origin: 'https://sr3h.uk', replace: url => { redirected = url; } },
  addEventListener: (event, handler) => { handlers[event] = handler; },
};
const document = { getElementById: id => entries.get(id) };
runInNewContext(read('journal.js'), { window, document, URL, decodeURIComponent });
assert.equal(redirected, 'https://sr3h.uk/blog/who-owns-the-context.html');
window.location.hash = '#tiptoe'; handlers.hashchange();
assert.equal(redirected, 'https://sr3h.uk/blog/tiptoe.html');
for (const hash of ['#unknown', '#%E0%A4%A', '']) {
  redirected = undefined; window.location.hash = hash; handlers.hashchange();
  assert.equal(redirected, undefined, 'Unknown or malformed fragments must not navigate');
}
entries.set('external', { querySelector: () => ({ href: 'https://example.com/' }) });
window.location.hash = '#external'; handlers.hashchange();
assert.equal(redirected, undefined, 'Legacy redirects must stay on the site');
console.log('PASS: eight standalone articles, crawlable index links, legacy fragments, hash changes and invalid-fragment handling.');
