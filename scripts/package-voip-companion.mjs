import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const output = resolve('work/voip-companion');
await mkdir(output, { recursive: true });
const files = new Map([
  ['server.mjs', 'companion/server.mjs'], ['protocol.mjs', 'companion/protocol.mjs'],
  ['SETUP-WINDOWS.md', 'docs/voip/SETUP-WINDOWS.md'],
  ['THIRD-PARTY-NOTICES.md', 'docs/voip/THIRD-PARTY-NOTICES.md'],
  ['upstream-lock.json', 'docs/voip/upstream-lock.json'],
]);
const hashes = [];
for (const [name, source] of files) {
  await copyFile(resolve(source), resolve(output, name));
  hashes.push(`${createHash('sha256').update(await readFile(source)).digest('hex')}  ${name}`);
}
await writeFile(resolve(output, 'SHA256SUMS'), hashes.join('\n') + '\n');
console.log('Source-only mock companion prepared under work/voip-companion; no upstream binary or credential included.');
