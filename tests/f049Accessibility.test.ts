import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appShell = readFileSync(resolve('src/App.tsx'), 'utf8');
const adminShell = readFileSync(resolve('src/components/admin/AdminShell.tsx'), 'utf8');

test('F049 provides keyboard skip links for both application shells', () => {
  assert.match(appShell, /href="#app-main-content"/);
  assert.match(appShell, /id="app-main-content"\s+tabIndex=\{-1\}/);
  assert.match(adminShell, /href="#admin-main-content"/);
  assert.match(adminShell, /id="admin-main-content"\s+tabIndex=\{-1\}/);
});
