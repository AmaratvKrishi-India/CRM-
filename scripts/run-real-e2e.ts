import { join } from 'node:path';
import { runProcessWithWatchdog } from './process-watchdog';

async function main(): Promise<void> {
  const result = await runProcessWithWatchdog({
    label: 'Real Supabase browser CRUD and multi-client suite',
    command: process.execPath,
    args: [
      'node_modules/playwright/cli.js',
      'test',
      'e2e/real-crud-supabase.spec.ts',
      'e2e/real-multiclient-supabase.spec.ts',
      '--project=chromium',
      '--workers=1',
    ],
    cwd: process.cwd(),
    env: { ...process.env, PLAYWRIGHT_REAL_SUPABASE: '1' },
    timeoutMs: 360_000,
    logFile: join(process.cwd(), 'test-results', 'real-browser-e2e-watchdog.log'),
    echoOutput: true,
  });
  if (result.status !== 'PASSED') {
    console.error(`Real Supabase browser suite ${result.status}: ${result.reason ?? 'no additional reason'}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Unable to run the real Supabase browser suite: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
