#!/usr/bin/env tsx
/**
 * Test Report Generator
 * Aggregates all test results into a unified HTML report
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  coverage?: {
    lines: { pct: number; total: number; covered: number };
    functions: { pct: number; total: number; covered: number };
    branches: { pct: number; total: number; covered: number };
    statements: { pct: number; total: number; covered: number };
  };
  error?: string;
}

interface UnifiedReport {
  timestamp: string;
  git: { branch: string; commit: string; author: string };
  suites: TestResult[];
  summary: { total: number; passed: number; failed: number; skipped: number; duration: number };
  qualityGate: { passed: boolean; failures: string[] };
}

function parseJUnitXml(xmlPath: string): TestResult[] {
  if (!existsSync(xmlPath)) return [];

  const xml = readFileSync(xmlPath, 'utf8');
  const results: TestResult[] = [];

  // Simple JUnit XML parsing
  const testsuiteRegex = /<testsuite[^>]*name="([^"]*)"[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*time="([^"]*)"[^>]*>/g;
  let match;
  while ((match = testsuiteRegex.exec(xml)) !== null) {
    const [, name, tests, failures, time] = match;
    results.push({
      suite: name,
      passed: parseInt(failures) === 0,
      duration: Math.round(parseFloat(time) * 1000),
    });
  }

  return results;
}

function loadJsonResults(jsonPath: string): TestResult | null {
  if (!existsSync(jsonPath)) return null;

  try {
    return JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function generateHtmlReport(report: UnifiedReport): string {
  const passed = report.summary.passed;
  const failed = report.summary.failed;
  const total = report.summary.total;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  const suiteRows = report.suites.map(suite => `
    <tr class="${suite.passed ? 'passed' : 'failed'}">
      <td>${suite.suite}</td>
      <td class="status">${suite.passed ? '✅ PASSED' : '❌ FAILED'}</td>
      <td>${(suite.duration / 1000).toFixed(1)}s</td>
      <td>${suite.coverage ? `${suite.coverage.lines.pct}%` : 'N/A'}</td>
      <td>${suite.error ? `<span class="error" title="${escapeHtml(suite.error)}">Error</span>` : ''}</td>
    </tr>
  `).join('');

  const qualityGateClass = report.qualityGate.passed ? 'passed' : 'failed';
  const qualityGateText = report.qualityGate.passed ? '✅ PASSED' : '❌ FAILED';
  const failuresList = report.qualityGate.failures.map(f => `<li>${escapeHtml(f)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amaratv Krishi - Test Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header .meta { margin-top: 10px; opacity: 0.9; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; border-bottom: 1px solid #eee; }
    .stat { text-align: center; padding: 20px; border-radius: 8px; }
    .stat.passed { background: #dcfce7; }
    .stat.failed { background: #fee2e2; }
    .stat.skipped { background: #fef3c7; }
    .stat.total { background: #dbeafe; }
    .stat .value { font-size: 36px; font-weight: bold; }
    .stat .value.passed { color: #166534; }
    .stat .value.failed { color: #991b1b; }
    .stat .value.skipped { color: #92400e; }
    .stat .value.total { color: #1e40af; }
    .stat .label { font-size: 14px; color: #666; margin-top: 4px; }
    .quality-gate { padding: 20px 30px; border-bottom: 1px solid #eee; }
    .quality-gate.${qualityGateClass} { background: ${qualityGateClass === 'passed' ? '#dcfce7' : '#fee2e2'}; }
    .quality-gate h2 { margin: 0 0 10px; color: ${qualityGateClass === 'passed' ? '#166534' : '#991b1b'}; }
    .quality-gate .status { font-size: 18px; font-weight: bold; }
    .quality-gate .failures { margin-top: 10px; }
    .quality-gate .failures ul { margin: 0; padding-left: 20px; }
    .suites-table { padding: 30px; }
    .suites-table h2 { margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr.passed td { background: #f0fdf4; }
    tr.failed td { background: #fef2f2; }
    .status { font-weight: 600; }
    .status.passed { color: #166534; }
    .status.failed { color: #991b1b; }
    .error { color: #dc2626; font-size: 12px; cursor: help; }
    .footer { padding: 20px 30px; background: #f9fafb; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    @media (max-width: 768px) {
      .summary { grid-template-columns: 1fr 1fr; }
      table { font-size: 14px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Amaratv Krishi Test Report</h1>
      <div class="meta">
        <strong>Branch:</strong> ${report.git.branch} |
        <strong>Commit:</strong> ${report.git.commit.slice(0, 8)} |
        <strong>Author:</strong> ${report.git.author} |
        <strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}
      </div>
    </div>

    <div class="summary">
      <div class="stat total">
        <div class="value total">${total}</div>
        <div class="label">Total Suites</div>
      </div>
      <div class="stat passed">
        <div class="value passed">${passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="stat failed">
        <div class="value failed">${failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="stat skipped">
        <div class="value skipped">${report.summary.skipped}</div>
        <div class="label">Skipped</div>
      </div>
      <div class="stat total">
        <div class="value total">${passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
      <div class="stat total">
        <div class="value total">${(report.summary.duration / 1000).toFixed(1)}s</div>
        <div class="label">Duration</div>
      </div>
    </div>

    <div class="quality-gate ${qualityGateClass}">
      <h2>🔍 Quality Gate: <span class="status">${qualityGateText}</span></h2>
      ${!report.qualityGate.passed ? `
        <div class="failures">
          <strong>Failures:</strong>
          <ul>${failuresList}</ul>
        </div>
      ` : ''}
    </div>

    <div class="suites-table">
      <h2>📋 Test Suites</h2>
      <table>
        <thead>
          <tr>
            <th>Suite</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Coverage</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${suiteRows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by Unified Test Runner · Amaratv Krishi Sales CRM v2.0.0
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

async function main(): Promise<void> {
  const reportPath = 'test-results/unified-report.json';
  const outputPath = 'test-results/report.html';

  if (!existsSync(reportPath)) {
    console.error('❌ Unified report not found. Run tests first.');
    process.exit(1);
  }

  const report: UnifiedReport = JSON.parse(readFileSync(reportPath, 'utf8'));

  // Enrich with additional results
  const additionalResults: TestResult[] = [];

  // Load JUnit results (E2E, Visual)
  const junitFiles = ['test-results/e2e.xml', 'test-results/visual.xml'];
  for (const file of junitFiles) {
    additionalResults.push(...parseJUnitXml(file));
  }

  // Load JSON results
  const jsonFiles = readdirSync('test-results', { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.json') && d.name !== 'unified-report.json')
    .map(d => join('test-results', d.name));

  for (const file of jsonFiles) {
    const result = loadJsonResults(file);
    if (result && !report.suites.some(s => s.suite === result.suite)) {
      additionalResults.push(result);
    }
  }

  // Merge additional results
  report.suites.push(...additionalResults);
  report.summary.total = report.suites.length;
  report.summary.passed = report.suites.filter(s => s.passed).length;
  report.summary.failed = report.suites.filter(s => !s.passed).length;

  // Generate HTML
  const html = generateHtmlReport(report);
  writeFileSync(outputPath, html);

  console.log(`✅ HTML report generated: ${outputPath}`);
  console.log(`📊 Total suites: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed}`);
}

main().catch(console.error);