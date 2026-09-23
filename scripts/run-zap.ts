import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = resolve('test-results/security/zap-report.html');
mkdirSync(dirname(outputPath), { recursive: true });

// The Windows wrapper mounts the repository at /zap/wrk inside the ZAP
// container. Passing the container path makes -quickout write back to the
// mounted workspace instead of the container's non-writable /zap directory.
const quickOut = process.platform === 'win32'
  ? '/zap/wrk/test-results/security/zap-report.html'
  : outputPath;
const command = process.platform === 'win32' ? 'cmd.exe' : 'zap';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', `zap -cmd -quickurl http://127.0.0.1:4174 -quickout ${quickOut}`]
  : ['-cmd', '-quickurl', 'http://127.0.0.1:4174', '-quickout', quickOut];

const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
if (result.error) {
  console.error(`Unable to start ZAP: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
