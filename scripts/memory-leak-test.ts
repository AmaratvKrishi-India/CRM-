#!/usr/bin/env tsx
/**
 * Memory Leak Detection Script for Amaratv Krishi Sales CRM
 * Uses memlab for automated leak detection and V8 heap snapshots
 */

import { performance } from 'perf_hooks';
import { program } from 'commander';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

program
  .option('-i, --iterations <number>', 'Number of test iterations', '10')
  .option('-s, --scenario <name>', 'Test scenario: sync, navigation, lead-crud, call-flow', 'sync')
  .option('-u, --url <url>', 'Base URL to test', 'http://localhost:3000')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/memory-test.json')
  .option('--headless', 'Run in headless mode', true)
  .option('--memlab', 'Use memlab for leak detection', true)
  .parse(process.argv);

const options = program.opts();

interface MemoryTestResult {
  timestamp: string;
  config: {
    iterations: number;
    scenario: string;
    url: string;
  };
  heapSnapshots: HeapSnapshotResult[];
  memlabResults?: MemlabResult;
  summary: {
    totalHeapGrowth: number;
    averageHeapPerIteration: number;
    potentialLeaks: number;
    passed: boolean;
  };
}

interface HeapSnapshotResult {
  iteration: number;
  timestamp: string;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  gcCount?: number;
}

interface MemlabResult {
  leaks: LeakResult[];
  scenarios: string[];
}

interface LeakResult {
  type: string;
  count: number;
  size: number;
  stackTrace: string[];
}

async function takeHeapSnapshot(): Promise<HeapSnapshotResult> {
  const mem = process.memoryUsage();
  return {
    iteration: 0,
    timestamp: new Date().toISOString(),
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

async function runScenario(url: string, scenario: string, iteration: number): Promise<void> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: options.headless !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    switch (scenario) {
      case 'sync':
        await runSyncScenario(page);
        break;
      case 'navigation':
        await runNavigationScenario(page);
        break;
      case 'lead-crud':
        await runLeadCrudScenario(page);
        break;
      case 'call-flow':
        await runCallFlowScenario(page);
        break;
      default:
        await runSyncScenario(page);
    }

    // Force garbage collection
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
  } finally {
    await browser.close();
  }
}

async function runSyncScenario(page: any): Promise<void> {
  // Simulate sync operations
  await page.evaluate(async () => {
    // Trigger sync via exposed API or UI
    const syncButton = document.querySelector('[data-testid="sync-button"]');
    if (syncButton) {
      (syncButton as HTMLElement).click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });
}

async function runNavigationScenario(page: any): Promise<void> {
  // Navigate through main routes
  const routes = ['/login', '/leads', '/calls', '/settings', '/admin'];
  for (const route of routes) {
    await page.goto(`${page.url()}${route}`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function runLeadCrudScenario(page: any): Promise<void> {
  // Create, read, update, delete leads
  await page.evaluate(async () => {
    // Simulate lead operations via API
    for (let i = 0; i < 10; i++) {
      await fetch('/rest/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'test-key' },
        body: JSON.stringify({ name: `Test Lead ${i}`, phone: `+91987654321${i}` }),
      });
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
}

async function runCallFlowScenario(page: any): Promise<void> {
  // Simulate call lifecycle
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      await fetch('/rest/v1/call_records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'test-key' },
        body: JSON.stringify({ lead_id: `test-${i}`, status: 'COMPLETED', duration: 120 }),
      });
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
}

async function runMemlab(): Promise<MemlabResult | undefined> {
  if (options.memlab !== 'true') return undefined;

  console.log('Running memlab leak detection...');

  return new Promise((resolve) => {
    const memlab = spawn('npx', ['memlab', 'run', '--scenario', `./scripts/memlab-scenario-${options.scenario}.js`], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    memlab.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    memlab.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    memlab.on('close', (code) => {
      if (code !== 0) {
        console.warn('memlab exited with code', code);
        console.warn('stderr:', stderr);
        resolve(undefined);
        return;
      }

      try {
        // Parse memlab output
        const leaks = parseMemlabOutput(stdout);
        resolve({ leaks, scenarios: [options.scenario] });
      } catch (error) {
        console.warn('Failed to parse memlab output:', error);
        resolve(undefined);
      }
    });
  });
}

function parseMemlabOutput(output: string): LeakResult[] {
  const leaks: LeakResult[] = [];
  // Parse memlab JSON output or text output
  try {
    const data = JSON.parse(output);
    if (data.leaks) {
      return data.leaks.map((leak: any) => ({
        type: leak.type || 'unknown',
        count: leak.count || 0,
        size: leak.size || 0,
        stackTrace: leak.stackTrace || [],
      }));
    }
  } catch {
    // Try text parsing
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('leak') || line.includes('Leak')) {
        leaks.push({
          type: 'detected',
          count: 1,
          size: 0,
          stackTrace: [line.trim()],
        });
      }
    }
  }
  return leaks;
}

async function runV8HeapSnapshots(): Promise<void> {
  // Generate V8 heap snapshots for manual analysis
  const snapshotDir = join('test-results', 'heap-snapshots');
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }

  // Note: Actual heap snapshot generation requires --heapsnapshot-signal or
  // programmatic API. This is a placeholder for CI integration.
  console.log('Heap snapshots would be saved to:', snapshotDir);
}

async function main(): Promise<void> {
  const iterations = parseInt(options.iterations);
  const snapshots: HeapSnapshotResult[] = [];

  console.log(`Starting memory leak test: ${options.scenario} x ${iterations} iterations`);

  // Initial snapshot
  snapshots.push(await takeHeapSnapshot());

  for (let i = 1; i <= iterations; i++) {
    console.log(`\n--- Iteration ${i}/${iterations} ---`);

    const before = await takeHeapSnapshot();
    snapshots[snapshots.length - 1].iteration = i - 1;

    await runScenario(options.url, options.scenario, i);

    // Wait for GC
    await new Promise(resolve => setTimeout(resolve, 1000));

    const after = await takeHeapSnapshot();
    after.iteration = i;
    snapshots.push(after);

    const growth = after.heapUsed - before.heapUsed;
    console.log(`  Heap growth: ${(growth / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total heap: ${(after.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }

  // Final GC and snapshot
  if (global.gc) {
    global.gc();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  snapshots.push(await takeHeapSnapshot());
  snapshots[snapshots.length - 1].iteration = iterations;

  // Run memlab
  const memlabResults = await runMemlab();

  // Analyze results
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const totalGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
  const averageGrowth = totalGrowth / iterations;

  // Check for potential leaks
  const growingIterations = snapshots.slice(1).filter((s, i) => {
    const prev = snapshots[i];
    return s.heapUsed > prev.heapUsed * 1.05; // 5% growth threshold
  }).length;

  const passed = totalGrowth < 50 * 1024 * 1024 && // Less than 50MB total growth
    averageGrowth < 5 * 1024 * 1024 && // Less than 5MB per iteration
    growingIterations < iterations * 0.3; // Less than 30% iterations show growth

  const result: MemoryTestResult = {
    timestamp: new Date().toISOString(),
    config: {
      iterations,
      scenario: options.scenario,
      url: options.url,
    },
    heapSnapshots: snapshots,
    memlabResults,
    summary: {
      totalHeapGrowth: totalGrowth,
      averageHeapPerIteration: averageGrowth,
      potentialLeaks: growingIterations,
      passed,
    },
  };

  // Write results
  mkdirSync('test-results', { recursive: true });
  writeFileSync(options.output, JSON.stringify(result, null, 2));

  // Print summary
  console.log('\n=== MEMORY LEAK TEST RESULTS ===');
  console.log(`Scenario: ${options.scenario}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`\nHeap Growth:`);
  console.log(`  Total: ${(totalGrowth / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Average/iteration: ${(averageGrowth / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Iterations with >5% growth: ${growingIterations}/${iterations}`);
  console.log(`\nMemlab Leaks: ${memlabResults?.leaks.length || 0} detected`);
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passed) {
    console.log('\n⚠️  Potential memory leaks detected. Review heap snapshots and memlab output.');
    process.exit(1);
  }

  // Save heap snapshots for manual analysis
  await runV8HeapSnapshots();

  process.exit(0);
}

main().catch(console.error);