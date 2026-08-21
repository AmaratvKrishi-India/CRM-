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

  it('index.html imports Google Fonts Inter stylesheet with preconnect', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(
      htmlContent.includes('fonts.googleapis.com/css2?family=Inter'),
      'index.html must load Inter from Google Fonts'
    );
    assert.ok(
      htmlContent.includes('rel="preconnect" href="https://fonts.googleapis.com"'),
      'index.html should have preconnect link for fonts.googleapis.com'
    );
  });

  it('index.css sets body and html font-family to Inter', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(
      cssContent.includes("'Inter'") || cssContent.includes('"Inter"'),
      'index.css must configure Inter font-family'
    );
    assert.ok(
      cssContent.includes('@import url("https://fonts.googleapis.com/css2?family=Inter'),
      'index.css must import Inter font directly'
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
