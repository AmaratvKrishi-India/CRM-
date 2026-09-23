import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/test-suite.yml', import.meta.url), 'utf8');

test('normal production build invokes the release configuration gate', () => {
  assert.match(pkg.scripts.build, /verify:release-config/);
});

test('normal Android release preparation validates packaged assets', () => {
  assert.match(pkg.scripts['release:android:prepare'] ?? '', /verify:android-release-assets/);
});

test('CI Android path uses the guarded release preparation command', () => {
  assert.match(workflow, /npm run release:android:prepare/);
});

test('CI supplies release client configuration without hardcoding values', () => {
  assert.match(workflow, /VITE_SUPABASE_URL:\s*\$\{\{\s*secrets\.VITE_SUPABASE_URL\s*\}\}/);
  assert.match(workflow, /VITE_SUPABASE_ANON_KEY:\s*\$\{\{\s*secrets\.VITE_SUPABASE_ANON_KEY\s*\}\}/);
});
