import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseConfig } from '../scripts/verify-release-config';

test('release config fails closed when required client values are absent', () => {
  assert.throws(() => validateReleaseConfig({}), /missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/);
  assert.throws(() => validateReleaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' }), /VITE_SUPABASE_ANON_KEY/);
});

test('release config rejects non-Supabase or non-HTTPS endpoints', () => {
  assert.throws(() => validateReleaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:15432', VITE_SUPABASE_ANON_KEY: 'public-test' }), /HTTPS supabase\.co/);
});

test('release config rejects VITE service-role material', () => {
  assert.throws(() => validateReleaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-test',
    VITE_SUPABASE_SERVICE_ROLE_KEY: 'must-not-ship',
  }), /service-role/);
});

test('release config accepts production-shaped public client config', () => {
  assert.doesNotThrow(() => validateReleaseConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'public-test',
  }));
});
