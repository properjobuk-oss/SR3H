import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('public_site', ROOT / 'scripts/build-public-site.py')
public_site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(public_site)


class PublicSiteTests(unittest.TestCase):
    def test_complete_build_contains_only_manifest_and_preserves_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'site'
            files = public_site.build_site(ROOT, output)
            actual = {path.relative_to(output).as_posix() for path in output.rglob('*') if path.is_file()}
            self.assertEqual(actual, set(files))
            for value in files:
                self.assertEqual((ROOT / value).read_bytes(), (output / value).read_bytes(), value)
            for private in ['mcp-server', 'docs', 'scripts', '.git', '.local-artifacts',
                            'README.md', 'SECURITY.md', '_config.yml', '.nojekyll']:
                self.assertFalse((output / private).exists(), private)
            self.assertTrue(public_site.REQUIRED <= actual)

    def test_traversal_hidden_files_internal_directories_and_secrets_are_rejected(self):
        for value in ['../private.html', '/private.html', 'assets/../private.html',
                      'assets//photo.png', 'assets/./photo.png', 'assets\\photo.png',
                      '.env', '.github/workflows/pages.yml', 'assets/.env.json',
                      'mcp-server/src/index.js', 'docs/internal.html',
                      'scripts/internal.js', 'node_modules/package/index.js',
                      'secret.pem', 'README.md', 'database.sqlite', '', None]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                public_site.validate_path(value)

    def test_symlinked_file_and_parent_directory_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'real').mkdir()
            (root / 'real/index.html').write_text('<h1>Example</h1>')
            (root / 'index.html').symlink_to(root / 'real/index.html')
            (root / 'assets').symlink_to(root / 'real', target_is_directory=True)
            for value in ['index.html', 'assets/index.html']:
                with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'Symlinks'):
                    public_site.validate_sources(root, [value])

    def test_duplicate_and_empty_manifests_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'scripts').mkdir()
            for files in [[], ['index.html', 'index.html']]:
                (root / public_site.MANIFEST).write_text(json.dumps({'version': 1, 'files': files}))
                with self.subTest(files=files), self.assertRaises(ValueError):
                    public_site.load_manifest(root)

    def test_missing_public_file_fails_before_output_is_created(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'scripts').mkdir()
            (root / public_site.MANIFEST).write_text(json.dumps({'version': 1, 'files': ['missing.html']}))
            output = root / 'output'
            with self.assertRaisesRegex(ValueError, 'Missing public file'):
                public_site.build_site(root, output)
            self.assertFalse(output.exists())

    def test_local_links_styles_and_media_must_be_in_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for content in ['<a href="/docs/internal.html">Internal</a>',
                            '<img src="assets/missing.png">',
                            '<link rel="stylesheet" href="missing.css?v=1">']:
                (root / 'index.html').write_text(content)
                with self.subTest(content=content), self.assertRaisesRegex(ValueError, 'not published'):
                    public_site.validate_references(root, ['index.html'])
            (root / 'styles.css').write_text('body {background: url("assets/missing.png")}')
            with self.assertRaisesRegex(ValueError, 'not published'):
                public_site.validate_references(root, ['styles.css'])

    def test_omitting_required_briefing_files_blocks_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'scripts').mkdir()
            (root / 'index.html').write_text('<h1>Example</h1>')
            (root / public_site.MANIFEST).write_text(json.dumps({'version': 1, 'files': ['index.html']}))
            output = root / 'output'
            with self.assertRaisesRegex(ValueError, 'Required website/briefing files omitted'):
                public_site.build_site(root, output)
            self.assertFalse(output.exists())

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'site'
            output.mkdir()
            (output / 'keep.txt').write_text('preserve me')
            with self.assertRaisesRegex(ValueError, 'Output already exists'):
                public_site.build_site(ROOT, output)
            self.assertEqual((output / 'keep.txt').read_text(), 'preserve me')


if __name__ == '__main__':
    unittest.main()
