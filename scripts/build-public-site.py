#!/usr/bin/env python3
"""Copy the reviewed public-file manifest; never upload the repository root."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shutil
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = Path('scripts/public-site-files.json')
PRIVATE_ROOTS = {'mcp-server', 'docs', 'scripts', 'tests', 'node_modules'}
PUBLIC_TYPES = {'.html', '.css', '.js', '.json', '.txt', '.xml', '.webmanifest',
                '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico',
                '.mp4', '.woff', '.woff2', '.pdf'}
REQUIRED = {'index.html', 'CNAME', 'robots.txt', 'sitemap.xml',
            'briefings/cj-7d28f4c9b3/index.html',
            'briefings/cj-7d28f4c9b3/visit.html',
            'briefings/cj-7d28f4c9b3/Chris-Jones-SR3H-Briefing-2026-11.pdf'}


def validate_path(value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError(f'Invalid public path: {value!r}')
    path = PurePosixPath(value)
    if path.is_absolute() or path.as_posix() != value or any(
            part.startswith('.') for part in path.parts):
        raise ValueError(f'Unsafe public path: {value!r}')
    if path.parts[0] in PRIVATE_ROOTS:
        raise ValueError(f'Internal directory cannot be published: {value}')
    if value != 'CNAME' and path.suffix.lower() not in PUBLIC_TYPES:
        raise ValueError(f'Unsupported public file type: {value}')
    return path


def load_manifest(source):
    data = json.loads((source / MANIFEST).read_text())
    if set(data) != {'version', 'files'} or data['version'] != 1:
        raise ValueError('Expected public manifest version 1 and a files list')
    files = data['files']
    if not isinstance(files, list) or not files:
        raise ValueError('Public files list must not be empty')
    for value in files:
        validate_path(value)
    if len(set(files)) != len(files):
        raise ValueError('Duplicate public file in manifest')
    return files


def validate_sources(source, files):
    for value in files:
        path = validate_path(value)
        current = source
        for part in path.parts:
            current = current / part
            if current.is_symlink():
                raise ValueError(f'Symlinks cannot be published: {value}')
        if not current.is_file():
            raise ValueError(f'Missing public file: {value}')


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {'href', 'src', 'poster'} and value:
                self.urls.append(value)


def validate_references(source, files):
    """Fail rather than ship pages with missing local links, media or styles."""
    public = set(files)
    for value in files:
        suffix = PurePosixPath(value).suffix
        if suffix not in {'.html', '.css'}:
            continue
        text = (source / value).read_text()
        if suffix == '.html':
            parser = References()
            parser.feed(text)
            references = parser.urls
        else:
            references = re.findall(r'url\(\s*[\x22\x27]?([^\s\x22\x27)]+)', text)
        for reference in references:
            target = urlsplit(urljoin('https://sr3h.uk/' + value, reference))
            if target.scheme not in {'https', 'http'} or target.netloc not in {'sr3h.uk', 'www.sr3h.uk'}:
                continue
            path = unquote(target.path).lstrip('/')
            if not path or path.endswith('/'):
                path += 'index.html'
            if path not in public:
                raise ValueError(f'{value}: local reference is not published: {reference}')


def build_site(source, output):
    files = load_manifest(source)
    validate_sources(source, files)
    missing = REQUIRED - set(files)
    if missing:
        raise ValueError(f'Required website/briefing files omitted: {sorted(missing)}')
    validate_references(source, files)
    if output.exists() or output.is_symlink():
        raise ValueError(f'Output already exists; choose a new build directory: {output}')
    output.mkdir(parents=True)
    for value in files:
        destination = output / value
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / value, destination)
    return files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '_site')
    args = parser.parse_args()
    try:
        files = build_site(ROOT, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Public site build failed: {error}\n')
    print(f'Built {len(files)} reviewed public files in {args.output}')
