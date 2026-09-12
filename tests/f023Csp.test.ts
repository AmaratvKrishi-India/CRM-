import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('index.html'), 'utf8');
const cspMetaPattern = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/gi;
const policies = [...html.matchAll(cspMetaPattern)];

const parsePolicy = (policy: string): Map<string, string[]> =>
  new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [directive, ...sources] = part.split(/\s+/);
        return [directive, sources];
      })
  );

describe('F023 bundled Content Security Policy', () => {
  it('declares one policy before any loadable script or stylesheet', () => {
    assert.equal(policies.length, 1, 'index.html must contain exactly one CSP meta policy');
    const policyPosition = policies[0].index;
    const firstLoadablePosition = html.search(/<(?:script|link\s+[^>]*rel=["']stylesheet["'])/i);
    assert.ok(policyPosition >= 0 && policyPosition < firstLoadablePosition);
  });

  it('blocks executable inline, evaluated, data, and blob scripts', () => {
    const directives = parsePolicy(policies[0][1]);
    assert.deepEqual(directives.get('default-src'), ["'self'"]);
    assert.deepEqual(directives.get('script-src'), ["'self'"]);
    assert.ok(!directives.get('script-src')?.includes("'unsafe-inline'"));
    assert.ok(!directives.get('script-src')?.includes("'unsafe-eval'"));
    assert.ok(!directives.get('script-src')?.includes('data:'));
    assert.ok(!directives.get('script-src')?.includes('blob:'));
  });

  it('restricts sensitive document capabilities', () => {
    const directives = parsePolicy(policies[0][1]);
    assert.deepEqual(directives.get('object-src'), ["'none'"]);
    assert.deepEqual(directives.get('frame-src'), ["'none'"]);
    assert.deepEqual(directives.get('base-uri'), ["'self'"]);
    assert.deepEqual(directives.get('form-action'), ["'self'"]);
    assert.deepEqual(directives.get('font-src'), ["'self'"]);
  });

  it('allows only required production and local-harness network origins', () => {
    const directives = parsePolicy(policies[0][1]);
    assert.deepEqual(directives.get('connect-src'), [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'http://127.0.0.1:15432',
      'ws://127.0.0.1:15432',
      'http://localhost:54321',
      'ws://localhost:54321',
    ]);
    assert.ok(!directives.has('upgrade-insecure-requests'));
    assert.ok(!directives.has('frame-ancestors'));
  });
});
