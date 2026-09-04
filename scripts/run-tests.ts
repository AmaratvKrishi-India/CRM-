import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// The original npm test command targeted tests/*.test.ts. Keep that scope
// explicit so nested integration/visual suites do not accidentally become
// Node test-runner inputs just because a new directory is added.
const testFiles = readdirSync(resolve('tests'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
  .map((entry) => join(resolve('tests'), entry.name))
  .filter((path) => !/(multiDeviceSync|realSupabasePostgres)\.test\.ts$/.test(path))
  .sort();

const runInBand = process.argv.slice(2).includes('--runInBand');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...(runInBand ? ['--test-concurrency=1'] : []), ...testFiles],
  { stdio: 'inherit', env: process.env }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
