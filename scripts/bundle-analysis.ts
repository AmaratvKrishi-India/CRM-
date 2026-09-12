#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync, brotliCompressSync } from 'node:zlib';

export interface BundleInput { fileName: string; type: string; code?: string }

/** Budget the actual, minified, uncompressed JS chunks emitted by production Vite. */
export function measureBundles(outputs: BundleInput[], thresholdKb = 600) {
  if (!Number.isFinite(thresholdKb) || thresholdKb <= 0) throw new Error('Threshold must be a positive number of KiB.');
  const bundles = outputs.filter(item => item.type === 'chunk' && typeof item.code === 'string').map(item => ({
    name: item.fileName,
    size: Buffer.byteLength(item.code!),
    gzipSize: gzipSync(item.code!).byteLength,
    brotliSize: brotliCompressSync(item.code!).byteLength,
  })).sort((a, b) => b.size - a.size);
  if (!bundles.length) throw new Error('No JavaScript chunks were emitted; bundle budget cannot be verified.');
  return {
    bundles,
    summary: {
      totalSize: bundles.reduce((sum, item) => sum + item.size, 0),
      totalGzipSize: bundles.reduce((sum, item) => sum + item.gzipSize, 0),
      totalBrotliSize: bundles.reduce((sum, item) => sum + item.brotliSize, 0),
      chunkCount: bundles.length,
      largestChunk: bundles[0].name,
      warnings: bundles.filter(item => item.size > thresholdKb * 1024)
        .map(item => `${item.name}: ${item.size} bytes exceeds ${thresholdKb} KiB`),
    },
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    output: { type: 'string', short: 'o', default: 'test-results/bundle-analysis' },
    threshold: { type: 'string', default: '600' },
    format: { type: 'string', default: 'html' },
    gzip: { type: 'boolean', default: true },
    brotli: { type: 'boolean', default: true },
  } });
  const threshold = Number(values.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) throw new Error('Threshold must be a positive number of KiB.');
  const formats = ['html', 'json', 'treemap', 'sunburst', 'network'] as const;
  if (!formats.some(format => format === values.format)) throw new Error('Unsupported report format.');
  const template = values.format === 'html' ? 'treemap' : values.format === 'json' ? 'raw-data' : values.format;
  const outputDir = resolve(values.output!);
  mkdirSync(outputDir, { recursive: true });
  const [{ build }, { visualizer }] = await Promise.all([import('vite'), import('rollup-plugin-visualizer')]);
  const result = await build({
    mode: 'production', configFile: 'vite.config.ts',
    plugins: [visualizer({
      filename: join(outputDir, values.format === 'json' ? 'bundle-report.json' : 'bundle-report.html'),
      template: template as 'treemap' | 'sunburst' | 'network' | 'raw-data',
      gzipSize: values.gzip, brotliSize: values.brotli, open: false,
    })],
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => 'output' in item ? item.output : []);
  const analysis = measureBundles(outputs, threshold);
  writeFileSync(join(outputDir, 'bundle-analysis.json'), JSON.stringify({
    timestamp: new Date().toISOString(), config: { thresholdKb: threshold, metric: 'minified JS bytes per chunk' }, ...analysis,
  }, null, 2));
  console.log(JSON.stringify(analysis.summary, null, 2));
  process.exitCode = analysis.summary.warnings.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
