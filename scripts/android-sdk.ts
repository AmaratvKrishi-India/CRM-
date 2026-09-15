import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function resolveAndroidSdkPath(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Android', 'Sdk') : undefined,
    join(homedir(), 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const sdk = resolve(candidate);
    if (existsSync(sdk)) return sdk;
  }

  throw new Error('Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK in the standard Android Studio location.');
}

export function androidSdkEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sdk = resolveAndroidSdkPath(env);
  return { ...env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
}
