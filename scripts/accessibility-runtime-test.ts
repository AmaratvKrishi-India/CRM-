#!/usr/bin/env tsx
/**
 * Runtime Accessibility Test Script
 * Uses @accesslint/core with happy-dom for zero-browser accessibility testing
 * WCAG 2.2 A/AA compliance
 */

import { AccessLint } from '@accesslint/core';
import { JSDOM } from 'jsdom';
import { program } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

program
  .option('-u, --url <url>', 'URL to test', 'http://localhost:3000')
  .option('-r, --routes <routes>', 'Comma-separated routes to test', '/login,/leads,/calls,/settings,/admin')
  .option('-s, --standard <level>', 'WCAG level: A, AA, AAA', 'AA')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/a11y-runtime.json')
  .option('--format <type>', 'Output format: json, sarif, html', 'json')
  .parse(process.argv);

const options = program.opts();

interface A11yRuntimeResult {
  timestamp: string;
  config: {
    url: string;
    routes: string[];
    standard: string;
  };
  results: RouteResult[];
  summary: {
    totalViolations: number;
    violationsByLevel: { A: number; AA: number; AAA: number };
    violationsByRule: Record<string, number>;
    passed: boolean;
  };
}

interface RouteResult {
  route: string;
  url: string;
  violations: Violation[];
  passes: number;
  incomplete: number;
}

interface Violation {
  ruleId: string;
  ruleDescription: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  level: 'A' | 'AA' | 'AAA';
  nodes: NodeResult[];
  help: string;
  helpUrl: string;
}

interface NodeResult {
  html: string;
  target: string[];
  xpath: string;
  failureSummary: string;
}

async function testRoute(accesslint: AccessLint, baseUrl: string, route: string): Promise<RouteResult> {
  const fullUrl = `${baseUrl}${route}`;

  try {
    // Fetch page HTML
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();

    // Create JSDOM for happy-dom simulation
    const dom = new JSDOM(html, {
      url: fullUrl,
      pretendToBeVisual: true,
      resources: 'usable',
      runScripts: 'outside-only',
    });

    // Run accesslint
    const results = await accesslint.lint(dom.window.document);

    const violations: Violation[] = results.violations.map(v => ({
      ruleId: v.ruleId,
      ruleDescription: v.ruleDescription,
      impact: v.impact,
      level: getWCAGLevel(v.ruleId),
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target,
        xpath: n.xpath,
        failureSummary: n.failureSummary,
      })),
      help: v.help,
      helpUrl: v.helpUrl,
    }));

    return {
      route,
      url: fullUrl,
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    };
  } catch (error) {
    return {
      route,
      url: fullUrl,
      violations: [{
        ruleId: 'fetch-error',
        ruleDescription: 'Failed to fetch page',
        impact: 'critical',
        level: 'A',
        nodes: [{
          html: '',
          target: [],
          xpath: '',
          failureSummary: error instanceof Error ? error.message : String(error),
        }],
        help: 'Ensure the server is running and accessible',
        helpUrl: '',
      }],
      passes: 0,
      incomplete: 0,
    };
  }
}

function getWCAGLevel(ruleId: string): 'A' | 'AA' | 'AAA' {
  // Map common rule IDs to WCAG levels
  const aaRules = [
    'color-contrast',
    'keyboard-focus-indicator',
    'focus-order',
    'headings-order',
    'label',
    'link-name',
    'button-name',
    'image-alt',
    'form-field-multiple-labels',
    'aria-required-attr',
    'aria-valid-attr-value',
  ];

  const aaaRules = [
    'enhanced-contrast',
    'text-spacing',
    'content-on-hover-focus',
  ];

  if (aaaRules.some(r => ruleId.includes(r))) return 'AAA';
  if (aaRules.some(r => ruleId.includes(r))) return 'AA';
  return 'A';
}

async function main(): Promise<void> {
  const routes = options.routes.split(',').map((r: string) => r.trim());
  const standard = options.standard.toUpperCase() as 'A' | 'AA' | 'AAA';

  console.log(`Starting runtime accessibility test for ${routes.length} routes`);
  console.log(`WCAG Standard: ${standard}`);
  console.log(`Base URL: ${options.url}`);

  // Initialize accesslint with WCAG rules
  const accesslint = new AccessLint({
    rules: {
      // Enable all WCAG 2.2 rules
      'wcag2a': true,
      'wcag2aa': standard === 'AA' || standard === 'AAA',
      'wcag2aaa': standard === 'AAA',
      // Best practices
      'best-practice': true,
      // Section 508
      'section508': true,
    },
    // Custom configuration
    ignore: [
      // Ignore rules that are not applicable or have false positives
    ],
  });

  const results: RouteResult[] = [];

  for (const route of routes) {
    console.log(`\nTesting ${route}...`);
    const result = await testRoute(accesslint, options.url, route);
    results.push(result);

    console.log(`  Violations: ${result.violations.length}`);
    console.log(`  Passes: ${result.passes}`);
    console.log(`  Incomplete: ${result.incomplete}`);

    // Print violations by impact
    const byImpact = result.violations.reduce((acc, v) => {
      acc[v.impact] = (acc[v.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`  By impact: ${JSON.stringify(byImpact)}`);
  }

  // Calculate summary
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const violationsByLevel = results.flatMap(r => r.violations).reduce((acc, v) => {
    acc[v.level] = (acc[v.level] || 0) + 1;
    return acc;
  }, { A: 0, AA: 0, AAA: 0 });

  const violationsByRule = results.flatMap(r => r.violations).reduce((acc, v) => {
    acc[v.ruleId] = (acc[v.ruleId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Determine pass/fail based on standard
  const criticalViolations = results.flatMap(r => r.violations).filter(v => v.impact === 'critical').length;
  const seriousViolations = results.flatMap(r => r.violations).filter(v => v.impact === 'serious').length;

  let passed = true;
  if (standard === 'A') {
    passed = criticalViolations === 0;
  } else if (standard === 'AA') {
    passed = criticalViolations === 0 && seriousViolations === 0;
  } else {
    passed = totalViolations === 0;
  }

  const output: A11yRuntimeResult = {
    timestamp: new Date().toISOString(),
    config: {
      url: options.url,
      routes,
      standard,
    },
    results,
    summary: {
      totalViolations,
      violationsByLevel,
      violationsByRule,
      passed,
    },
  };

  // Write results
  mkdirSync('test-results', { recursive: true });
  writeFileSync(options.output, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n=== RUNTIME ACCESSIBILITY TEST RESULTS ===');
  console.log(`Standard: WCAG 2.2 ${standard}`);
  console.log(`Routes tested: ${routes.length}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`  Level A: ${violationsByLevel.A}`);
  console.log(`  Level AA: ${violationsByLevel.AA}`);
  console.log(`  Level AAA: ${violationsByLevel.AAA}`);
  console.log(`\nBy Impact:`);
  console.log(`  Critical: ${criticalViolations}`);
  console.log(`  Serious: ${seriousViolations}`);
  console.log(`  Moderate: ${results.flatMap(r => r.violations).filter(v => v.impact === 'moderate').length}`);
  console.log(`  Minor: ${results.flatMap(r => r.violations).filter(v => v.impact === 'minor').length}`);
  console.log(`\nTop Violations:`);
  Object.entries(violationsByRule)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([rule, count]) => console.log(`  ${rule}: ${count}`));
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passed) {
    process.exit(1);
  }
}

main().catch(console.error);