import { Capacitor } from '@capacitor/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

type Operation = 'sync_push' | 'sync_cycle' | 'render' | 'unhandled_error' | 'unhandled_rejection';
type Category = 'network' | 'timeout' | 'authentication' | 'authorization' | 'validation' | 'conflict' | 'unexpected';

function operationalCategory(error: unknown): Category {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/CONFLICT|REVISION/i.test(message)) return 'conflict';
  if (/TIMEOUT|TIMED OUT/i.test(message)) return 'timeout';
  if (/AUTHENTICATION|401|JWT/i.test(message)) return 'authentication';
  if (/PERMISSION|AUTHORIZATION|403|RLS/i.test(message)) return 'authorization';
  if (/VALIDATION|400|422/i.test(message)) return 'validation';
  if (/NETWORK|FETCH|OFFLINE/i.test(message)) return 'network';
  return 'unexpected';
}

/** Best-effort, bounded diagnostics. Raw errors never cross this boundary. */
export async function reportOperationalError(
  operation: Operation, error: unknown, failureCount = 1, client?: SupabaseClient | null,
): Promise<boolean> {
  try {
    const connection = client === undefined ? getSupabaseClient() : client;
    if (!connection || typeof (connection as { rpc?: unknown }).rpc !== 'function' ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
    const platform = Capacitor.getPlatform();
    const result = await connection.rpc('report_operational_error', {
      operation, category: operationalCategory(error),
      platform: platform === 'android' || platform === 'ios' ? platform : 'web',
      build: '2.0.0', failure_count: Math.min(1000, Math.max(1, Math.floor(failureCount) || 1)),
    }).abortSignal(AbortSignal.timeout(5000));
    return !result.error && typeof result.data === 'string';
  } catch { return false; }
}
