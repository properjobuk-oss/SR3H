# SR3H

Static landing page for SR3H LTD.

GitHub Pages publishes a separate build containing only reviewed public files.

## Structure

- `index.html` contains the public page content and metadata.
- `styles.css` contains site tokens, layout, visual treatment and responsive rules.
- `home.css` and `home.js` contain the homepage product cards, screenshot previews and Munchkin animation.
- `site.js` contains shared motion and website-check behaviour.
- `assets/` contains the public brand and watermark media.
- `docs/brand-source-of-truth.md` records approved public language.

The public files are copied without transformation. Keep them small, direct and easy to audit.

## Local Preview

```sh
python3 scripts/build-public-site.py
python3 -m http.server 4173 --directory _site
```

Then open `http://localhost:4173/`.

## Deployment

Set the GitHub Pages publishing source to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` tests the publication boundary, copies the exact files in `scripts/public-site-files.json` to `_site`, and uploads only that directory. It deploys from `main`. The custom domain remains `sr3h.uk` through `CNAME` and the existing Pages settings.

Add new public pages and assets to the manifest deliberately. Missing local page links, styles or media fail the build. Chris's briefing, visit agenda, supporting assets and PDF remain included. Server source, internal docs, scripts, hidden files and local artifacts are excluded. Signal's separate Worker is not built or deployed by this workflow.

Run `python3 -m unittest discover -s scripts/tests -v` to check these boundaries. For a repeated local build, choose a fresh directory with `--output PATH`; the builder refuses to overwrite an existing directory.

The manifest controls website publication, not access to the public Git repository or its history. Keep confidential material out of public Git.
