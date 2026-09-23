import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveAndroidSdkPath } from './android-sdk';
import { runProcessWithWatchdog, stopOwnedProcessTree } from './process-watchdog';

const APP_PACKAGE = 'com.amaratvkrishi.salescrm';
const CREATE_AGENT_FUNCTION = 'create-agent';
const LOCAL_SUPABASE_API_URL = 'http://127.0.0.1:15432';
const DEBUG_APK = join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

// Keep the launcher aligned with maestro.config.yaml. The directory also
// contains newer `current/` smoke flows, but the repair target is exactly
// these 17 legacy files.
const LEGACY_MAESTRO_FLOWS = [
  'e2e/maestro/auth/login.yaml',
  'e2e/maestro/auth/logout.yaml',
  'e2e/maestro/auth/session-persistence.yaml',
  'e2e/maestro/leads/list.yaml',
  'e2e/maestro/leads/create.yaml',
  'e2e/maestro/leads/edit.yaml',
  'e2e/maestro/leads/assign.yaml',
  'e2e/maestro/calls/dial.yaml',
  'e2e/maestro/calls/outcome.yaml',
  'e2e/maestro/calls/unverified.yaml',
  'e2e/maestro/sync/online.yaml',
  'e2e/maestro/sync/offline.yaml',
  'e2e/maestro/sync/conflict.yaml',
  'e2e/maestro/sync/background.yaml',
  'e2e/maestro/admin/dashboard.yaml',
  'e2e/maestro/admin/import.yaml',
  'e2e/maestro/admin/agents.yaml',
];

function adbExecutable(): string {
  const sdk = resolveAndroidSdkPath();
  const executable = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (!existsSync(executable)) throw new Error(`ADB executable was not found at ${executable}.`);
  return executable;
}

async function selectDevice(): Promise<string> {
  const result = await runProcessWithWatchdog({
    label: 'Maestro launcher: ADB device probe',
    command: adbExecutable(),
    args: ['devices'],
    timeoutMs: 30_000,
    logFile: join('test-results', 'watchdog', 'maestro-adb-devices.log'),
  });
  if (result.status !== 'PASSED') {
    throw new Error(`Maestro device probe ${result.status}: ${result.reason ?? 'ADB probe failed'}`);
  }
  const device = result.stdout
    .split(/\r?\n/)
    .map(line => line.trim().match(/^(emulator-\S+)\s+device$/)?.[1])
    .find(Boolean);
  if (!device) throw new Error('No booted Android emulator was available for the single-device Maestro run.');
  return device;
}

async function adb(device: string, args: string[], label: string) {
  return runProcessWithWatchdog({
    label,
    command: adbExecutable(),
    args: ['-s', device, ...args],
    timeoutMs: 30_000,
    logFile: join('test-results', 'watchdog', 'maestro-adb.log'),
  });
}

async function requirePassed(
  result: Awaited<ReturnType<typeof runProcessWithWatchdog>>,
  label: string,
): Promise<void> {
  if (result.status !== 'PASSED') {
    throw new Error(`${label} ${result.status}: ${result.reason ?? (result.stderr.trim() || 'command failed')}`);
  }
}

async function prepareLocalAndroidHarness(device: string): Promise<void> {
  if (process.env.MAESTRO_SKIP_APP_PREP === '1') return;

  const env = {
    ...process.env,
    VITE_APP_ENV: 'local-test',
    CAPACITOR_ANDROID_SCHEME: 'http',
  };
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const prepLog = join('test-results', 'watchdog', 'maestro-app-prep.log');

  await requirePassed(await runProcessWithWatchdog({
    label: 'Maestro app prep: build local-test web assets',
    command: process.execPath,
    args: [npmCli, 'run', 'build:local-test'],
    cwd: process.cwd(),
    env,
    timeoutMs: 180_000,
    logFile: prepLog,
    echoOutput: true,
  }), 'Local-test web build');

  await requirePassed(await runProcessWithWatchdog({
    label: 'Maestro app prep: Capacitor Android sync',
    command: process.execPath,
    args: [npxCli, '--no-install', 'cap', 'sync', 'android'],
    cwd: process.cwd(),
    env,
    timeoutMs: 180_000,
    logFile: prepLog,
    echoOutput: true,
  }), 'Capacitor Android sync');

  const gradle = process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'gradlew.bat assembleDebug'] }
    : { command: join(process.cwd(), 'android', 'gradlew'), args: ['assembleDebug'] };
  await requirePassed(await runProcessWithWatchdog({
    label: 'Maestro app prep: assemble debug APK',
    command: gradle.command,
    args: gradle.args,
    cwd: join(process.cwd(), 'android'),
    env,
    timeoutMs: 300_000,
    logFile: prepLog,
    echoOutput: true,
  }), 'Android debug APK build');

  if (!existsSync(DEBUG_APK)) throw new Error(`Maestro debug APK was not generated at ${DEBUG_APK}.`);
  await requirePassed(
    await adb(device, ['install', '-r', DEBUG_APK], 'Maestro app prep: install local-test debug APK'),
    'Android debug APK install',
  );
  await requirePassed(
    await adb(device, ['shell', 'pm', 'path', APP_PACKAGE], 'Maestro app prep: verify installed package'),
    'Installed package verification',
  );
}

async function ensureLocalApiReverse(device: string): Promise<boolean> {
  const existing = await adb(device, ['reverse', '--list'], 'Maestro launcher: inspect ADB reverse mappings');
  if (existing.status !== 'PASSED') {
    throw new Error(`Unable to inspect ADB reverse mappings: ${existing.reason ?? existing.status}`);
  }
  const alreadyOwned = existing.stdout
    .split(/\r?\n/)
    .some(line => /tcp:15432\s+tcp:15432\s*$/.test(line.trim()));
  if (alreadyOwned) return false;

  const created = await adb(device, ['reverse', 'tcp:15432', 'tcp:15432'], 'Maestro launcher: create local Supabase reverse mapping');
  if (created.status !== 'PASSED') {
    throw new Error(`Unable to create the local Supabase reverse mapping: ${created.reason ?? created.status}`);
  }
  return true;
}

function isOfflineSyncFlow(flow: string): boolean {
  return /sync[\\/]((offline)|(conflict))\.ya?ml$/i.test(flow);
}

type OfflineReverseMonitor = {
  stop: () => Promise<void>;
  restore: () => Promise<void>;
};

function startOfflineReverseMonitor(device: string): OfflineReverseMonitor {
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;
  let detached = false;
  let hadReverse = false;

  const reconcile = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      const state = await adb(
        device,
        ['shell', 'settings', 'get', 'global', 'airplane_mode_on'],
        'Maestro offline isolation: inspect airplane mode'
      );
      if (state.status !== 'PASSED') return;

      if (state.stdout.trim() === '1' && !detached) {
        const mappings = await adb(device, ['reverse', '--list'], 'Maestro offline isolation: inspect local API reverse mapping');
        if (mappings.status !== 'PASSED') return;
        hadReverse = mappings.stdout
          .split(/\r?\n/)
          .some(line => /tcp:15432\s+tcp:15432\s*$/.test(line.trim()));
        if (hadReverse) {
          const removed = await adb(
            device,
            ['reverse', '--remove', 'tcp:15432'],
            'Maestro offline isolation: detach local API reverse mapping'
          );
          if (removed.status !== 'PASSED') return;
        }
        detached = true;
      } else if (state.stdout.trim() !== '1' && detached) {
        if (hadReverse) {
          await adb(
            device,
            ['reverse', 'tcp:15432', 'tcp:15432'],
            'Maestro offline isolation: restore local API reverse mapping'
          );
        }
        detached = false;
        hadReverse = false;
      }
    } finally {
      busy = false;
    }
  };

  timer = setInterval(() => {
    void reconcile();
  }, 3000);
  timer.unref?.();

  return {
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await reconcile();
    },
    async restore() {
      await reconcile();
    },
  };
}

async function removeLocalApiReverse(device: string, created: boolean): Promise<void> {
  if (!created) return;
  const removed = await adb(device, ['reverse', '--remove', 'tcp:15432'], 'Maestro cleanup: remove owned local Supabase reverse mapping');
  if (removed.status !== 'PASSED') {
    console.error(`Maestro cleanup ${removed.status}: ${removed.reason ?? 'reverse mapping removal failed'}`);
  }
}

function maestroCommand(): { command: string; prefix: string[] } {
  const executable = process.env.MAESTRO_BIN || (process.platform === 'win32' ? 'C:\\maestro\\bin\\maestro.bat' : 'maestro');
  if (process.platform === 'win32') return { command: 'cmd.exe', prefix: ['/d', '/s', '/c'] };
  return { command: executable, prefix: [] };
}

function flowFiles(flowPath: string): string[] {
  if (!existsSync(flowPath)) throw new Error(`Maestro flow path was not found: ${flowPath}.`);
  if (!statSync(flowPath).isDirectory()) return [flowPath];
  if (flowPath.replace(/\\/g, '/') === 'e2e/maestro') {
    const missing = LEGACY_MAESTRO_FLOWS.filter(flow => !existsSync(flow));
    if (missing.length) throw new Error(`Configured legacy Maestro flow(s) were not found: ${missing.join(', ')}`);
    return [...LEGACY_MAESTRO_FLOWS];
  }
  const entries = readdirSync(flowPath, { withFileTypes: true });
  if (!entries.length) return [flowPath];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (/\.ya?ml$/i.test(entry.name)) files.push(fullPath);
    }
  };
  if (entries.some(entry => entry.isDirectory())) visit(flowPath);
  else files.push(flowPath);
  files.sort();
  if (!files.length) throw new Error(`No Maestro YAML flows were found under ${flowPath}.`);
  return files;
}

function validateLocalOnlyEnvironment(flows: string[]): void {
  const normalized = flows.map(flow => flow.replace(/\\/g, '/'));
  const requiresAgent = normalized.some(flow =>
    flow.includes('/auth/login.yaml') ||
    flow.includes('/auth/session-persistence.yaml') ||
    flow.includes('/leads/') ||
    flow.includes('/calls/') ||
    flow.includes('/sync/')
  );
  const requiresAdmin = normalized.some(flow =>
    flow.includes('/admin/') ||
    flow.endsWith('/auth/logout.yaml') ||
    flow.endsWith('/leads/assign.yaml')
  );
  const requiresProvisionedAgent = normalized.some(flow => flow.endsWith('/admin/agents.yaml'));

  const apiUrl = process.env.MAESTRO_LOCAL_API_URL || LOCAL_SUPABASE_API_URL;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error('Maestro local API URL is invalid.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error('Maestro test accounts may only be resolved for a loopback local API URL.');
  }

  const seedPasswordFor = (email: string): string => {
    const seed = readFileSync(join('supabase', 'seed.sql'), 'utf8');
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = seed.match(new RegExp(`'${escaped}',\\s*crypt\\('([^']+)'`));
    if (!match?.[1]) throw new Error(`Local Supabase seed credentials were not found for ${email}.`);
    return match[1];
  };

  const adminEmail = process.env.SUPABASE_TEST_ADMIN_EMAIL || 'admin@amaratvkrishi.com';
  const agentEmail = process.env.SUPABASE_TEST_AGENT_EMAIL || 'rahul@amaratvkrishi.com';
  if (requiresAgent) {
    process.env.MAESTRO_AGENT_EMAIL ||= agentEmail;
    process.env.MAESTRO_AGENT_PASSWORD ||= process.env.SUPABASE_TEST_AGENT_PASSWORD || seedPasswordFor(agentEmail);
  }
  if (requiresAdmin) {
    process.env.MAESTRO_ADMIN_EMAIL ||= adminEmail;
    process.env.MAESTRO_ADMIN_PASSWORD ||= process.env.SUPABASE_TEST_ADMIN_PASSWORD || seedPasswordFor(adminEmail);
  }
  if (requiresProvisionedAgent) {
    const runTag = process.env.MAESTRO_RUN_TAG || 'local';
    process.env.MAESTRO_PROVISIONED_AGENT_EMAIL ||= `maestro-${runTag}@example.test`;
    process.env.MAESTRO_PROVISIONED_AGENT_PASSWORD ||= `${seedPasswordFor(adminEmail)}-${runTag}`;
  }

  const required = [
    ...(requiresAgent ? ['MAESTRO_AGENT_EMAIL', 'MAESTRO_AGENT_PASSWORD'] : []),
    ...(requiresAdmin ? ['MAESTRO_ADMIN_EMAIL', 'MAESTRO_ADMIN_PASSWORD'] : []),
    ...(requiresProvisionedAgent ? ['MAESTRO_PROVISIONED_AGENT_EMAIL', 'MAESTRO_PROVISIONED_AGENT_PASSWORD'] : []),
  ];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing local-only Maestro environment variable(s): ${missing.join(', ')}. ` +
      'The launcher never falls back to production credentials.'
    );
  }
}

function flowRequiresCreateAgentServer(flows: string[]): boolean {
  return flows.some(flow => flow.replace(/\\/g, '/').endsWith('/admin/agents.yaml'));
}

async function functionIsReady(apiUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${apiUrl}/functions/v1/${CREATE_AGENT_FUNCTION}`, {
      method: 'OPTIONS',
      signal: controller.signal,
    });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function startCreateAgentServer(flows: string[]): Promise<ChildProcess | null> {
  if (!flowRequiresCreateAgentServer(flows)) return null;

  const apiUrl = process.env.MAESTRO_LOCAL_API_URL || LOCAL_SUPABASE_API_URL;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error('Maestro local API URL is invalid.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error('Maestro create-agent support requires a loopback local API URL.');
  }

  if (await functionIsReady(apiUrl)) return null;

  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const args = process.platform === 'win32'
    ? [npxCli, '--no-install', 'supabase', 'functions', 'serve', CREATE_AGENT_FUNCTION]
    : ['supabase', 'functions', 'serve', CREATE_AGENT_FUNCTION];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let stderr = '';
  child.stderr?.on('data', chunk => {
    stderr = `${stderr}${chunk.toString()}`.slice(-2_000);
  });

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (await functionIsReady(apiUrl)) return child;
    if (child.exitCode !== null) {
      throw new Error(`Local create-agent server exited before readiness: ${stderr.trim() || 'unknown error'}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (child.pid) stopOwnedProcessTree(child.pid);
  throw new Error(`Local create-agent server did not become ready: ${stderr.trim() || 'timeout'}`);
}

function stopCreateAgentServer(child: ChildProcess | null): void {
  if (child?.pid) stopOwnedProcessTree(child.pid);
}

function maestroArguments(device: string, outputDir: string, flowPath: string): string[] {
  const executable = process.env.MAESTRO_BIN || (process.platform === 'win32' ? 'C:\\maestro\\bin\\maestro.bat' : 'maestro');
  const args = [
    'test', flowPath, '--config', process.env.MAESTRO_CONFIG || 'maestro.config.yaml',
    '--device', device, '--no-ansi', '--test-output-dir', outputDir,
  ];
  if (process.env.MAESTRO_AGENT_EMAIL) args.push(`-e=MAESTRO_AGENT_EMAIL=${process.env.MAESTRO_AGENT_EMAIL}`);
  if (process.env.MAESTRO_AGENT_PASSWORD) args.push(`-e=MAESTRO_AGENT_PASSWORD=${process.env.MAESTRO_AGENT_PASSWORD}`);
  if (process.env.MAESTRO_ADMIN_EMAIL) args.push(`-e=MAESTRO_ADMIN_EMAIL=${process.env.MAESTRO_ADMIN_EMAIL}`);
  if (process.env.MAESTRO_ADMIN_PASSWORD) args.push(`-e=MAESTRO_ADMIN_PASSWORD=${process.env.MAESTRO_ADMIN_PASSWORD}`);
  if (process.env.MAESTRO_PROVISIONED_AGENT_EMAIL) args.push(`-e=MAESTRO_PROVISIONED_AGENT_EMAIL=${process.env.MAESTRO_PROVISIONED_AGENT_EMAIL}`);
  if (process.env.MAESTRO_PROVISIONED_AGENT_PASSWORD) args.push(`-e=MAESTRO_PROVISIONED_AGENT_PASSWORD=${process.env.MAESTRO_PROVISIONED_AGENT_PASSWORD}`);
  if (process.env.MAESTRO_RUN_TAG) args.push(`-e=MAESTRO_RUN_TAG=${process.env.MAESTRO_RUN_TAG}`);

  if (process.platform === 'win32') {
    const invocation = process.env.MAESTRO_BIN ? `call "${executable}"` : 'maestro';
    return ['/d', '/s', '/c', `${invocation} ${args.map(value => /\s/.test(value) ? `"${value}"` : value).join(' ')}`];
  }
  return args;
}

function maestroFlowTimeoutMs(): number {
  const configured = Number(process.env.MAESTRO_FLOW_TIMEOUT_MS ?? 300_000);
  return Number.isFinite(configured) && configured >= 1_000 ? Math.floor(configured) : 300_000;
}

function materializeFlow(flow: string, runTag: string, outputDir: string, index: number): string {
  const contents = readFileSync(flow, 'utf8');
  if (!contents.includes('${MAESTRO_RUN_TAG}')) return flow;
  const generatedDir = join(outputDir, 'generated-flows');
  mkdirSync(generatedDir, { recursive: true });
  const fileName = `${String(index + 1).padStart(2, '0')}-${flow.replace(/[\\/:]/g, '_').replace(/\.ya?ml$/i, '')}.yaml`;
  const generatedPath = join(generatedDir, fileName);
  writeFileSync(generatedPath, contents.split('${MAESTRO_RUN_TAG}').join(runTag), 'utf8');
  return generatedPath;
}

async function resetAirplaneMode(device: string): Promise<void> {
  const state = await adb(device, ['shell', 'settings', 'get', 'global', 'airplane_mode_on'], 'Maestro cleanup: inspect airplane mode');
  if (state.status !== 'PASSED' || state.stdout.trim() !== '1') return;
  const disabled = await adb(device, ['shell', 'cmd', 'connectivity', 'airplane-mode', 'disable'], 'Maestro cleanup: disable airplane mode');
  if (disabled.status !== 'PASSED') console.error(`Maestro cleanup ${disabled.status}: ${disabled.reason ?? 'airplane mode disable failed'}`);
}

type FlowResult = { flow: string; status: string; reason?: string; durationMs: number; outputDir: string };

function writeSuiteArtifacts(device: string, outputDir: string, flows: string[], results: FlowResult[]): void {
  const passed = results.filter(result => result.status === 'PASSED').length;
  const failed = results.length - passed;
  const summary = {
    suite: 'legacy-maestro-crm', generatedAt: new Date().toISOString(),
    environment: 'disposable local Supabase/PostgreSQL only',
    productionCredentialsOrData: false, offlineIsolation: 'local API reverse mapping detached during airplane-mode sync flows', device, outputDir,
    flowCount: flows.length, passed, failed, results,
  };
  writeFileSync(join('test-results', 'maestro', 'flow-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  const rows = results.map(result => {
    const reason = result.reason ? result.reason.replace(/\r?\n/g, ' ') : '';
    return `| ${result.flow} | ${result.status === 'PASSED' ? 'PASS' : 'FAIL'} | ${result.durationMs} | ${reason} |`;
  });
  const report = [
    '# Legacy Maestro CRM Suite', '', `Generated: ${summary.generatedAt}`,
    `Environment: ${summary.environment}`, 'Production credentials/data used: no', `Offline isolation: ${summary.offlineIsolation}`, `Device: ${device}`,
    '', `Result: ${passed}/${flows.length} passed; ${failed} failed`, '',
    '| Flow | Status | Duration (ms) | Reason |', '| --- | --- | ---: | --- |', ...rows, '',
    'Per-flow Maestro screenshots, logs, and reports are under the run output directory above.', '',
  ].join('\n');
  writeFileSync(join('test-results', 'maestro', 'legacy-suite-report.md'), report, 'utf8');
}

async function main(): Promise<void> {
  mkdirSync('test-results/maestro', { recursive: true });
  const device = process.env.MAESTRO_DEVICE || await selectDevice();
  const outputDir = process.env.MAESTRO_OUTPUT_DIR || join('test-results', 'maestro', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(outputDir, { recursive: true });
  const { command } = maestroCommand();
  const flowPath = process.env.MAESTRO_FLOW || 'e2e/maestro';
  const flowTimeoutMs = maestroFlowTimeoutMs();
  process.env.MAESTRO_RUN_TAG = process.env.MAESTRO_RUN_TAG || String(Date.now() % 1_000_000).padStart(6, '0');
  const flows = flowFiles(flowPath);
  validateLocalOnlyEnvironment(flows);
  await prepareLocalAndroidHarness(device);
  let reverseCreated = false;
  let createAgentServer: ChildProcess | null = null;
  const results: FlowResult[] = [];
  try {
    createAgentServer = await startCreateAgentServer(flows);
    reverseCreated = await ensureLocalApiReverse(device);
    for (const [index, flow] of flows.entries()) {
      const startedAt = Date.now();
      const flowOutput = join(outputDir, `${String(index + 1).padStart(2, '0')}-${flow.replace(/[\\/:]/g, '_').replace(/\.ya?ml$/i, '')}`);
      mkdirSync(flowOutput, { recursive: true });
      const executionFlow = materializeFlow(flow, process.env.MAESTRO_RUN_TAG!, outputDir, index);
      const offlineReverseMonitor = isOfflineSyncFlow(flow) ? startOfflineReverseMonitor(device) : null;
      const runFlow = async (attempt: number) => runProcessWithWatchdog({
        label: `Maestro flow ${flow} (${device}) attempt ${attempt}`, command,
        args: maestroArguments(device, flowOutput, executionFlow), timeoutMs: flowTimeoutMs,
        logFile: join('test-results', 'watchdog', `maestro-flow-${String(index + 1).padStart(2, '0')}.log`),
        echoOutput: true,
      });
      let result = await runFlow(1);
      const transientOutput = () => `${result.stdout}\n${result.stderr}\n${result.reason ?? ''}`;
      if (result.status !== 'PASSED' && /Illegal character \(U\+0\)|DeviceCallFailedException.*viewHierarchy|Maestro Android driver did not start up in time|AndroidDriverTimeoutException/si.test(transientOutput())) {
        console.error(`Transient Maestro/ADB viewHierarchy failure in ${flow}; retrying once without weakening assertions.`);
        await adb(device, ['shell', 'am', 'force-stop', APP_PACKAGE], 'Maestro transient recovery: force-stop app');
        await new Promise(resolve => setTimeout(resolve, 2_000));
        result = await runFlow(2);
      }
      if (offlineReverseMonitor) await offlineReverseMonitor.stop();
      results.push({ flow, status: result.status, reason: result.reason, durationMs: Date.now() - startedAt, outputDir: flowOutput });
      await resetAirplaneMode(device);
      if (offlineReverseMonitor) await offlineReverseMonitor.restore();
      if (result.status !== 'PASSED') console.error(`Maestro flow ${flow} ${result.status}: ${result.reason ?? 'failed'}`);
    }
    console.log(`Maestro flow summary (${flows.length} total):`);
    results.forEach(result => console.log(`  ${result.status === 'PASSED' ? 'PASS' : 'FAIL'} ${result.flow}${result.reason ? ` — ${result.reason}` : ''}`));
    writeSuiteArtifacts(device, outputDir, flows, results);
    if (results.some(result => result.status !== 'PASSED')) process.exitCode = 1;
  } finally {
    await resetAirplaneMode(device);
    await removeLocalApiReverse(device, reverseCreated);
    stopCreateAgentServer(createAgentServer);
  }
}

main().catch(error => {
  console.error(`Unable to run Maestro: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
