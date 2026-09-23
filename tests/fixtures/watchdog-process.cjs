const fs = require('node:fs');
const { spawn } = require('node:child_process');

if (process.argv[2] === 'wait') {
  const marker = process.argv[3];
  const delay = Number(process.argv[4] || 500);
  setTimeout(() => {
    if (marker) fs.writeFileSync(marker, 'orphan-survived');
  }, delay);
} else if (process.argv[2] === 'spawn-child') {
  const child = spawn(process.execPath, [__filename, 'wait', process.argv[3], '10000'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  process.stdout.write(`child-pid=${child.pid}`);
  setTimeout(() => process.exit(0), 1500);
} else {
  process.stdout.write('watchdog-ok');
}
