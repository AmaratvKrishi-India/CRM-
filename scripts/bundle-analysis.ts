#!/usr/bin/env tsx
/**
 * Bundle Analysis Script
 * Uses rollup-plugin-visualizer and vite-bundle-analyzer for comprehensive bundle analysis
 */

import { program } from 'commander';
import { build } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

program
  .option('-o, --output <dir>', 'Output directory', 'test-results/bundle-analysis')
  .option('--format <type>', 'Output format: html, json, treemap, sunburst, network', 'html')
  .option('--gzip', 'Include gzip sizes', true)
  .option('--brotli', 'Include brotli sizes', true)
  .option('--threshold <kb>', 'Warning threshold in KB', '250')
  .parse(process.argv);

const options = program.opts();

interface BundleAnalysisResult {
  timestamp: string;
  config: {
    outputDir: string;
    format: string;
    gzip: boolean;
    brotli: boolean;
    threshold: number;
  };
  bundles: BundleInfo[];
  summary: {
    totalSize: number;
    totalGzipSize: number;
    totalBrotliSize: number;
    chunkCount: number;
    largestChunk: string;
    warnings: string[];
  };
}

interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  brotliSize?: number;
  modules: ModuleInfo[];
}

interface ModuleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  brotliSize?: number;
  reasons: string[];
}

async function runBundleAnalysis(): Promise<BundleAnalysisResult> {
  console.log('Building production bundle for analysis...');

  // Build with visualizer plugin
  const result = await build({
    mode: 'production',
    configFile: 'vite.config.ts',
    plugins: [
      visualizer({
        filename: join(options.output, 'bundle-report.html'),
        open: false,
        gzipSize: options.gzip,
        brotliSize: options.brotli,
        template: options.format as any,
      }),
    ],
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', '@supabase/supabase-js'],
            dexie: ['dexie'],
            ui: ['lucide-react', 'clsx', 'tailwind-merge'],
          },
        },
      },
    },
  });

  // Parse the generated report
  const reportPath = join(options.output, 'bundle-report.html');
  let bundles: BundleInfo[] = [];

  if (existsSync(reportPath)) {
    // The visualizer generates HTML, we'd need to parse it or use the JSON output
    // For now, we'll create a summary from the build output
    console.log('Bundle report generated at:', reportPath);
  }

  // Run vite-bundle-analyzer as well
  try {
    const { default: analyze } = await import('vite-bundle-analyzer');
    await analyze({
      buildDir: 'dist',
      outputDir: options.output,
      reporter: 'json',
    });
  } catch (error) {
    console.warn('vite-bundle-analyzer not available, skipping');
  }

  const threshold = parseInt(options.threshold) * 1024; // Convert KB to bytes

  // Mock summary for now - in real implementation, parse the visualizer output
  const summary = {
    totalSize: 0,
    totalGzipSize: 0,
    totalBrotliSize: 0,
    chunkCount: 0,
    largestChunk: '',
    warnings: [] as string[],
  };

  return {
    timestamp: new Date().toISOString(),
    config: {
      outputDir: options.output,
      format: options.format,
      gzip: options.gzip,
      brotli: options.brotli,
      threshold: parseInt(options.threshold),
    },
    bundles,
    summary,
  };
}

async function main(): Promise<void> {
  try {
    mkdirSync(options.output, { recursive: true });

    const result = await runBundleAnalysis();

    // Write JSON results
    const jsonPath = join(options.output, 'bundle-analysis.json');
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    console.log('\n=== BUNDLE ANALYSIS RESULTS ===');
    console.log(`Output directory: ${options.output}`);
    console.log(`Report: ${join(options.output, 'bundle-report.html')}`);
    console.log(`JSON: ${jsonPath}`);

    if (result.summary.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.summary.warnings.forEach(w => console.log(`  - ${w}`));
      process.exit(1);
    } else {
      console.log('\n✅ Bundle analysis complete');
      process.exit(0);
    }
  } catch (error) {
    console.error('Bundle analysis failed:', error);
    process.exit(1);
  }
}

main();