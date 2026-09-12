import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('App Font & Typography Constraints (Phase 3)', () => {
  const rootDir = process.cwd();

  it('tailwind.config.js configures Inter as primary sans font', () => {
    const tailwindPath = path.join(rootDir, 'tailwind.config.js');
    const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');

    assert.ok(
      tailwindContent.includes('"Inter"') || tailwindContent.includes("'Inter'"),
      'tailwind.config.js must include Inter font'
    );
    assert.ok(
      !tailwindContent.includes('Roboto') && !tailwindContent.includes('Arial'),
      'tailwind.config.js should not default to system fonts like Arial or Roboto'
    );
  });

  it('index.html does not import external Google Fonts (100% offline-first)', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(
      !htmlContent.includes('fonts.googleapis.com'),
      'index.html must not link to fonts.googleapis.com CDN'
    );
    assert.ok(
      !htmlContent.includes('fonts.gstatic.com'),
      'index.html must not link to fonts.gstatic.com CDN'
    );
  });

  it('index.css imports @fontsource/inter locally and sets body and html font-family to Inter', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(
      cssContent.includes('@import "@fontsource/inter/latin-400.css"') ||
      cssContent.includes("@import '@fontsource/inter/latin-400.css'"),
      'index.css must import @fontsource/inter locally'
    );
    assert.ok(
      !cssContent.includes('fonts.googleapis.com'),
      'index.css must not import from external Google Fonts URL'
    );
    assert.ok(
      cssContent.includes("'Inter'") || cssContent.includes('"Inter"'),
      'index.css must configure Inter font-family'
    );
  });

  it('index.css defines CSS tokens for both Night and Day themes', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('[data-theme="night"]'), 'index.css must include [data-theme="night"] tokens');
    assert.ok(cssContent.includes('[data-theme="day"]'), 'index.css must include [data-theme="day"] tokens');
    assert.ok(cssContent.includes('--bg-app'), 'index.css must define --bg-app variable');
    assert.ok(cssContent.includes('--text-primary'), 'index.css must define --text-primary variable');
  });
});
