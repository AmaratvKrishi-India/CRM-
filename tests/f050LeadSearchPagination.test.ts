import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/db/repositories/leadRepository.ts'), 'utf8');
const method = source.slice(
  source.indexOf('async searchAndFilterLeads'),
  source.indexOf('async getDistinctLocalities'),
);

test('F050 lead search paginates from a bounded cursor scan', () => {
  assert.match(method, /await collection\.each\(/);
  assert.match(method, /rankedMatches\.length > pageEnd/);
  assert.doesNotMatch(method, /const allMatched = await collection\.toArray\(\)/);
});
