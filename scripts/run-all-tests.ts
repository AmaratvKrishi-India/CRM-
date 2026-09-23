#!/usr/bin/env tsx
/**
 * Unified Test Runner
 * Orchestrates all test suites with proper reporting and quality gates
 */

import { program } from 'commander';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { resolveAndroidSdkPath } from './android-sdk';
import { runProcessWithWatchdog, ProcessWatchdogResult, watchdogSuiteLogPath } from './process-watchdog';

const LOCAL_TSX = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');

interface TestSuite {
  name: string;
  command: string;
  args: string[];
  outputFile: string;
  required: boolean;
  timeout: number;
}

type RunnerProfile = 'full-release' | 'desktop' | 'browser' | 'backend' | 'realtime' | 'edge-function' | 'android' | 'maestro' | 'mutation' | 'security' | 'focused-custom';
type ResultClassification = 'APPLICATION_FAILURE' | 'INFRASTRUCTURE_LIMITATION' | 'OPTIONAL_UNAVAILABLE' | 'NOT_STARTED';

interface TestResult {
  suite: string;
  passed: boolean;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'NOT RUN';
  duration: number;
  output?: string;
  error?: string;
  reason?: string;
  classification?: ResultClassification;
  coverage?: CoverageSummary;
}

interface CoverageSummary {
  lines: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
}

interface UnifiedReport {
  timestamp: string;
  profile: RunnerProfile;
  completeReleaseDecision: boolean;
  releaseDecision: 'PASS' | 'PARTIAL' | 'FAIL';
  git: {
    branch: string;
    commit: string;
    author: string;
  };
  suites: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    notRun: number;
    duration: number;
  };
  qualityGate: {
    passed: boolean;
    enabled: boolean;
    failures: string[];
    evaluatedSuites: string[];
    limitations: string[];
  };
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'typecheck',
    command: 'npx',
    args: ['tsc', '--noEmit'],
    outputFile: 'test-results/typecheck.json',
    required: true,
    timeout: 60000,
  },
  {
    name: 'lint',
    command: 'npx',
    args: ['eslint', 'src', '--ext', '.ts,.tsx', '--format', 'json'],
    outputFile: 'test-results/lint.json',
    required: true,
    timeout: 60000,
  },
  {
    name: 'unit-tests',
    command: 'npx',
    args: ['vitest', 'run', '--exclude', 'tests/integration/**', '--reporter=json', '--outputFile=test-results/unit.json'],
    outputFile: 'test-results/unit.json',
    required: true,
    timeout: 120000,
  },
  {
    name: 'type-tests',
    command: 'npm',
    args: ['run', 'test:type'],
    outputFile: 'test-results/type-tests.json',
    required: true,
    timeout: 60000,
  },
  {
    name: 'integration-tests',
    command: 'npx',
    args: ['vitest', 'run', 'tests/integration', '--no-file-parallelism', '--reporter=json', '--outputFile=test-results/integration.json'],
    outputFile: 'test-results/integration.json',
    required: true,
    timeout: 180000,
  },
  {
    name: 'e2e-tests',
    command: 'npx',
    // The local Vite server is a shared disposable resource. Serial startup
    // prevents parallel login pages from timing out while the server warms.
    args: ['playwright', 'test', '--project=chromium', '--workers=1'],
    outputFile: 'test-results/playwright-junit.xml',
    required: true,
    timeout: 600000,
  },
  {
    name: 'real-browser-e2e',
    command: 'npm',
    args: ['run', 'test:e2e:real'],
    outputFile: 'test-results/real-browser-e2e.log',
    required: true,
    timeout: 360000,
  },
  {
    name: 'real-edge-function',
    command: 'npm',
    args: ['run', 'test:edge:real'],
    outputFile: 'test-results/real-edge-function.log',
    required: true,
    timeout: 240000,
  },
  {
    name: 'multi-device-android',
    command: 'npx',
    args: ['tsx', 'tests/multiDeviceSync.test.ts'],
    outputFile: 'test-results/multi-device-android.log',
    required: false,
    // Three cold emulators serialize APK installation and WebView startup; each
    // underlying operation remains bounded by its own watchdog.
    timeout: 1200000,
  },
  {
    name: 'maestro-android',
    command: process.execPath,
    args: [LOCAL_TSX, 'scripts/run-maestro.ts'],
    outputFile: 'test-results/maestro-android.log',
    required: false,
    // Up to 17 bounded flows at the runner's 90s default, plus emulator/Java
    // startup and cleanup. Each flow still has its own watchdog.
    timeout: 1800000,
  },
  {
    name: 'native-lifecycle-android',
    command: process.execPath,
    args: [LOCAL_TSX, 'scripts/run-native-lifecycle.ts'],
    outputFile: 'test-results/native-lifecycle-android.log',
    required: false,
    timeout: 900000,
  },
  {
    name: 'mutation-tests',
    command: 'npm',
    args: ['run', 'audit:mutation'],
    outputFile: 'test-results/mutation-tests.log',
    required: false,
    timeout: 600000,
  },
  {
    name: 'visual-tests',
    command: 'npx',
    args: ['playwright', 'test', 'e2e/visual-regression.spec.ts', '--project=chromium', '--workers=1'],
    outputFile: 'playwright-report/index.html',
    required: false,
    timeout: 240000,
  },
  {
    name: 'performance-tests',
    command: 'npm',
    args: ['run', 'test:perf:bundle'],
    outputFile: 'test-results/bundle-analysis/bundle-analysis.json',
    required: false,
    timeout: 120000,
  },
  {
    name: 'accessibility-tests',
    command: 'npx',
    args: ['playwright', 'test', 'e2e/accessibility.spec.ts', '--project=chromium', '--workers=1'],
    outputFile: 'playwright-report/index.html',
    required: true,
    timeout: 240000,
  },
  {
    name: 'security-tests',
    command: 'npm',
    args: ['audit', '--audit-level=high', '--json'],
    outputFile: 'test-results/unified-report.json',
    required: true,
    timeout: 180000,
  },
];

const PROFILE_SUITES: Record<Exclude<RunnerProfile, 'focused-custom'>, string[]> = {
  'full-release': TEST_SUITES.map(suite => suite.name),
  desktop: ['typecheck', 'lint', 'unit-tests', 'type-tests', 'integration-tests', 'e2e-tests', 'accessibility-tests', 'security-tests'],
  browser: ['typecheck', 'lint', 'unit-tests', 'type-tests', 'integration-tests', 'e2e-tests', 'real-browser-e2e', 'accessibility-tests', 'security-tests'],
  backend: ['typecheck', 'lint', 'unit-tests', 'integration-tests', 'real-edge-function', 'security-tests'],
  realtime: ['typecheck', 'lint', 'integration-tests', 'real-browser-e2e'],
  'edge-function': ['typecheck', 'lint', 'real-edge-function', 'security-tests'],
  android: ['typecheck', 'lint', 'multi-device-android', 'native-lifecycle-android'],
  maestro: ['typecheck', 'lint', 'maestro-android'],
  mutation: ['typecheck', 'mutation-tests'],
  security: ['typecheck', 'lint', 'security-tests'],
};

function resolveSpawnCommand(suite: TestSuite): { command: string; args: string[] } {
  if (process.platform === 'win32' && (suite.command === 'npm' || suite.command === 'npx')) {
    // suite.command is constrained to the static TestSuite definitions above (npm/npx here).
    const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', `${suite.command}-cli.js`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    return { command: process.execPath, args: [cli, ...suite.args] };
  }
  return { command: suite.command, args: suite.args };
}

interface SuitePrerequisite {
  runnable: boolean;
  reason?: string;
  classification?: ResultClassification;
}

async function checkAndroidDevices(requiredCount: number): Promise<SuitePrerequisite> {
  let adb: string;
  try {
    adb = join(resolveAndroidSdkPath(), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  } catch (error) {
    return {
      runnable: false,
      reason: error instanceof Error ? error.message : String(error),
      classification: 'OPTIONAL_UNAVAILABLE',
    };
  }

  const probe = await runProcessWithWatchdog({
    label: `Runner prerequisite: ADB device probe (need ${requiredCount})`,
    command: adb,
    args: ['devices'],
    timeoutMs: 30_000,
    logFile: watchdogSuiteLogPath('adb-devices'),
  });
  if (probe.status !== 'PASSED') {
    return {
      runnable: false,
      reason: `ADB prerequisite ${probe.status}: ${probe.reason ?? 'device probe failed'}`,
      classification: 'INFRASTRUCTURE_LIMITATION',
    };
  }

  const devices = probe.stdout.split(/\r?\n/).filter((line: string) => /^emulator-\S+\s+device\s*$/.test(line.trim()));
  if (devices.length < requiredCount) {
    return {
      runnable: false,
      reason: `${requiredCount} Android emulator devices are required; detected ${devices.length}.`,
      classification: 'OPTIONAL_UNAVAILABLE',
    };
  }
  return { runnable: true };
}

async function checkSuitePrerequisite(suite: TestSuite): Promise<SuitePrerequisite> {
  if (suite.name === 'multi-device-android') return checkAndroidDevices(3);
  if (suite.name === 'native-lifecycle-android') return checkAndroidDevices(1);
  if (suite.name !== 'maestro-android') return { runnable: true };

  const maestroCredentialVariables = [
    'MAESTRO_AGENT_EMAIL',
    'MAESTRO_AGENT_PASSWORD',
    'MAESTRO_ADMIN_EMAIL',
    'MAESTRO_ADMIN_PASSWORD',
    'MAESTRO_PROVISIONED_AGENT_EMAIL',
    'MAESTRO_PROVISIONED_AGENT_PASSWORD',
  ];
  const missingMaestroCredentials = maestroCredentialVariables.filter(name => !process.env[name]);
  if (missingMaestroCredentials.length) {
    return {
      runnable: false,
      reason: `Maestro functional suite requires local-only credential variables (${missingMaestroCredentials.join(', ')} missing); production credentials are never accepted.`,
      classification: 'OPTIONAL_UNAVAILABLE',
    };
  }

  const devices = await checkAndroidDevices(1);
  if (!devices.runnable) return devices;

  // MAESTRO_BIN may point at a checked-in/local wrapper; otherwise resolve the
  // installed command through PATH.  The previous Windows-only hard-coded
  // C:\\maestro path incorrectly marked a working PATH installation absent.
  const maestroPath = process.env.MAESTRO_BIN || 'maestro';
  const probe = await runProcessWithWatchdog({
    label: 'Runner prerequisite: Maestro version probe',
    command: process.platform === 'win32' ? 'cmd.exe' : maestroPath,
    args: process.platform === 'win32'
      ? ['/d', '/s', '/c', process.env.MAESTRO_BIN ? `"${maestroPath}" --version` : 'maestro --version']
      : ['--version'],
    timeoutMs: 30_000,
    logFile: watchdogSuiteLogPath('maestro-version'),
  });
  if (probe.status !== 'PASSED') {
    return {
      runnable: false,
      reason: `Maestro prerequisite ${probe.status}: ${probe.reason ?? 'version probe failed'}`,
      classification: 'INFRASTRUCTURE_LIMITATION',
    };
  }
  return { runnable: true };
}

function resultFromWatchdog(suite: TestSuite, watchdog: ProcessWatchdogResult, startTime: number): TestResult {
  const timedOut = watchdog.status === 'TIMEOUT';
  const failed = watchdog.status !== 'PASSED';
  const infrastructureOutput = `${watchdog.stdout}\n${watchdog.stderr}`.includes('INFRASTRUCTURE_LIMITATION');
  const classification: ResultClassification | undefined = timedOut || watchdog.status === 'ERROR' || infrastructureOutput
    ? 'INFRASTRUCTURE_LIMITATION'
    : failed
      ? 'APPLICATION_FAILURE'
      : undefined;
  const reason = watchdog.reason;
  const result: TestResult = {
    suite: suite.name,
    passed: !failed,
    status: failed ? 'FAILED' : 'PASSED',
    duration: Date.now() - startTime,
    output: watchdog.stdout,
    error: watchdog.stderr || undefined,
    reason,
    classification,
  };
  if (timedOut) {
    result.reason = `TIMEOUT: ${reason ?? `watchdog expired after ${suite.timeout}ms`}`;
  }
  return result;
}

async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 Running ${suite.name}...`);

  const prerequisite = await checkSuitePrerequisite(suite);
  if (!prerequisite.runnable) {
    console.log(`⏭️ ${suite.name} not run: ${prerequisite.reason}`);
    return {
      suite: suite.name,
      passed: false,
      status: 'NOT RUN',
      duration: 0,
      reason: prerequisite.reason,
      classification: prerequisite.classification ?? 'OPTIONAL_UNAVAILABLE',
    };
  }

  const resolved = resolveSpawnCommand(suite);
  // resolved command/args come exclusively from the static TestSuite table; the watchdog never invokes a shell.
  const watchdog = await runProcessWithWatchdog({
    label: `Runner suite: ${suite.name}`,
    command: resolved.command,
    args: resolved.args,
    timeoutMs: suite.timeout,
    logFile: watchdogSuiteLogPath(suite.name),
    echoOutput: true,
  });
  const result = resultFromWatchdog(suite, watchdog, startTime);

  if (result.passed) {
    console.log(`✅ ${suite.name} passed (${result.duration}ms)`);
  } else {
    console.log(`❌ ${suite.name} failed (${result.duration}ms)${result.reason ? ` — ${result.reason}` : ''}`);
    if (result.error) console.error(result.error.slice(0, 500));
  }

  if (suite.name === 'unit-tests' && suite.args.includes('--coverage') && existsSync('coverage/coverage-summary.json')) {
    try {
      result.coverage = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')).total;
    } catch {
      // Ignore coverage parse errors.
    }
  }
  return result;
}

function evaluateQualityGate(results: TestResult[], suitesToEvaluate: TestSuite[]): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // Check required suites passed
  for (const suite of suitesToEvaluate) {
    if (suite.required) {
      const result = results.find(r => r.suite === suite.name);
      if (!result || !result.passed) {
        failures.push(`Required suite "${suite.name}" failed`);
      }
    }
  }

  // Check coverage thresholds
  const unitResult = results.find(r => r.suite === 'unit-tests');
  if (unitResult?.coverage) {
    const { lines, functions, branches, statements } = unitResult.coverage;
    if (lines.pct < 80) failures.push(`Line coverage ${lines.pct}% below 80% threshold`);
    if (functions.pct < 80) failures.push(`Function coverage ${functions.pct}% below 80% threshold`);
    if (branches.pct < 70) failures.push(`Branch coverage ${branches.pct}% below 70% threshold`);
    if (statements.pct < 80) failures.push(`Statement coverage ${statements.pct}% below 80% threshold`);
  }

  // Check for critical security vulnerabilities
  const securityResult = results.find(r => r.suite === 'security-tests');
  if (securityResult?.output) {
    try {
      const securityData = JSON.parse(securityResult.output);
      const criticalVulns = securityData.results?.flatMap((r: any) =>
        r.vulnerabilities?.filter((v: any) => v.severity === 'CRITICAL') || []
      ) || [];
      if (criticalVulns.length > 0) {
        failures.push(`${criticalVulns.length} critical vulnerabilities found`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check accessibility violations
  const a11yResult = results.find(r => r.suite === 'accessibility-tests');
  if (a11yResult?.output) {
    try {
      const a11yData = JSON.parse(a11yResult.output);
      if (a11yData.summary?.totalViolations > 0) {
        failures.push(`${a11yData.summary.totalViolations} accessibility violations found`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

interface RunnerOptions {
  suites: string;
  profile: string;
  skip: string;
  output: string;
  failFast: boolean;
  qualityGate: boolean;
}

function collectGitInfo(): UnifiedReport['git'] {
  const gitInfo = { branch: 'unknown', commit: 'unknown', author: 'unknown' };
  try {
    gitInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    gitInfo.commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    gitInfo.author = execSync('git log -1 --format="%an <%ae>"', { encoding: 'utf8' }).trim();
  } catch {
    // Git not available
  }
  return gitInfo;
}

function resolveRunSelection(options: RunnerOptions): { profile: RunnerProfile; suitesToRun: TestSuite[] } {
  const requestedProfile = options.profile as RunnerProfile;
  if (!(requestedProfile in PROFILE_SUITES)) {
    throw new Error(`Unknown runner profile "${requestedProfile}".`);
  }

  const explicitSuiteSelection = options.suites !== 'all';
  const selectedNames = explicitSuiteSelection
    ? options.suites.split(',').map((suite: string) => suite.trim())
    : PROFILE_SUITES[requestedProfile as Exclude<RunnerProfile, 'focused-custom'>];

  let suitesToRun = TEST_SUITES.filter(suite => selectedNames.includes(suite.name));
  if (options.skip) {
    const skipped = new Set(options.skip.split(',').map((suite: string) => suite.trim()));
    suitesToRun = suitesToRun.filter(suite => !skipped.has(suite.name));
  }

  return {
    profile: explicitSuiteSelection ? 'focused-custom' : requestedProfile,
    suitesToRun,
  };
}

function appendNotRunResults(results: TestResult[], suitesToRun: TestSuite[], completedSuites: Set<string>): void {
  const selectedNames = new Set(suitesToRun.map(suite => suite.name));
  for (const suite of TEST_SUITES) {
    if (completedSuites.has(suite.name)) continue;
    const wasSelected = selectedNames.has(suite.name);
    results.push({
      suite: suite.name,
      passed: false,
      status: 'NOT RUN',
      duration: 0,
      reason: wasSelected
        ? 'Stopped by fail-fast after an earlier required failure.'
        : 'Excluded by suite selection or --skip; this suite was NOT RUN.',
      classification: 'NOT_STARTED',
    });
  }
}

function assessRelease(
  results: TestResult[],
  suitesToRun: TestSuite[],
  profile: RunnerProfile,
  qualityGateEnabled: boolean
): Pick<UnifiedReport, 'completeReleaseDecision' | 'releaseDecision' | 'qualityGate'> {
  const qualitySuites = profile === 'full-release' ? TEST_SUITES : suitesToRun;
  const evaluatedQualityGate = evaluateQualityGate(results, qualitySuites);
  const qualityGate = {
    ...evaluatedQualityGate,
    enabled: qualityGateEnabled,
    evaluatedSuites: qualitySuites.map(suite => suite.name),
    limitations: results
      .filter(result => result.classification === 'INFRASTRUCTURE_LIMITATION' || result.classification === 'OPTIONAL_UNAVAILABLE')
      .map(result => `${result.suite}: ${result.reason ?? result.classification}`),
  };
  const requiredOmissions = TEST_SUITES
    .filter(suite => suite.required && !suitesToRun.some(selected => selected.name === suite.name))
    .map(suite => suite.name);
  const optionalGaps = results.some(result => !TEST_SUITES.find(suite => suite.name === result.suite)?.required && result.status !== 'PASSED');
  const completeReleaseDecision =
    profile === 'full-release' &&
    qualityGateEnabled &&
    requiredOmissions.length === 0 &&
    qualityGate.failures.length === 0 &&
    !optionalGaps;

  let releaseDecision: UnifiedReport['releaseDecision'] = 'PARTIAL';
  if (qualityGateEnabled && !qualityGate.passed) releaseDecision = 'FAIL';
  else if (completeReleaseDecision) releaseDecision = 'PASS';

  return { qualityGate, completeReleaseDecision, releaseDecision };
}

function summarizeResults(results: TestResult[], totalDuration: number): UnifiedReport['summary'] {
  return {
    total: results.length,
    passed: results.filter(result => result.status === 'PASSED').length,
    failed: results.filter(result => result.status === 'FAILED').length,
    skipped: results.filter(result => result.status === 'SKIPPED').length,
    notRun: results.filter(result => result.status === 'NOT RUN').length,
    duration: totalDuration,
  };
}

function printReport(report: UnifiedReport): void {
  const { summary, qualityGate, releaseDecision, completeReleaseDecision, suites } = report;
  console.log('\n\u{1F4CA} TEST SUMMARY');
  console.log('================');
  console.log(`Total:  ${summary.total}`);
  console.log(`Passed: ${summary.passed} \u2705`);
  console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '\u274C' : ''}`);
  console.log(`Skipped: ${summary.skipped} \u23ED\uFE0F`);
  console.log(`Not run: ${summary.notRun}`);
  console.log(`Duration: ${(summary.duration / 1000).toFixed(1)}s`);
  console.log(`\n\u{1F50D} Quality Gate: ${qualityGate.passed ? '\u2705 PASSED' : '\u274C FAILED'}${qualityGate.enabled ? '' : ' (disabled for diagnostic run)'}`);
  console.log(`Release decision: ${releaseDecision}${completeReleaseDecision ? '' : ' (not complete)'}`);

  if (qualityGate.failures.length > 0) {
    console.log('\nFailures:');
    qualityGate.failures.forEach(failure => console.log(`  - ${failure}`));
  }

  console.log('\n\u{1F4CB} Suite Results:');
  suites.forEach(result => {
    const statusIcon =
      result.status === 'PASSED' ? '\u2705' :
      result.status === 'SKIPPED' ? '\u23ED\uFE0F' :
      result.status === 'NOT RUN' ? '\u23F8\uFE0F' : '\u274C';
    console.log(`  ${statusIcon} ${result.suite}: ${result.status} ${(result.duration / 1000).toFixed(1)}s${result.reason ? ` \u2014 ${result.reason}` : ''}`);
    if (result.status === 'FAILED' && result.error) {
      console.log(`      Error: ${result.error.slice(0, 200)}`);
    }
  });

  if (qualityGate.limitations.length > 0) {
    console.log('\nLimitations:');
    qualityGate.limitations.forEach(limitation => console.log(`  - ${limitation}`));
  }
}

async function main(): Promise<void> {
  program
    .option('-s, --suites <suites>', 'Comma-separated list of suites to run', 'all')
    .option('--profile <profile>', 'Runner profile: full-release, desktop, browser, backend, realtime, edge-function, android, maestro, mutation, or security', 'full-release')
    .option('--skip <suites>', 'Comma-separated list of suites to skip', '')
    .option('-o, --output <file>', 'Output report file', 'test-results/unified-report.json')
    .option('--fail-fast', 'Stop on first failure', false)
    .option('--no-quality-gate', 'Skip quality gate evaluation')
    .parse(process.argv);

  const options = program.opts<RunnerOptions>();
  const startTime = Date.now();

  console.log('\u{1F680} Starting Unified Test Runner');
  console.log('================================');

  const gitInfo = collectGitInfo();
  const { profile, suitesToRun } = resolveRunSelection(options);
  console.log(`\n\u{1F4CB} Profile: ${profile}`);
  console.log(`\u{1F4CB} Running ${suitesToRun.length} test suites:`);
  suitesToRun.forEach(suite => console.log(`  - ${suite.name}${suite.required ? ' (required)' : ' (optional)'}`));

  mkdirSync('test-results', { recursive: true });

  const results: TestResult[] = [];
  const completedSuites = new Set<string>();
  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    results.push(result);
    completedSuites.add(suite.name);
    if (options.failFast && !result.passed && suite.required) {
      console.log('\n\u{1F6D1} Fail-fast enabled, stopping...');
      break;
    }
  }

  appendNotRunResults(results, suitesToRun, completedSuites);
  const release = assessRelease(results, suitesToRun, profile, options.qualityGate !== false);
  const totalDuration = Date.now() - startTime;
  const report: UnifiedReport = {
    timestamp: new Date().toISOString(),
    profile,
    ...release,
    git: gitInfo,
    suites: results,
    summary: summarizeResults(results, totalDuration),
  };

  writeFileSync(options.output, JSON.stringify(report, null, 2));
  printReport(report);

  if (report.qualityGate.enabled && !report.qualityGate.passed) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
