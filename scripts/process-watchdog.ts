import { appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { validateProcessCommand } from './process-watchdog-allowlist';
import {
  descendantPids,
  posixProcessTreePids,
  processListing,
  windowsProcessRows,
} from './process-watchdog-processes';

export function watchdogSuiteLogPath(name: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid watchdog suite name.');
  return join('test-results', 'watchdog', `${name}.log`);
}

export type WatchdogStatus = 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';

export interface ProcessWatchdogOptions {
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  logFile?: string;
  echoOutput?: boolean;
}

export interface ProcessSnapshot {
  capturedAt: string;
  rootPid: number | undefined;
  cleanupAction: string;
  processes: string[];
  ownedPids?: number[];
}

export interface ProcessWatchdogResult {
  label: string;
  status: WatchdogStatus;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  pid: number | undefined;
  stdout: string;
  stderr: string;
  snapshots: ProcessSnapshot[];
  reason?: string;
}

function captureSnapshot(pid: number | undefined, knownPids: Iterable<number> = []): ProcessSnapshot {
  const ownedPids = new Set<number>(pid ? [pid] : []);
  for (const knownPid of knownPids) {
    if (Number.isInteger(knownPid) && knownPid > 0) ownedPids.add(knownPid);
  }
  const cleanupAction = process.platform === 'win32'
    ? 'taskkill.exe /PID <owned-root-pid> /T /F'
    : 'kill(-<owned-root-pid>, SIGTERM), then SIGKILL';
  return {
    capturedAt: new Date().toISOString(),
    rootPid: pid,
    cleanupAction,
    processes: pid ? processListing(pid) : [],
    ownedPids: [...ownedPids].sort((a, b) => a - b),
  };
}

function killOwnedProcessTree(pid: number | undefined, knownPids: Iterable<number> = []): void {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return;

  try {
    if (process.platform === 'win32') {
      // The PID is returned by spawn and is therefore owned by this watchdog.
      // /T limits cleanup to that process and its descendants.
      const targets = new Set<number>([pid]);
      for (const knownPid of knownPids) {
        if (Number.isInteger(knownPid) && knownPid > 0) targets.add(knownPid);
      }
      for (const target of targets) {
        try {
          execFileSync('taskkill.exe', ['/PID', String(target), '/T', '/F'], {
            stdio: 'ignore',
            timeout: 15_000,
            windowsHide: true,
          });
        } catch {
          // The root or descendant may have exited between observation and cleanup.
        }
      }
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGTERM');
    }
    setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // The process already exited.
        }
      }
    }, 1_000).unref();
  } catch {
    // The process may have exited between the snapshot and cleanup attempt.
  }
}

export function stopOwnedProcessTree(pid: number | undefined): ProcessSnapshot {
  const snapshot = captureSnapshot(pid);
  killOwnedProcessTree(pid);
  return snapshot;
}

function writeWatchdogLog(file: string, result: ProcessWatchdogResult): void {
  mkdirSync(dirname(file), { recursive: true });
  const header = [
    `\n=== ${result.label} | ${new Date().toISOString()} ===`,
    `status=${result.status} exitCode=${result.exitCode ?? 'null'} signal=${result.signal ?? 'null'} timedOut=${result.timedOut}`,
    `durationMs=${result.durationMs} pid=${result.pid ?? 'unknown'}`,
    `reason=${result.reason ?? ''}`,
    'processSnapshots=',
    JSON.stringify(result.snapshots, null, 2),
    'stdout=',
    result.stdout,
    'stderr=',
    result.stderr,
    '=== end ===\n',
  ].join('\n');
  appendFileSync(file, header, 'utf8');
}

export function runProcessWithWatchdog(options: ProcessWatchdogOptions): Promise<ProcessWatchdogResult> {
  const args = options.args ?? [];
  const startedAt = Date.now();

  return new Promise(resolve => {
    let child;
    try {
      validateProcessCommand(options.command, args, options.cwd);
      // The command is accepted only after validateProcessCommand applies the
      // closed executable/argument allowlist above; shell execution is disabled.
      child = spawn(options.command, args, { // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      const result: ProcessWatchdogResult = {
        label: options.label,
        status: 'ERROR',
        exitCode: null,
        signal: null,
        timedOut: false,
        durationMs: Date.now() - startedAt,
        pid: undefined,
        stdout: '',
        stderr: '',
        snapshots: [],
        reason: error instanceof Error ? error.message : String(error),
      };
      if (options.logFile) writeWatchdogLog(options.logFile, result);
      resolve(result);
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let timeoutFinalizer: NodeJS.Timeout | undefined;
    let timeout: NodeJS.Timeout | undefined;
    const ownedPids = new Set<number>(child.pid ? [child.pid] : []);
    let ownershipProbe: Promise<void> | null = null;
    const rememberOwnedProcesses = (): Promise<void> => {
      if (!child.pid) return Promise.resolve();
      if (process.platform !== 'win32') {
        for (const pid of posixProcessTreePids(child.pid)) ownedPids.add(pid);
        return Promise.resolve();
      }
      if (ownershipProbe) return ownershipProbe;
      ownershipProbe = windowsProcessRows()
        .then(rows => {
          for (const pid of descendantPids(child.pid!, rows)) ownedPids.add(pid);
        })
        .catch(() => {})
        .finally(() => {
          ownershipProbe = null;
        });
      return ownershipProbe;
    };
    void rememberOwnedProcesses();
    const ownershipTracker = process.platform === 'win32'
      ? setInterval(() => { void rememberOwnedProcesses(); }, 500)
      : undefined;
    ownershipTracker?.unref();
    const initialOwnershipProbe = process.platform === 'win32'
      ? setTimeout(() => { void rememberOwnedProcesses(); }, 50)
      : undefined;
    initialOwnershipProbe?.unref();
    const snapshots: ProcessSnapshot[] = [captureSnapshot(child.pid, ownedPids)];

    const finish = async (status: WatchdogStatus, exitCode: number | null, signal: NodeJS.Signals | null, reason?: string) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (timeoutFinalizer) clearTimeout(timeoutFinalizer);
      if (ownershipTracker) clearInterval(ownershipTracker);
      if (initialOwnershipProbe) clearTimeout(initialOwnershipProbe);
      await rememberOwnedProcesses();
      if (ownedPids.size > 1) {
        snapshots.push(captureSnapshot(child.pid, ownedPids));
        killOwnedProcessTree(child.pid, ownedPids);
      }
      const result: ProcessWatchdogResult = {
        label: options.label,
        status,
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
        pid: child.pid,
        stdout,
        stderr,
        snapshots,
        reason,
      };
      if (options.logFile) writeWatchdogLog(options.logFile, result);
      resolve(result);
    };

    child.stdout?.on('data', data => {
      const text = data.toString();
      stdout += text;
      if (options.echoOutput) process.stdout.write(text);
    });
    child.stderr?.on('data', data => {
      const text = data.toString();
      stderr += text;
      if (options.echoOutput) process.stderr.write(text);
    });
    child.once('error', error => {
      void finish(timedOut ? 'TIMEOUT' : 'ERROR', null, null, error.message);
    });
    child.once('close', (code, signal) => {
      if (timedOut) {
        void finish('TIMEOUT', code, signal, `Watchdog timeout after ${options.timeoutMs}ms; owned process tree was terminated.`);
      } else {
        void finish(code === 0 ? 'PASSED' : 'FAILED', code, signal, code === 0 ? undefined : `Process exited with code ${code ?? 'unknown'}.`);
      }
    });

    timeout = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      void rememberOwnedProcesses();
      snapshots.push(captureSnapshot(child.pid, ownedPids));
      killOwnedProcessTree(child.pid, ownedPids);
      timeoutFinalizer = setTimeout(() => {
        void finish('TIMEOUT', null, null, `Watchdog timeout after ${options.timeoutMs}ms; owned process tree was terminated.`);
      }, 5_000);
    }, options.timeoutMs);
    timeout.unref();
  });
}
