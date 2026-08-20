import path from 'path';
import fs from 'fs';

export interface AndroidTestConfig {
  appId: string;
  mainActivity: string;
  apkPath: string;
  screenshotsDir: string;
  reportsDir: string;
  fixturesDir: string;
  defaultTimeoutMs: number;
}

const PROJECT_ROOT = path.resolve(process.cwd());

const gradleReleaseApk = path.join(PROJECT_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const releaseV2ApkPath = path.join(PROJECT_ROOT, 'release', 'AmaratvKrishi-SalesCRM-v2.0.0.apk');
const releaseV1ApkPath = path.join(PROJECT_ROOT, 'release', 'AmaratvKrishi-SalesCRM-v1.0.0.apk');
const debugApkPath = path.join(PROJECT_ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const resolvedApkPath = fs.existsSync(gradleReleaseApk)
  ? gradleReleaseApk
  : fs.existsSync(releaseV2ApkPath)
  ? releaseV2ApkPath
  : fs.existsSync(releaseV1ApkPath)
  ? releaseV1ApkPath
  : debugApkPath;

export const androidConfig: AndroidTestConfig = {
  appId: 'com.amaratvkrishi.salescrm',
  mainActivity: '.MainActivity',
  apkPath: resolvedApkPath,
  screenshotsDir: path.join(PROJECT_ROOT, 'e2e', 'android', 'screenshots'),
  reportsDir: path.join(PROJECT_ROOT, 'e2e', 'android', 'reports'),
  fixturesDir: path.join(PROJECT_ROOT, 'e2e', 'android', 'fixtures'),
  defaultTimeoutMs: 15000,
};

// Ensure directories exist
[androidConfig.screenshotsDir, androidConfig.reportsDir, androidConfig.fixturesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
