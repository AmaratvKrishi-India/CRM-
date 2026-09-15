import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('F052 user IDs never fall back to Math.random', () => {
  const source = fs.readFileSync('src/db/repositories/userRepository.ts', 'utf8');
  const start = source.indexOf('private generateId(): string');
  const end = source.indexOf('/**', start);
  assert.ok(start >= 0 && end > start, 'generateId implementation must exist');
  const generateId = source.slice(start, end);

  assert.match(generateId, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(generateId, /Math\.random\s*\(/);
  assert.match(generateId, /throw new Error\(/);
});
