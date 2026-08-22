import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Automated Security & Secret Leak Scanner (Stage 12 & 14)', () => {
  const rootDir = path.resolve('.');

  it('1. Verifies SUPABASE_SERVICE_ROLE_KEY is NOT leaked in client src/ or dist/', () => {
    function searchDir(dir: string, pattern: RegExp): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            results.push(...searchDir(fullPath, pattern));
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const serviceKeyPattern = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.([a-zA-Z0-9_-]*service_role[a-zA-Z0-9_-]*)/;
    const clientSrcMatches = searchDir(path.join(rootDir, 'src'), serviceKeyPattern);
    assert.strictEqual(clientSrcMatches.length, 0, `Service role key found in src: ${clientSrcMatches.join(', ')}`);

    const distMatches = searchDir(path.join(rootDir, 'dist'), serviceKeyPattern);
    assert.strictEqual(distMatches.length, 0, `Service role key found in dist: ${distMatches.join(', ')}`);
  });

  it('2. Verifies AndroidManifest.xml enforces android:allowBackup="false" for ADB security', () => {
    const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml must exist');
    const content = fs.readFileSync(manifestPath, 'utf8');
    assert.ok(content.includes('android:allowBackup="false"'), 'android:allowBackup must be explicitly set to "false"');
  });

  it('3. Verifies PostgreSQL trigger functions enforce SET search_path = public', () => {
    const migration1Path = path.join(rootDir, 'supabase', 'migrations', '20260820000002_phase2e_rls_policies.sql');
    const migration2Path = path.join(rootDir, 'supabase', 'migrations', '20260820000006_rls_agent_lead_isolation.sql');

    const content1 = fs.readFileSync(migration1Path, 'utf8');
    const content2 = fs.readFileSync(migration2Path, 'utf8');

    assert.ok(
      content1.includes('protect_profile_immutable_fields()') && content1.includes('SET search_path = public'),
      'protect_profile_immutable_fields must specify SET search_path = public'
    );

    assert.ok(
      content2.includes('protect_lead_immutable_fields()') && content2.includes('SET search_path = public'),
      'protect_lead_immutable_fields must specify SET search_path = public'
    );
  });
});
