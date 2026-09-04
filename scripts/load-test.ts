#!/usr/bin/env tsx
/**
 * Load Test Script for Amaratv Krishi Sales CRM
 * Tests sync throughput, API response times, and concurrent user simulation
 * Uses autocannon for HTTP load testing
 */

import autocannon from 'autocannon';
import { performance } from 'perf_hooks';
import { program } from 'commander';

program
  .option('-d, --duration <seconds>', 'Test duration in seconds', '30')
  .option('-c, --connections <number>', 'Number of concurrent connections', '50')
  .option('-p, --pipelining <number>', 'Number of pipelined requests', '1')
  .option('-u, --url <url>', 'Base URL to test', 'http://localhost:3000')
  .option('-r, --ramp-up <seconds>', 'Ramp-up time in seconds', '5')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/load-test.json')
  .parse(process.argv);

const options = program.opts();

interface LoadTestResult {
  timestamp: string;
  config: {
    duration: number;
    connections: number;
    pipelining: number;
    url: string;
    rampUp: number;
  };
  results: {
    latency: {
      mean: number;
      stddev: number;
      min: number;
      max: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    throughput: {
      mean: number;
      stddev: number;
      min: number;
      max: number;
    };
    requests: {
      total: number;
      mean: number;
      stddev: number;
    };
    errors: number;
    timeouts: number;
    non2xx: number;
  };
  syncTests?: SyncTestResult[];
}

interface SyncTestResult {
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
}

const SYNC_ENDPOINTS = [
  { method: 'POST', path: '/rest/v1/sync/push', weight: 30 },
  { method: 'POST', path: '/rest/v1/sync/pull', weight: 30 },
  { method: 'GET', path: '/rest/v1/leads?select=*', weight: 20 },
  { method: 'GET', path: '/rest/v1/activities?select=*', weight: 10 },
  { method: 'GET', path: '/rest/v1/call_records?select=*', weight: 10 },
];

async function runLoadTest(): Promise<LoadTestResult> {
  const config = {
    duration: parseInt(options.duration),
    connections: parseInt(options.connections),
    pipelining: parseInt(options.pipelining),
    url: options.url,
    rampUp: parseInt(options.rampUp),
  };

  console.log(`Starting load test with config:`, config);

  const results = await autocannon({
    url: config.url,
    connections: config.connections,
    pipelining: config.pipelining,
    duration: config.duration,
    warmup: [config.rampUp * 1000],
    headers: {
      'apikey': 'test-anon-key',
      'Authorization': 'Bearer test-anon-key',
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    requests: SYNC_ENDPOINTS.map(endpoint => ({
      method: endpoint.method,
      path: endpoint.path,
      weight: endpoint.weight,
      body: endpoint.method === 'POST' ? JSON.stringify({ operations: [] }) : undefined,
    })),
    setupClient: (client) => {
      client.on('error', (err) => {
        console.error('Client error:', err.message);
      });
    },
  });

  // Run sync-specific tests
  const syncResults = await runSyncTests(config.url);

  const output: LoadTestResult = {
    timestamp: new Date().toISOString(),
    config,
    results: {
      latency: results.latency,
      throughput: results.throughput,
      requests: results.requests,
      errors: results.errors,
      timeouts: results.timeouts,
      non2xx: results.non2xx,
    },
    syncTests: syncResults,
  };

  return output;
}

async function runSyncTests(baseUrl: string): Promise<SyncTestResult[]> {
  const results: SyncTestResult[] = [];

  // Test sync push operation
  const pushStart = performance.now();
  try {
    const response = await fetch(`${baseUrl}/rest/v1/sync/push`, {
      method: 'POST',
      headers: {
        'apikey': 'test-anon-key',
        'Authorization': 'Bearer test-anon-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [
          { type: 'INSERT', table: 'leads', data: { name: 'Test Lead', phone: '+919876543210' } },
          { type: 'UPDATE', table: 'activities', data: { id: 'test-id', status: 'completed' } },
        ],
      }),
    });
    const pushDuration = performance.now() - pushStart;
    results.push({
      operation: 'sync_push',
      duration: pushDuration,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    });
  } catch (error) {
    results.push({
      operation: 'sync_push',
      duration: performance.now() - pushStart,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test sync pull operation
  const pullStart = performance.now();
  try {
    const response = await fetch(`${baseUrl}/rest/v1/sync/pull?cursor=0&limit=100`, {
      method: 'GET',
      headers: {
        'apikey': 'test-anon-key',
        'Authorization': 'Bearer test-anon-key',
      },
    });
    const pullDuration = performance.now() - pullStart;
    results.push({
      operation: 'sync_pull',
      duration: pullDuration,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    });
  } catch (error) {
    results.push({
      operation: 'sync_pull',
      duration: performance.now() - pullStart,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test leads query
  const leadsStart = performance.now();
  try {
    const response = await fetch(`${baseUrl}/rest/v1/leads?select=id,name,phone,status&limit=50`, {
      method: 'GET',
      headers: {
        'apikey': 'test-anon-key',
        'Authorization': 'Bearer test-anon-key',
      },
    });
    const leadsDuration = performance.now() - leadsStart;
    results.push({
      operation: 'leads_query',
      duration: leadsDuration,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    });
  } catch (error) {
    results.push({
      operation: 'leads_query',
      duration: performance.now() - leadsStart,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

async function main() {
  try {
    const result = await runLoadTest();

    // Write results
    const fs = await import('fs/promises');
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(options.output, JSON.stringify(result, null, 2));

    // Print summary
    console.log('\n=== LOAD TEST RESULTS ===');
    console.log(`Duration: ${result.config.duration}s`);
    console.log(`Connections: ${result.config.connections}`);
    console.log(`URL: ${result.config.url}`);
    console.log('\n--- Latency (ms) ---');
    console.log(`  Mean: ${result.results.latency.mean.toFixed(2)}`);
    console.log(`  P50: ${result.results.latency.p50.toFixed(2)}`);
    console.log(`  P90: ${result.results.latency.p90.toFixed(2)}`);
    console.log(`  P95: ${result.results.latency.p95.toFixed(2)}`);
    console.log(`  P99: ${result.results.latency.p99.toFixed(2)}`);
    console.log(`  Max: ${result.results.latency.max.toFixed(2)}`);
    console.log('\n--- Throughput (req/s) ---');
    console.log(`  Mean: ${result.results.throughput.mean.toFixed(2)}`);
    console.log(`  Max: ${result.results.throughput.max.toFixed(2)}`);
    console.log('\n--- Requests ---');
    console.log(`  Total: ${result.results.requests.total}`);
    console.log(`  Mean/sec: ${result.results.requests.mean.toFixed(2)}`);
    console.log('\n--- Errors ---');
    console.log(`  Errors: ${result.results.errors}`);
    console.log(`  Timeouts: ${result.results.timeouts}`);
    console.log(`  Non-2xx: ${result.results.non2xx}`);

    if (result.syncTests) {
      console.log('\n--- Sync Operations ---');
      for (const sync of result.syncTests) {
        console.log(`  ${sync.operation}: ${sync.success ? '✅' : '❌'} (${sync.duration.toFixed(2)}ms)${sync.error ? ` - ${sync.error}` : ''}`);
      }
    }

    // Exit with error code if thresholds exceeded
    const thresholds = {
      maxLatencyP95: 500, // ms
      maxErrorRate: 0.01, // 1%
      minThroughput: 100, // req/s
    };

    const errorRate = (result.results.errors + result.results.non2xx) / result.results.requests.total;
    const failed = [];

    if (result.results.latency.p95 > thresholds.maxLatencyP95) {
      failed.push(`P95 latency ${result.results.latency.p95.toFixed(2)}ms exceeds ${thresholds.maxLatencyP95}ms`);
    }
    if (errorRate > thresholds.maxErrorRate) {
      failed.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds ${(thresholds.maxErrorRate * 100).toFixed(2)}%`);
    }
    if (result.results.throughput.mean < thresholds.minThroughput) {
      failed.push(`Throughput ${result.results.throughput.mean.toFixed(2)} req/s below ${thresholds.minThroughput} req/s`);
    }

    if (failed.length > 0) {
      console.log('\n❌ THRESHOLDS EXCEEDED:');
      failed.forEach(f => console.log(`  - ${f}`));
      process.exit(1);
    } else {
      console.log('\n✅ All thresholds passed');
      process.exit(0);
    }
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

main();