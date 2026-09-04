#!/usr/bin/env tsx
/**
 * Regional Compliance Accessibility Test Script
 * Uses a11y-guard for region-aware WCAG compliance (ADA, EAA, Section 508, AODA, etc.)
 * Generates SARIF output for CI integration
 */

import { program } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

program
  .option('-p, --pattern <glob>', 'File pattern to analyze', 'src/**/*.tsx')
  .option('-r, --regions <regions>', 'Comma-separated regions: US,EU,CA,UK,AU,DE,FR,BR,JP,IL', 'US,EU')
  .option('-o, --output <dir>', 'Output directory', 'test-results/a11y-regional')
  .option('--format <type>', 'Output format: sarif, json', 'sarif')
  .parse(process.argv);

const options = program.opts();

interface RegionalA11yResult {
  timestamp: string;
  config: {
    pattern: string;
    regions: string[];
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
  'US': ['ADA', 'Section508'],
  'EU': ['EAA', 'EN301549'],
  'CA': ['ACA', 'AODA'],
  'UK': ['EqualityAct', 'BS8878'],
  'AU': ['DDA', 'AS EN 301 549'],
  'DE': ['BGG', 'BITV'],
  'FR': ['RGAA'],
  'BR': ['LBI', 'Decree5296'],
  'JP': ['JIS X 8341-3'],
  'IL': ['IS 5568'],
};

async function runA11yGuard(region: string, pattern: string, outputDir: string): Promise<RegionalViolation[]> {
  const standards = REGION_STANDARDS[region] || ['WCAG21AA'];
  const standardArg = standards.join(',');

  try {
    const outputFile = join(outputDir, `a11y-guard-${region.toLowerCase()}.sarif`);
    
    // Run a11y-guard CLI
    const cmd = `npx a11y-guard scan "${pattern}" --region=${region} --standard=${standardArg} --format=sarif --output=${outputFile}`;
    
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });

    // Parse SARIF output
    const sarifContent = require('fs').readFileSync(outputFile, 'utf-8');
    const sarif = JSON.parse(sarifContent);

    const violations: RegionalViolation[] = [];
    
    if (sarif.runs && sarif.runs[0] && sarif.runs[0].results) {
      for (const result of sarif.runs[0].results) {
        const locations = result.locations || [];
        for (const location of locations) {
          const physicalLocation = location.physicalLocation;
          if (physicalLocation) {
            violations.push({
              ruleId: result.ruleId || 'unknown',
              message: result.message?.text || 'Unknown violation',
              severity: result.level === 'error' ? 'error' : result.level === 'warning' ? 'warning' : 'info',
              file: physicalLocation.artifactLocation?.uri || 'unknown',
              line: physicalLocation.region?.startLine || 0,
              column: physicalLocation.region?.startColumn || 0,
              standard: standards.join(', '),
              criterion: result.ruleId || '',
            });
          }
        }
      }
    }

    return violations;
  } catch (error) {
    console.warn(`a11y-guard failed for region ${region}:`, error instanceof Error ? error.message : String(error));
    return [{
      ruleId: 'execution-error',
      message: `Failed to run a11y-guard for ${region}: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'error',
      file: '',
      line: 0,
      column: 0,
      standard: standards.join(', '),
      criterion: '',
    }];
  }
}

async function main(): Promise<void> {
  const pattern = options.pattern;
  const regions = options.regions.split(',').map((r: string) => r.trim().toUpperCase());
  const outputDir = options.output;

  console.log(`Starting regional accessibility compliance test`);
  console.log(`Pattern: ${pattern}`);
  console.log(`Regions: ${regions.join(', ')}`);

  mkdirSync(outputDir, { recursive: true });

  const results: RegionResult[] = [];

  for (const region of regions) {
    console.log(`\nTesting region: ${region} (${REGION_STANDARDS[region]?.join(', ') || 'WCAG21AA'})`);
    
    const violations = await runA11yGuard(region, pattern, outputDir);
    
    // Count unique files
    const files = new Set(violations.map(v => v.file).filter(f => f));
    
    results.push({
      region,
      standard: REGION_STANDARDS[region]?.join(', ') || 'WCAG21AA',
      violations,
      filesAnalyzed: files.size,
    });

    console.log(`  Files analyzed: ${files.size}`);
    console.log(`  Violations: ${violations.length}`);
    
    const bySeverity = violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`  By severity: ${JSON.stringify(bySeverity)}`);
  }

  // Calculate summary
  const totalFiles = new Set(results.flatMap(r => r.violations.map(v => v.file).filter(f => f))).size;
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  
  const violationsByRegion = results.reduce((acc, r) => {
    acc[r.region] = r.violations.length;
    return acc;
  }, {} as Record<string, number>);

  const violationsByStandard = results.flatMap(r => r.violations).reduce((acc, v) => {
    const standards = v.standard.split(', ').map(s => s.trim());
    standards.forEach(s => {
      acc[s] = (acc[s] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const errorCount = results.flatMap(r => r.violations).filter(v => v.severity === 'error').length;
  const warningCount = results.flatMap(r => r.violations).filter(v => v.severity === 'warning').length;
  
  // Pass if no errors across all regions
  const passed = errorCount === 0;

  const output: RegionalA11yResult = {
    timestamp: new Date().toISOString(),
    config: {
      pattern,
      regions,
    },
    results,
    summary: {
      totalFiles,
      totalViolations,
      violationsByRegion,
      violationsByStandard,
      passed,
    },
  };

  // Write combined results
  const combinedOutputFile = join(outputDir, 'a11y-regional-combined.json');
  writeFileSync(combinedOutputFile, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n=== REGIONAL ACCESSIBILITY COMPLIANCE RESULTS ===');
  console.log(`Regions tested: ${regions.join(', ')}`);
  console.log(`Files analyzed: ${totalFiles}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Warnings: ${warningCount}`);
  console.log(`\nBy Region:`);
  Object.entries(violationsByRegion).forEach(([region, count]) => {
    console.log(`  ${region}: ${count}`);
  });
  console.log(`\nBy Standard:`);
  Object.entries(violationsByStandard).forEach(([standard, count]) => {
    console.log(`  ${standard}: ${count}`);
  });
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passed) {
    process.exit(1);
  }
}

main().catch(console.error);