import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureBundles } from '../scripts/bundle-analysis.ts';

test('F042 measures actual UTF-8 code and compressed sizes, excluding assets', () => {
  const result = measureBundles([{ type: 'chunk', fileName: 'app.js', code: 'const café = "hello";' },
    { type: 'asset', fileName: 'image.png' }], 1);
  assert.equal(result.summary.totalSize, Buffer.byteLength('const café = "hello";'));
  assert.equal(result.summary.chunkCount, 1);
  assert.ok(result.summary.totalGzipSize > 0 && result.summary.totalBrotliSize > 0);
  assert.deepEqual(result.summary.warnings, []);
});
test('F042 exceeding the budget fails, while the exact boundary passes', () => {
  const chunks = [{ type: 'chunk', fileName: 'large.js', code: 'x'.repeat(1024) }];
  assert.equal(measureBundles(chunks, 1).summary.warnings.length, 0);
  assert.equal(measureBundles(chunks, 0.999).summary.warnings.length, 1);
});
test('F042 missing chunks and invalid budgets fail closed', () => {
  assert.throws(() => measureBundles([]), /No JavaScript/);
  for (const limit of [0, -1, NaN, Infinity]) assert.throws(() => measureBundles([], limit), /positive/);
});
