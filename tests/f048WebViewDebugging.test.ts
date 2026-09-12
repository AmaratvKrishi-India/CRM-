import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mainActivity = readFileSync(
  resolve('android/app/src/main/java/com/amaratvkrishi/salescrm/MainActivity.java'),
  'utf8',
);

test('F048 only enables WebView debugging in debug builds', () => {
  assert.match(mainActivity, /WebView\.setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);
  assert.doesNotMatch(mainActivity, /setWebContentsDebuggingEnabled\(true\)/);
});
