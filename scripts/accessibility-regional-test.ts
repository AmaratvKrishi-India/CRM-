#!/usr/bin/env tsx
/**
 * Regional Compliance Accessibility Test Script
 *
 * The original version called an npm package named a11y-guard, which is not
 * published and cannot be resolved. This implementation keeps the regional
 * reporting contract but uses the project-local axe engine against a local
 * app URL. The region labels classify the applicable standards; axe findings
 * are WCAG evidence and are not legal certification for any jurisdiction.
 */

import { program } from 'commander';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

program
  .option('-p, --pattern <glob>', 'Source pattern recorded with the audit', 'src/**/*.tsx')
  .option('-r, --regions <regions>', 'Comma-separated regions: US,EU,CA,UK,AU,DE,FR,BR,JP,IL', 'US,EU')
  .option('-o, --output <dir>', 'Output directory', 'test-results/a11y-regional')
  .option('--url <url>', 'Local URL to scan', process.env.REGIONAL_A11Y_URL || 'http://127.0.0.1:4174/')
  .option('--format <type>', 'Output format: sarif, json', 'sarif')
  .parse(process.argv);

const options = program.opts();

interface RegionalA11yResult {
  timestamp: string;
  config: {
    pattern: string;
    regions: string[];
    url: string;
  };
  results: RegionResult[];
  summary: {
    totalFiles: number;
    totalViolations: number;
    violationsByRegion: Record<string, number>;
    violationsByStandard: Record<string, number>;
    passed: boolean;
  };
}

interface RegionResult {
  region: string;
  standard: string;
  violations: RegionalViolation[];
  filesAnalyzed: number;
}

interface RegionalViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column: number;
  standard: string;
  criterion: string;
}

const REGION_STANDARDS: Record<string, string[]> = {
  US: ['ADA', 'Section508'],
  EU: ['EAA', 'EN301549'],
  CA: ['ACA', 'AODA'],
  UK: ['EqualityAct', 'BS8878'],
  AU: ['DDA', 'AS EN 301 549'],
  DE: ['BGG', 'BITV'],
  FR: ['RGAA'],
  BR: ['LBI', 'Decree5296'],
  JP: ['JIS X 8341-3'],
  IL: ['IS 5568'],
};

function severityForImpact(impact: string | null | undefined): RegionalViolation['severity'] {
  if (impact === 'critical' || impact === 'serious') return 'error';
  if (impact === 'moderate') return 'warning';
  return 'info';
}

function executionErrorViolation(region: string, standards: string[], error: unknown): RegionalViolation {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ruleId: 'execution-error',
    message: 'Failed to run local axe scan for ' + region + ': ' + message,
    severity: 'error',
    file: '',
    line: 0,
    column: 0,
    standard: standards.join(', '),
    criterion: '',
  };
}

function writeSarif(outputFile: string, url: string, violations: RegionalViolation[]): void {
  const results = violations.map((violation) => ({
    ruleId: violation.ruleId,
    level: violation.severity === 'error' ? 'error' : violation.severity === 'warning' ? 'warning' : 'note',
    message: { text: violation.message },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: violation.file || url },
        region: { startLine: violation.line || 1, startColumn: violation.column || 1 },
      },
    }],
  }));

  writeFileSync(outputFile, JSON.stringify({
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: '@axe-core/playwright',
          informationUri: 'https://github.com/dequelabs/axe-core-npm',
        },
      },
      results,
    }],
  }, null, 2));
}

async function runRegionalAxe(
  browser: Browser,
  region: string,
  url: string,
  outputDir: string,
): Promise<RegionalViolation[]> {
  const standards = REGION_STANDARDS[region] || ['WCAG21AA'];
  const outputFile = join(outputDir, 'a11y-guard-' + region.toLowerCase() + '.sarif');
  const locale = region === 'US'
    ? 'en-US'
    : region === 'UK'
      ? 'en-GB'
      : region === 'CA'
        ? 'en-CA'
        : 'en';
  const context = await browser.newContext({ locale });
  const page = await context.newPage();

  try {
    console.log('Running local axe scan for ' + region + ' (' + standards.join(', ') + ')');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(350);
    const axeResult = await new AxeBuilder({ page }).analyze();
    const violations = axeResult.violations.flatMap((violation) => violation.nodes.map((node) => ({
      ruleId: violation.id,
      message: violation.help + ': ' + (node.failureSummary || violation.description),
      severity: severityForImpact(violation.impact),
      file: url,
      line: 0,
      column: 0,
      standard: standards.join(', '),
      criterion: violation.id,
    })));
    writeSarif(outputFile, url, violations);
    return violations;
  } catch (error) {
    const violation = executionErrorViolation(region, standards, error);
    writeSarif(outputFile, url, [violation]);
    console.warn(violation.message);
    return [violation];
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const pattern = options.pattern;
  const regions = options.regions.split(',').map((region: string) => region.trim().toUpperCase());
  const url = options.url;
  const invalidRegions = regions.filter((region: string) => !Object.prototype.hasOwnProperty.call(REGION_STANDARDS, region));
  if (invalidRegions.length > 0) {
    throw new Error('Unsupported accessibility region(s): ' + invalidRegions.join(', '));
  }

  const outputDir = options.output;
  mkdirSync(outputDir, { recursive: true });

  console.log('Starting regional accessibility compliance test');
  console.log('Pattern: ' + pattern);
  console.log('Regions: ' + regions.join(', '));
  console.log('URL: ' + url);

  const results: RegionResult[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const region of regions) {
      const standards = REGION_STANDARDS[region].join(', ');
      console.log('\nTesting region: ' + region + ' (' + standards + ')');
      const violations = await runRegionalAxe(browser, region, url, outputDir);
      const files = new Set(violations.map((violation) => violation.file).filter(Boolean));
      const executionFailed = violations.some((violation) => violation.ruleId === 'execution-error');
      const filesAnalyzed = executionFailed ? 0 : Math.max(files.size, 1);

      results.push({
        region,
        standard: standards,
        violations,
        filesAnalyzed,
      });

      console.log('  Files analyzed: ' + filesAnalyzed);
      console.log('  Violations: ' + violations.length);
    }
  } finally {
    await browser.close();
  }

  const totalFiles = results.reduce((sum, result) => sum + result.filesAnalyzed, 0);
  const totalViolations = results.reduce((sum, result) => sum + result.violations.length, 0);
  const violationsByRegion = results.reduce((acc, result) => {
    acc[result.region] = result.violations.length;
    return acc;
  }, {} as Record<string, number>);
  const violationsByStandard = results.flatMap((result) => result.violations).reduce((acc, violation) => {
    violation.standard.split(', ').forEach((standard) => {
      acc[standard] = (acc[standard] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  const errorCount = results.flatMap((result) => result.violations).filter((violation) => violation.severity === 'error').length;
  const warningCount = results.flatMap((result) => result.violations).filter((violation) => violation.severity === 'warning').length;
  const passed = errorCount === 0;

  const output: RegionalA11yResult = {
    timestamp: new Date().toISOString(),
    config: { pattern, regions, url },
    results,
    summary: {
      totalFiles,
      totalViolations,
      violationsByRegion,
      violationsByStandard,
      passed,
    },
  };

  writeFileSync(join(outputDir, 'a11y-regional-combined.json'), JSON.stringify(output, null, 2));
  console.log('\n=== REGIONAL ACCESSIBILITY COMPLIANCE RESULTS ===');
  console.log('Regions tested: ' + regions.join(', '));
  console.log('Files analyzed: ' + totalFiles);
  console.log('Total violations: ' + totalViolations);
  console.log('  Errors: ' + errorCount);
  console.log('  Warnings: ' + warningCount);
  console.log('Overall: ' + (passed ? 'PASSED' : 'FAILED'));

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
