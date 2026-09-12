#!/usr/bin/env tsx
/**
 * Security Dependencies Test Script
 * Runs OSV-Scanner, OWASP dep-scan, auditfix, and supply-chain-guard
 */

import { program } from 'commander';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

program
  .option('-o, --output <dir>', 'Output directory', 'test-results/security')
  .option('--format <type>', 'Output format: json, sarif, text', 'json')
  .option('--fail-on <severity>', 'Fail on severity: low, moderate, high, critical', 'high')
  .option('--osv', 'Run OSV-Scanner', true)
  .option('--dep-scan', 'Run OWASP dep-scan', true)
  .option('--auditfix', 'Run auditfix', true)
  .option('--supply-chain', 'Run supply-chain-guard', true)
  .parse(process.argv);

const options = program.opts();

interface SecurityTestResult {
  timestamp: string;
  tools: {
    osvScanner?: ToolResult;
    depScan?: ToolResult;
    auditfix?: ToolResult;
    supplyChainGuard?: ToolResult;
  };
  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    passed: boolean;
  };
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  vulnerabilities?: Vulnerability[];
}

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  references: string[];
}

function runCommand(command: string, args: string[], cwd: string = process.cwd()): ToolResult {
  const executable = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
  console.log(`Running: ${executable} ${args.join(' ')}`);
  const result = spawnSync(executable, args, { cwd, encoding: 'utf-8', timeout: 300000 });

  return {
    success: result.status === 0,
    output: result.stdout || '',
    error: result.error?.message || result.stderr || undefined,
  };
}

function parseOSVOutput(output: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  try {
    const data = JSON.parse(output);
    for (const result of data.results || []) {
      for (const pkg of result.packages || []) {
        for (const vuln of pkg.vulnerabilities || []) {
          vulns.push({
            id: vuln.id,
            severity: vuln.severity?.toLowerCase() as any || 'moderate',
            package: pkg.package.name,
            version: pkg.package.version,
            fixedVersion: vuln.fixed,
            description: vuln.summary,
            references: vuln.references || [],
          });
        }
      }
    }
  } catch {
    // Parse text output
  }
  return vulns;
}

function parseDepScanOutput(output: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  try {
    const data = JSON.parse(output);
    for (const vuln of data.vulnerabilities || []) {
      vulns.push({
        id: vuln.id,
        severity: vuln.severity?.toLowerCase() as any || 'moderate',
        package: vuln.package,
        version: vuln.version,
        fixedVersion: vuln.fixedVersion,
        description: vuln.description,
        references: vuln.references || [],
      });
    }
  } catch {
    // Parse text output
  }
  return vulns;
}

function parseAuditfixOutput(output: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  try {
    const data = JSON.parse(output);
    for (const vuln of data.vulnerabilities || []) {
      vulns.push({
        id: vuln.id,
        severity: vuln.severity?.toLowerCase() as any || 'moderate',
        package: vuln.name,
        version: vuln.version,
        fixedVersion: vuln.fixedVersion,
        description: vuln.description,
        references: vuln.references || [],
      });
    }
  } catch {
    // Parse text output
  }
  return vulns;
}

function parseSupplyChainOutput(output: string): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  try {
    const data = JSON.parse(output);
    for (const issue of data.issues || []) {
      vulns.push({
        id: issue.id || 'supply-chain-' + Date.now(),
        severity: issue.severity?.toLowerCase() as any || 'high',
        package: issue.package || 'unknown',
        version: issue.version || 'unknown',
        description: issue.description || 'Supply chain issue detected',
        references: issue.references || [],
      });
    }
  } catch {
    // Parse text output
  }
  return vulns;
}

async function main(): Promise<void> {
  const outputDir = options.output;
  mkdirSync(outputDir, { recursive: true });

  const result: SecurityTestResult = {
    timestamp: new Date().toISOString(),
    tools: {},
    summary: {
      totalVulnerabilities: 0,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      passed: true,
    },
  };

  // Run OSV-Scanner
  if (options.osv !== 'false') {
    console.log('\n=== Running OSV-Scanner ===');
    const osvResult = runCommand('npx', ['osv-scanner', 'scan', '--recursive', `--format=${options.format}`, `--output=${join(outputDir, 'osv-scanner.json')}`, '.']);
    result.tools.osvScanner = osvResult;
    if (osvResult.success && osvResult.output) {
      const vulns = parseOSVOutput(osvResult.output);
      osvResult.vulnerabilities = vulns;
      for (const v of vulns) {
        result.summary.totalVulnerabilities++;
        result.summary[v.severity]++;
      }
    }
  }

  // Run OWASP dep-scan
  if (options.depScan !== 'false') {
    console.log('\n=== Running OWASP dep-scan ===');
    const depScanResult = runCommand('npx', ['dep-scan', '--dir', '.', `--format=${options.format}`, `--output=${join(outputDir, 'dep-scan.json')}`]);
    result.tools.depScan = depScanResult;
    if (depScanResult.success && depScanResult.output) {
      const vulns = parseDepScanOutput(depScanResult.output);
      depScanResult.vulnerabilities = vulns;
      for (const v of vulns) {
        result.summary.totalVulnerabilities++;
        result.summary[v.severity]++;
      }
    }
  }

  // Run auditfix
  if (options.auditfix !== 'false') {
    console.log('\n=== Running auditfix ===');
    const auditfixResult = runCommand('npx', ['auditfix', 'audit', `--format=${options.format}`]);
    result.tools.auditfix = auditfixResult;
    if (auditfixResult.success && auditfixResult.output) {
      const vulns = parseAuditfixOutput(auditfixResult.output);
      auditfixResult.vulnerabilities = vulns;
      for (const v of vulns) {
        result.summary.totalVulnerabilities++;
        result.summary[v.severity]++;
      }
    }
  }

  // Run supply-chain-guard
  if (options.supplyChain !== 'false') {
    console.log('\n=== Running supply-chain-guard ===');
    const scgResult = runCommand('npx', ['supply-chain-guard', 'scan', '.', `--format=${options.format}`, `--output=${join(outputDir, 'supply-chain-guard.json')}`]);
    result.tools.supplyChainGuard = scgResult;
    if (scgResult.success && scgResult.output) {
      const vulns = parseSupplyChainOutput(scgResult.output);
      scgResult.vulnerabilities = vulns;
      for (const v of vulns) {
        result.summary.totalVulnerabilities++;
        result.summary[v.severity]++;
      }
    }
  }

  // Determine pass/fail based on severity threshold
  const severityOrder = ['low', 'moderate', 'high', 'critical'];
  const failThreshold = severityOrder.indexOf(options.failOn);
  let shouldFail = false;

  for (let i = failThreshold; i < severityOrder.length; i++) {
    if (result.summary[severityOrder[i] as keyof typeof result.summary] > 0) {
      shouldFail = true;
      break;
    }
  }

  const failedTools = Object.entries(result.tools)
    .filter(([, tool]) => !tool?.success)
    .map(([name]) => name);
  result.summary.passed = !shouldFail && failedTools.length === 0;

  // Write consolidated results
  const outputFile = join(outputDir, 'security-test-results.json');
  writeFileSync(outputFile, JSON.stringify(result, null, 2));

  // Print summary
  console.log('\n=== SECURITY TEST SUMMARY ===');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Total Vulnerabilities: ${result.summary.totalVulnerabilities}`);
  console.log(`  Critical: ${result.summary.critical}`);
  console.log(`  High: ${result.summary.high}`);
  console.log(`  Moderate: ${result.summary.moderate}`);
  console.log(`  Low: ${result.summary.low}`);
  if (failedTools.length > 0) {
    console.log(`  Tool failures: ${failedTools.join(', ')}`);
  }
  console.log(`\nOverall: ${result.summary.passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!result.summary.passed) {
    console.log(`\nFailed due to ${options.failOn}+ severity vulnerabilities`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
