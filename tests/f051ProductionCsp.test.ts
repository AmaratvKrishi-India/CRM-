import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

describe('F051: production CSP stays strict and synchronized', () => {
  it('keeps one development CSP in source and rewrites it only for production', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const matches = [...html.matchAll(/Content-Security-Policy/gi)];
    assert.equal(matches.length, 1);
    assert.match(html, /127\.0\.0\.1:15432/);
    const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    assert.match(vite, /if \(ctx\.server\) return html/);
    assert.match(vite, /PRODUCTION_CSP/);
  });

  it('keeps the Vercel header as a strict superset of the production meta policy', () => {
    const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    const match = vite.match(/export const PRODUCTION_CSP = "([^"]+)";/);
    assert.ok(match);
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const csp = vercel.headers[0].headers.find((header: { key: string }) => header.key === 'Content-Security-Policy').value;
    for (const directive of match[1].split(';').map((value) => value.trim()).filter(Boolean)) assert.ok(csp.includes(directive), `Vercel CSP missing ${directive}`);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(match[1], /frame-ancestors|unsafe-inline|127\.0\.0\.1|localhost/);
    assert.match(match[1], /img-src 'self' data: blob:/);
  });
});
