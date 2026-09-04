#!/usr/bin/env tsx
/**
 * Static Accessibility Test Script
 * Uses a11y-check (AST-based analyzer) for compile-time WCAG 2.1 Level A detection
 * No browser required - analyzes JSX/TSX source directly
 */

import { checkAccessibility } from 'a11y-check';
import { program } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

program
  .option('-p, --pattern <glob>', 'File pattern to analyze', 'src/**/*.tsx')
  .option('-l, --level <level>', 'WCAG level: A, AA', 'A')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/a11y-static.json')
  .option('--format <type>', 'Output format: json, text', 'json')
  .option('--ignore <patterns>', 'Comma-separated ignore patterns', '')
  .parse(process.argv);

const options = program.opts();

interface A11yStaticResult {
  timestamp: string;
  config: {
    pattern: string;
    level: string;
    ignorePatterns: string[];
  };
  results: FileResult[];
  summary: {
    filesAnalyzed: number;
    totalViolations: number;
    violationsByRule: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    passed: boolean;
  };
}

interface FileResult {
  file: string;
  violations: StaticViolation[];
}

interface StaticViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
  code: string;
  wcagLevel: 'A' | 'AA';
  wcagCriterion: string;
}

async function main(): Promise<void> {
  const pattern = options.pattern;
  const level = options.level.toUpperCase() as 'A' | 'AA';
  const ignorePatterns = options.ignore ? options.ignore.split(',').map((p: string) => p.trim()) : [];

  console.log(`Starting static accessibility analysis`);
  console.log(`Pattern: ${pattern}`);
  console.log(`WCAG Level: ${level}`);

  // Find all matching files
  const files = await glob(pattern, { ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'] });

  console.log(`Found ${files.length} files to analyze`);

  const results: FileResult[] = [];

  for (const file of files) {
    try {
      const violations = await checkAccessibility(file, {
        level: level === 'AA' ? 'AA' : 'A',
        ignorePatterns,
      });

      results.push({
        file,
        violations: violations.map(v => ({
          ruleId: v.ruleId,
          message: v.message,
          severity: v.severity,
          line: v.line,
          column: v.column,
          code: v.code,
          wcagLevel: v.wcagLevel || 'A',
          wcagCriterion: v.wcagCriterion || '',
        })),
      });
    } catch (error) {
      console.warn(`Failed to analyze ${file}:`, error);
      results.push({
        file,
        violations: [{
          ruleId: 'analysis-error',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
          line: 0,
          column: 0,
          code: '',
          wcagLevel: 'A',
          wcagCriterion: '',
        }],
      });
    }
  }

  // Calculate summary
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const violationsByRule = results.flatMap(r => r.violations).reduce((acc, v) => {
    acc[v.ruleId] = (acc[v.ruleId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const violationsBySeverity = results.flatMap(r => r.violations).reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Pass/fail: no errors for Level A, no errors/warnings for Level AA
  const errorCount = violationsBySeverity.error || 0;
  const warningCount = violationsBySeverity.warning || 0;
  const passed = level === 'A' ? errorCount === 0 : (errorCount === 0 && warningCount === 0);

  const output: A11yStaticResult = {
    timestamp: new Date().toISOString(),
    config: {
      pattern,
      level,
      ignorePatterns,
    },
    results,
    summary: {
      filesAnalyzed: files.length,
      totalViolations,
      violationsByRule,
      violationsBySeverity,
      passed,
    },
  };

  // Write results
  mkdirSync('test-results', { recursive: true });
  writeFileSync(options.output, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n=== STATIC ACCESSIBILITY TEST RESULTS ===');
  console.log(`Files analyzed: ${files.length}`);
  console.log(`WCAG Level: ${level}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Warnings: ${warningCount}`);
  console.log(`  Info: ${violationsBySeverity.info || 0}`);
  console.log(`\nTop Violations:`);
  Object.entries(violationsByRule)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 15)
    .forEach(([rule, count]) => console.log(`  ${rule}: ${count}`));
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passed) {
    process.exit(1);
  }
}

main().catch(console.error);