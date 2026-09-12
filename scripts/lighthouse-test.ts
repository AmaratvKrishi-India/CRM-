#!/usr/bin/env tsx
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const config = require('../lighthouserc.cjs') as {
  url: string;
  previewPort: number;
  thresholds: Record<string, number>;
  metricBudgets: Record<string, number>;
  chromeFlags: string;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'test-results', 'lighthouse');
const reportBase = join(outDir, 'lighthouse');
const reportJson = `${reportBase}.report.json`;
const viteCli = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const lighthouseCli = join(root, 'node_modules', 'lighthouse', 'cli', 'index.js');

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code ?? 1));
  });
}
async function waitForPreview(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = 'preview did not respond';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `preview returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Lighthouse preview startup failed: ${lastError}`);
}

function stopTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function main(): Promise<void> {
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    throw new Error('dist/index.html is missing. Run npm run build before Lighthouse.');
  }
  mkdirSync(outDir, { recursive: true });
  const preview = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(config.previewPort), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let previewLog = '';
  preview.stdout?.on('data', (chunk) => { previewLog += chunk.toString(); });
  preview.stderr?.on('data', (chunk) => { previewLog += chunk.toString(); });

  try {
    await waitForPreview(config.url);
    rmSync(reportJson, { force: true });
    rmSync(`${reportBase}.report.html`, { force: true });
    const lighthouse = spawn(
      process.execPath,
      [
        lighthouseCli,
        config.url,
        '--preset=desktop',
        '--output=json',
        '--output=html',
        `--output-path=${reportBase}`,
        `--chrome-flags=${config.chromeFlags}`,
      ],
      { cwd: root, stdio: 'inherit' }
    );
    const exitCode = await waitForExit(lighthouse);
    if (!existsSync(reportJson)) throw new Error(`Missing Lighthouse JSON report: ${reportJson}`);
    const report = JSON.parse(readFileSync(reportJson, 'utf8')) as any;
    const failures: string[] = [];
    const warnings: string[] = [];
    const scores: Record<string, number> = {};

    if (report.runtimeError) {
      failures.push(`Lighthouse runtime error: ${report.runtimeError.message ?? report.runtimeError.code ?? 'unknown'}`);
    } else if (exitCode !== 0) {
      warnings.push(`Lighthouse CLI exited with code ${exitCode} after writing a complete report`);
    }

    for (const [category, minimum] of Object.entries(config.thresholds)) {
      const score = report.categories?.[category]?.score;
      if (typeof score !== 'number') {
        failures.push(`Missing Lighthouse category: ${category}`);
        continue;
      }
      scores[category] = score;
      if (score < minimum) {
        failures.push(`${category} score ${(score * 100).toFixed(0)} is below ${(minimum * 100).toFixed(0)}`);
      }
    }

    for (const [auditId, maximum] of Object.entries(config.metricBudgets)) {
      const value = report.audits?.[auditId]?.numericValue;
      if (typeof value === 'number' && value > maximum) {
        warnings.push(`${auditId} ${value.toFixed(2)} exceeds warning budget ${maximum}`);
      }
    }

    const summary = { scores, warnings, failures };
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('Lighthouse category scores:', scores);
    warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
    if (failures.length > 0) {
      failures.forEach((failure) => console.error(`FAIL: ${failure}`));
      process.exitCode = 1;
    }
  } finally {
    stopTree(preview);
    writeFileSync(join(outDir, 'preview.log'), previewLog);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
