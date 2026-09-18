import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const urls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
const titles = new Set();
const descriptions = new Set();
const meta = (html, name) => html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];
let schemas = 0;
for (const url of urls) {
  const path = new URL(url).pathname.slice(1) || 'index.html';
  assert(existsSync(resolve(root, path)), `Missing sitemap page: ${path}`);
  const html = read(path);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  const description = meta(html, 'description');
  assert(title && !titles.has(title), `${path}: missing/duplicate title`);
  assert(description && !descriptions.has(description), `${path}: missing/duplicate description`);
  titles.add(title); descriptions.add(description);
  assert.equal(html.match(/rel="canonical" href="([^"]+)"/)?.[1], url, `${path}: canonical mismatch`);
  assert(!/noindex/.test(meta(html, 'robots') || ''), `${path}: sitemap contains noindex page`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: expected one h1`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(match[1]);
    assert.equal(data['@context'], 'https://schema.org');
    schemas++;
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      if (value['@type'] === 'BlogPosting') {
        const target = new URL(value.url);
        assert(html.includes(`id="${target.hash.slice(1)}"`), `Missing article anchor: ${value.url}`);
        assert(html.includes(value.headline), 'Article headline must be visible');
      }
      Object.values(value).forEach(walk);
    };
    walk(data);
  }
  if (['index.html', 'aido-labs.html', 'conchup.html', 'signal.html', 'journal.html'].includes(path)) {
    assert.equal(meta(html, 'og:url'), url);
    assert.equal(meta(html, 'og:title'), title);
    assert.equal(meta(html, 'twitter:title'), title);
    assert(meta(html, 'twitter:card'));
    for (const key of ['og:image', 'twitter:image']) {
      const image = new URL(meta(html, key));
      assert.equal(image.origin, 'https://sr3h.uk');
      assert(existsSync(resolve(root, image.pathname.slice(1))), `Missing ${key} asset`);
    }
  }
}
JSON.parse(read('ai-services.json'));
assert(read('robots.txt').includes('Sitemap: https://sr3h.uk/sitemap.xml'));
console.log(`PASS: ${urls.length} canonical pages, unique metadata, ${schemas} JSON-LD blocks, article anchors and social assets.`);
