import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const verifyPath = path.resolve(here, '../scripts/verify.ts');

test('F054 missing production read-only credentials do not bypass verifier finalization', () => {
  const source = fs.readFileSync(verifyPath, 'utf8');
  const start = source.indexOf('if (!configuredProdUrl || !prodAnonKey)');
  const end = source.indexOf('// Production Schema Comparison', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const productionBlock = source.slice(start, end);
  assert.doesNotMatch(productionBlock, /\breturn\s*;/);
});

test('F054 deep Android audit prepares a clean checkout with a resolved Android SDK before Gradle lint', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(here, '../package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const command = packageJson.scripts?.['audit:android'] ?? '';
  const auditPath = path.resolve(here, '../scripts/audit-android.ts');
  const sdkPath = path.resolve(here, '../scripts/android-sdk.ts');
  assert.ok(fs.existsSync(auditPath), 'Android audit must use a dedicated clean-checkout-safe runner.');
  assert.ok(fs.existsSync(sdkPath), 'Android audit must resolve the SDK without relying on ignored local.properties.');
  const auditSource = fs.readFileSync(auditPath, 'utf8');
  const sdkSource = fs.readFileSync(sdkPath, 'utf8');

  assert.equal(command, 'tsx scripts/audit-android.ts');
  assert.match(auditSource, /npm.*run.*build/s);
  assert.match(auditSource, /cap.*sync.*android/s);
  assert.match(auditSource, /gradle.*lint/s);
  assert.doesNotMatch(auditSource, /spawnSync\('\.\/gradlew'/, 'Gradle wrapper path must not look like a project import to Knip.');
  assert.match(auditSource, /gradleWrapper/);
  assert.match(auditSource, /androidSdkEnvironment/);
  assert.match(sdkSource, /ANDROID_HOME/);
  assert.match(sdkSource, /ANDROID_SDK_ROOT/);
  assert.match(sdkSource, /LOCALAPPDATA/);
});