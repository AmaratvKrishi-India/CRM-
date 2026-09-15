import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('index.html'), 'utf8');
const vite = readFileSync(resolve('vite.config.ts'), 'utf8');
const sourceMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/i);
const productionMatch = vite.match(/export const PRODUCTION_CSP = "([^"]+)";/);
assert.ok(sourceMatch, 'index.html must contain one development CSP meta policy');
assert.ok(productionMatch, 'vite.config.ts must export PRODUCTION_CSP');
const developmentPolicy = sourceMatch[1];
const productionPolicy = productionMatch[1];

const parsePolicy = (policy: string): Map<string, string[]> => new Map(
  policy.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [directive, ...sources] = part.split(/\s+/);
    return [directive, sources];
  }),
);

describe('F023 bundled Content Security Policy', () => {
  it('keeps a development policy in source and rewrites it for production builds', () => {
    assert.match(vite, /html-csp-policy/);
    assert.match(vite, /if \(ctx\.server\) return html/);
    assert.match(vite, /html\.replace/);
    assert.match(developmentPolicy, /127\.0\.0\.1:15432/);
    assert.match(developmentPolicy, /localhost:54321/);
    assert.match(developmentPolicy, /style-src 'self' 'unsafe-inline'/);
  });

  it('selects the local-network CSP only for explicit local-test bundle builds', () => {
    assert.match(vite, /VITE_APP_ENV/);
    assert.match(vite, /local-test/);
    assert.match(vite, /DEVELOPMENT_CSP/);
    assert.match(vite, /PRODUCTION_CSP/);
  });

  it('keeps production script execution strict', () => {
    const directives = parsePolicy(productionPolicy);
    assert.deepEqual(directives.get('default-src'), ["'self'"]);
    assert.deepEqual(directives.get('script-src'), ["'self'"]);
    assert.ok(!directives.get('script-src')?.includes("'unsafe-inline'"));
    assert.ok(!directives.get('script-src')?.includes("'unsafe-eval'"));
    assert.ok(!directives.get('script-src')?.includes('data:'));
    assert.ok(!directives.get('script-src')?.includes('blob:'));
  });

  it('restricts sensitive document capabilities while allowing required blob images', () => {
    const directives = parsePolicy(productionPolicy);
    assert.deepEqual(directives.get('object-src'), ["'none'"]);
    assert.deepEqual(directives.get('frame-src'), ["'none'"]);
    assert.deepEqual(directives.get('base-uri'), ["'self'"]);
    assert.deepEqual(directives.get('form-action'), ["'self'"]);
    assert.deepEqual(directives.get('font-src'), ["'self'"]);
    assert.deepEqual(directives.get('img-src'), ["'self'", 'data:', 'blob:']);
  });

  it('keeps localhost network origins out of production', () => {
    const production = parsePolicy(productionPolicy);
    assert.deepEqual(production.get('connect-src'), ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
    assert.ok(production.has('upgrade-insecure-requests'));
    assert.ok(!production.has('frame-ancestors'));
    assert.doesNotMatch(productionPolicy, /unsafe-inline|127\.0\.0\.1|localhost/);
  });
});
