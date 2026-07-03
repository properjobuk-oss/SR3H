# SR3H

Static landing page for SR3H LTD.

GitHub Pages can serve this repository from the root.

## Structure

- `index.html` contains the public page content and metadata.
- `styles.css` contains site tokens, layout, visual treatment and responsive rules.
- `site.js` contains three small behaviours: intro playback, scroll reveal and work-card motion.
- `assets/` contains the public brand and watermark media.
- `docs/brand-source-of-truth.md` records approved public language.

The site intentionally avoids a build step. Keep source files small, direct and easy to audit.

## Local Preview

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

## Deployment

GitHub Pages serves the `main` branch from the repository root. The custom domain is configured through `CNAME`.
