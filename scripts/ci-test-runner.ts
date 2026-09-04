#!/usr/bin/env tsx
/**
 * CI Test Runner
 * Optimized for GitHub Actions with proper sharding, artifact upload, and reporting
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface CIConfig {
  shardIndex: number;
  totalShards: number;
  suite: string;
  failFast: boolean;
}

function parseArgs(): CIConfig {
  const args = process.argv.slice(2);
  const config: CIConfig = {
    shardIndex: 1,
    totalShards: 1,
    suite: 'all',
    failFast: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--shard':
        config.shardIndex = parseInt(args[++i]);
        break;
      case '--total-shards':
        config.totalShards = parseInt(args[++i]);
        break;
      case '--suite':
        config.suite = args[++i];
        break;
      case '--fail-fast':
        config.failFast = true;
        break;
    }
  }

  return config;
}

function runCommand(command: string, options: { cwd?: string; env?: Record<string, string> } = {}): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      timeout: 300000, // 5 minutes default
    });
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.stdout || error.stderr || error.message };
  }
}

function runSuite(suite: string, shardIndex: number, totalShards: number): { success: boolean; output: string } {
  const commands: Record<string, string> = {
    'typecheck': 'npx tsc --noEmit',
    'lint': 'npx eslint src --ext .ts,.tsx --format json',
    'unit': `npx vitest run --shard=${shardIndex}/${totalShards} --reporter=json --outputFile=test-results/unit-${shardIndex}.json`,
    'type': 'npx tsd',
    'integration': 'npx vitest run tests/integration --reporter=json --outputFile=test-results/integration.json',
    'e2e': `npx maestro test e2e/maestro --shard=${shardIndex}/${totalShards} --format junit --output test-results/e2e-${shardIndex}.xml`,
    'visual': 'npx lost-pixel --reporter=junit --output=test-results/visual.xml',
    'performance': 'npx tsx scripts/load-test.ts --output=test-results/load-test.json',
    'a11y': 'npx tsx scripts/accessibility-runtime-test.ts --output=test-results/a11y-runtime.json',
    'security': 'npx tsx scripts/security-deps-test.ts --output=test-results/security.json',
  };

  const cmd = commands[suite];
  if (!cmd) {
    return { success: false, output: `Unknown suite: ${suite}` };
  }

  console.log(`🧪 Running ${suite} (shard ${shardIndex}/${totalShards})...`);
  return runCommand(cmd);
}

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('🚀 CI Test Runner');
  console.log('=================');
  console.log(`Suite: ${config.suite}`);
  console.log(`Shard: ${config.shardIndex}/${config.totalShards}`);
  console.log('');

  // Create test-results directory
  mkdirSync('test-results', { recursive: true });

  const suitesToRun = config.suite === 'all'
    ? ['typecheck', 'lint', 'unit', 'type', 'integration', 'e2e', 'visual', 'performance', 'a11y', 'security']
    : [config.suite];

  const results: { suite: string; success: boolean; output: string }[] = [];

  for (const suite of suitesToRun) {
    const result = runSuite(suite, config.shardIndex, config.totalShards);
    results.push({ suite, ...result });

    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${suite}`);

    if (!result.success && config.failFast) {
      console.log('\n🛑 Fail-fast enabled, stopping...');
      break;
    }
  }

  // Generate summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n📊 CI Test Summary');
  console.log('==================');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  // Write results for artifact upload
  const summary = {
    timestamp: new Date().toISOString(),
    shard: config.shardIndex,
    totalShards: config.totalShards,
    results,
    summary: { total: results.length, passed, failed },
  };

  writeFileSync(
    join('test-results', `ci-summary-${config.shardIndex}.json`),
    JSON.stringify(summary, null, 2)
  );

  // Exit with error if any required suite failed
  const requiredSuites = ['typecheck', 'lint', 'unit', 'type', 'integration', 'e2e', 'a11y', 'security'];
  const criticalFailure = results.some(r => !r.success && requiredSuites.includes(r.suite));

  if (criticalFailure) {
    console.log('\n❌ Critical suite failed');
    process.exit(1);
  }

  console.log('\n✅ All critical suites passed');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
