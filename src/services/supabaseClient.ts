/**
 * Supabase Client Configuration & Factory
 * Provides a single isolated client for Supabase Auth and future database sync.
 * Reads configuration from Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * The service-role key is NEVER bundled into the client application.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string | null;
  anonKey: string | null;
  error: string | null;
}

let customClient: SupabaseClient | null = null;

/**
 * Returns current Supabase configuration status without throwing errors.
 */
export function getSupabaseConfig(): SupabaseConfigStatus {
  const url = import.meta.env.VITE_SUPABASE_URL || null;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || null;

  if (!url || !anonKey || url.trim() === '' || anonKey.trim() === '') {
    return {
      isConfigured: false,
      url: null,
      anonKey: null,
      error: 'Supabase URL or Anon Key is missing in environment configuration.',
    };
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return {
      isConfigured: false,
      url,
      anonKey,
      error: 'Invalid Supabase URL format in VITE_SUPABASE_URL.',
    };
  }

  return {
    isConfigured: true,
    url,
    anonKey,
    error: null,
  };
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Retrieves or creates the singleton Supabase client instance.
 * Returns null if environment variables are not configured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (customClient) {
    return customClient;
  }

  if (supabaseInstance) {
    return supabaseInstance;
  }

  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  supabaseInstance = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'amaratv_crm_supabase_auth_session',
    },
  });

  return supabaseInstance;
}

/**
 * Injects a mock/custom Supabase client (used for unit tests and local sandboxes).
 */
export function setCustomSupabaseClient(client: SupabaseClient | null): void {
  customClient = client;
}

/**
 * Resets the client singleton (for testing).
 */
export function resetSupabaseClient(): void {
  customClient = null;
  supabaseInstance = null;
}
