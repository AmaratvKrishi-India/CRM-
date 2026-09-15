import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const reportSource = fs.readFileSync(path.resolve(here, '../scripts/generate-test-report.ts'), 'utf8');
const cspSource = fs.readFileSync(path.resolve(here, '../scripts/csp-header-test.ts'), 'utf8');

test('F053 generated HTML escapes report-controlled text and CSP parsing has no identity replacement', () => {
  assert.match(reportSource, /\.replace\(\/&\/g, '&amp;'\)/);
  assert.match(reportSource, /\.replace\(\/<\/g, '&lt;'\)/);
  assert.match(reportSource, /\.replace\(\/>\/g, '&gt;'\)/);
  assert.match(reportSource, /\.replace\(\/"\/g, '&quot;'\)/);
  assert.match(reportSource, /<td>\$\{escapeHtml\(suite\.suite\)\}<\/td>/);
  assert.doesNotMatch(cspSource, /\.replace\(\/-\/g, '-'\)/);
});
