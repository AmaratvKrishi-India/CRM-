import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const verifyPath = path.resolve(here, '../scripts/verify.ts');
const source = fs.readFileSync(verifyPath, 'utf8');

test('F055 verifier uses a true local health endpoint', () => {
  assert.match(source, /http:\/\/127\.0\.0\.1:15432\/auth\/v1\/health/);
  assert.doesNotMatch(source, /rest\/v1\/leads\?select=id,business_name&limit=1/);
});

test('F055 verifier gives full E2E and multi-device stages explicit realistic timeouts', () => {
  assert.match(source, /'npm run test:e2e'\s*,\s*\{ timeoutMs: 900000 \}/s);
  assert.match(source, /'npx tsx --test tests\/multiDeviceSync\.test\.ts'\s*,\s*\{ timeoutMs: 600000 \}/s);
});

test('F055 emulator smoke never attempts to install an unsigned release artifact', () => {
  assert.match(source, /const debugApkPath = path\.join\(/);
  assert.match(source, /const smokeApkPath = fs\.existsSync\(debugApkPath\) \? debugApkPath : undefined/);
  assert.match(source, /execFileSync\(adbPath, \['-s', firstEmulatorSerial, 'install', '-r', smokeApkPath\]/);
  assert.doesNotMatch(source, /install', '-r', apkPath/);
});

test('F055 Android build produces both release and installable debug smoke artifacts', () => {
  assert.match(source, /gradlew assembleRelease assembleDebug/);
});

test('F055 emulator smoke removes stale package signatures before installing the candidate', () => {
  const uninstallIndex = source.indexOf("'uninstall', 'com.amaratvkrishi.salescrm'");
  const installIndex = source.indexOf("'install', '-r', smokeApkPath");
  assert.ok(uninstallIndex >= 0, 'Verifier must uninstall a stale emulator package');
  assert.ok(installIndex > uninstallIndex, 'Uninstall must occur before candidate install');
});

test('F055 physical hardware waiver is explicit and is never mislabeled PASS', () => {
  assert.match(source, /status: 'WAIVED'/);
  assert.match(source, /WAIVED BY USER/);
});

test('F055 verifier waits for local PostgreSQL readiness after reset', () => {
  assert.match(source, /waitForLocalSupabaseReady/);
  assert.match(source, /pg_isready/);
  assert.match(source, /select 1/);
});

test('F055 verifier syncs Capacitor Android project before Gradle build', () => {
  const capSyncIndex = source.indexOf("'npx cap sync android'");
  const gradleIndex = source.indexOf("'cd android && gradlew assembleRelease assembleDebug'");
  assert.ok(capSyncIndex >= 0, 'Capacitor Android sync command must exist');
  assert.ok(gradleIndex > capSyncIndex, 'Capacitor sync must run before Gradle build');
});

test('F055 verifier resolves Android SDK for clean-checkout Gradle builds', () => {
  assert.match(source, /androidSdkEnvironment/);
  assert.match(source, /const buildEnv[^;]*androidSdkEnvironment/s);
});

test('F055 missing ignored production environment is blocked, but unsafe supplied config still fails', () => {
  assert.match(source, /const hasProductionEnvironmentFile = fs\.existsSync\(envProduction\)/);
  assert.match(source, /!hasProductionEnvironmentFile\s*\? 'BLOCKED'\s*:\s*hasProductionSafetyConfiguration\s*\? 'PASS'\s*:\s*'FAIL'/s);
});
