#!/usr/bin/env tsx
/**
 * Unified Test Runner
 * Orchestrates all test suites with proper reporting and quality gates
 */

import { program } from 'commander';
import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  command: string;
  args: string[];
  outputFile: string;
  required: boolean;
  timeout: number;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
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
    duration: number;
  };
  qualityGate: {
    passed: boolean;
    failures: string[];
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
    args: ['playwright', 'test', '--project=chromium'],
    outputFile: 'test-results/playwright-junit.xml',
    required: true,
    timeout: 300000,
  },
  {
    name: 'visual-tests',
    command: 'npx',
    args: ['playwright', 'test', 'e2e/visual-regression.spec.ts', '--project=chromium'],
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
    args: ['playwright', 'test', 'e2e/accessibility.spec.ts', '--project=chromium'],
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

async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 Running ${suite.name}...`);

  return new Promise((resolve) => {
    const child = spawn(suite.command, suite.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      timeout: suite.timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const passed = code === 0;

      if (passed) {
        console.log(`✅ ${suite.name} passed (${duration}ms)`);
      } else {
        console.log(`❌ ${suite.name} failed (${duration}ms)`);
        if (stderr) console.error(stderr.slice(0, 500));
      }

      // Parse coverage for unit tests
      let coverage: CoverageSummary | undefined;
      if (suite.name === 'unit-tests' && suite.args.includes('--coverage') && existsSync('coverage/coverage-summary.json')) {
        try {
          coverage = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')).total;
        } catch {
          // Ignore coverage parse errors
        }
      }

      resolve({
        suite: suite.name,
        passed,
        duration,
        output: stdout,
        error: stderr || undefined,
        coverage,
      });
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.log(`❌ ${suite.name} error: ${error.message}`);
      resolve({
        suite: suite.name,
        passed: false,
        duration,
        error: error.message,
      });
    });
  });
}

function evaluateQualityGate(results: TestResult[]): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // Check required suites passed
  for (const suite of TEST_SUITES) {
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

async function main(): Promise<void> {
  program
    .option('-s, --suites <suites>', 'Comma-separated list of suites to run', 'all')
    .option('--skip <suites>', 'Comma-separated list of suites to skip', '')
    .option('-o, --output <file>', 'Output report file', 'test-results/unified-report.json')
    .option('--fail-fast', 'Stop on first failure', false)
    .option('--no-quality-gate', 'Skip quality gate evaluation')
    .parse(process.argv);

  const options = program.opts();
  const startTime = Date.now();

  console.log('🚀 Starting Unified Test Runner');
  console.log('================================');

  // Get git info
  let gitInfo = { branch: 'unknown', commit: 'unknown', author: 'unknown' };
  try {
    gitInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    gitInfo.commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    gitInfo.author = execSync('git log -1 --format="%an <%ae>"', { encoding: 'utf8' }).trim();
  } catch {
    // Git not available
  }

  // Determine which suites to run
  let suitesToRun = TEST_SUITES;
  if (options.suites !== 'all') {
    const selected = options.suites.split(',').map((s: string) => s.trim());
    suitesToRun = TEST_SUITES.filter(s => selected.includes(s.name));
  }
  if (options.skip) {
    const skipped = options.skip.split(',').map((s: string) => s.trim());
    suitesToRun = suitesToRun.filter(s => !skipped.includes(s.name));
  }

  console.log(`\n📋 Running ${suitesToRun.length} test suites:`);
  suitesToRun.forEach(s => console.log(`  - ${s.name}${s.required ? ' (required)' : ' (optional)'}`));

  // Create output directory
  mkdirSync('test-results', { recursive: true });

  // Run test suites
  const results: TestResult[] = [];

  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    results.push(result);

    if (options.failFast && !result.passed && suite.required) {
      console.log('\n🛑 Fail-fast enabled, stopping...');
      break;
    }
  }

  // Evaluate quality gate
  const qualityGate = options.qualityGate !== false
    ? evaluateQualityGate(results)
    : { passed: true, failures: [] };

  // Generate unified report
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const report: UnifiedReport = {
    timestamp: new Date().toISOString(),
    git: gitInfo,
    suites: results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped: TEST_SUITES.length - suitesToRun.length,
      duration: totalDuration,
    },
    qualityGate,
  };

  // Write report
  writeFileSync(options.output, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`Total:  ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Skipped: ${report.summary.skipped}`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`\n🔍 Quality Gate: ${qualityGate.passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (qualityGate.failures.length > 0) {
    console.log('\nFailures:');
    qualityGate.failures.forEach(f => console.log(`  - ${f}`));
  }

  // Print suite details
  console.log('\n📋 Suite Results:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.suite}: ${(r.duration / 1000).toFixed(1)}s`);
    if (!r.passed && r.error) {
      console.log(`      Error: ${r.error.slice(0, 200)}`);
    }
  });

  // Exit with appropriate code
  if (!qualityGate.passed) {
    process.exit(1);
  }
}

main().catch(console.error);
