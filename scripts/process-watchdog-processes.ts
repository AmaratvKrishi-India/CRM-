import { execFile, execFileSync } from 'node:child_process';

export interface ProcessRow {
  pid: number;
  parentPid: number;
  display: string;
}

export function descendantPids(rootPid: number, rows: ProcessRow[]): number[] {
  const descendants = new Set<number>([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (descendants.has(row.parentPid) && !descendants.has(row.pid)) {
        descendants.add(row.pid);
        changed = true;
      }
    }
  }
  return [...descendants];
}

function parseProcessRows(output: string): ProcessRow[] {
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
    const match = line.match(/^(\d+)\|(\d+)\|(.+)$/);
    if (!match) return [];
    return [{ pid: Number(match[1]), parentPid: Number(match[2]), display: line }];
  });
}

export function windowsProcessRows(): Promise<ProcessRow[]> {
  return new Promise(resolve => {
    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference = "Stop"; Get-CimInstance Win32_Process | ForEach-Object { "{0}|{1}|{2}" -f $_.ProcessId, $_.ParentProcessId, $_.Name }',
    ], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5_000,
    }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      resolve(parseProcessRows(stdout));
    });
  });
}

function posixProcessRows(): ProcessRow[] {
  const output = execFileSync('ps', ['-eo', 'pid=,ppid=,stat=,comm='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5_000,
  });
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) return [];
    return [{ pid: Number(match[1]), parentPid: Number(match[2]), display: line }];
  });
}

export function posixProcessTreePids(pid: number): number[] {
  if (!Number.isInteger(pid) || pid <= 0) return [];

  try {
    return descendantPids(pid, posixProcessRows());
  } catch {
    return [pid];
  }
}

export function processListing(pid: number): string[] {
  if (!Number.isInteger(pid) || pid <= 0) return [];

  try {
    if (process.platform === 'win32') {
      const output = execFileSync('tasklist.exe', ['/fo', 'csv', '/nh', '/fi', `PID eq ${pid}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5_000,
        windowsHide: true,
      });
      return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    }

    const rows = posixProcessRows();
    const ids = new Set(descendantPids(pid, rows));
    return rows.filter(row => ids.has(row.pid)).map(row => row.display);
  } catch {
    return [`Unable to inspect process ${pid}.`];
  }
}
