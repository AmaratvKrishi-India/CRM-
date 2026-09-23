import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('F057 release Tailwind scan is limited to app source and index.html', () => {
  const css = readFileSync('src/index.css', 'utf8');

  assert.match(
    css,
    /@import\s+["']tailwindcss["']\s+source\(none\)\s*;/,
    'Tailwind automatic project-wide source detection must stay disabled',
  );
  assert.match(
    css,
    /@source\s+["']\.\/["']\s*;/,
    'src/ must remain an explicit Tailwind source',
  );
  assert.match(
    css,
    /@source\s+["']\.\.\/index\.html["']\s*;/,
    'index.html must remain an explicit Tailwind source',
  );
});
