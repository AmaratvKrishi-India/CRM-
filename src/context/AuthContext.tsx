/**
 * AuthContext & useAuth Hook (Phase 2C)
 * Provides application-wide authentication state, current user profile, role context,
 * and session lifecycle handlers.
 */

import type { ReactNode} from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from '../services/authService';
import { getSupabaseConfig } from '../services/supabaseClient';
import { BackgroundSyncManager } from '../services/sync/backgroundSyncManager';
import type { User } from '../db/types';
import { lockCRMData } from '../db';
import { RealtimeService } from '../services/realtime/realtimeService';

const PROFILE_REVALIDATION_INTERVAL_MS = 60_000;

function stopSynchronization(): void {
  BackgroundSyncManager.stop();
  void RealtimeService.unsubscribe();
}

export interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  configError: string | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Initialize Auth State on Startup
  useEffect(() => {
    let isMounted = true;
    let validationInFlight = false;

    const revalidateProfile = async () => {
      if (validationInFlight) return;
      validationInFlight = true;
      try {
        const { user, error } = await AuthService.validateAndLoadCurrentProfile();
        if (!isMounted) return;
        if (!user) {
          stopSynchronization();
          setCurrentUser(null);
          setSession(null);
          if (error) setAuthError(error);
          return;
        }
        setCurrentUser(user);
        setSession(await AuthService.getCurrentSession());
        void BackgroundSyncManager.init(user).catch((e) =>
          console.warn('BackgroundSyncManager revalidation warning:', e)
        );
      } catch (err: unknown) {
        await lockCRMData();
        stopSynchronization();
        if (!isMounted) return;
        setCurrentUser(null);
        setSession(null);
        setAuthError(err instanceof Error ? err.message : 'Unable to verify account access.');
      } finally {
        validationInFlight = false;
      }
    };

    const initAuth = async () => {
      const config = getSupabaseConfig();
      if (!config.isConfigured) {
        if (isMounted) {
          setIsConfigured(false);
          setConfigError(config.error);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsConfigured(true);
        setConfigError(null);
      }

      try {
        const { user, error } = await AuthService.validateAndLoadCurrentProfile();
        if (isMounted) {
          if (user) {
            setCurrentUser(user);
            const curSession = await AuthService.getCurrentSession();
            setSession(curSession);
            // Restore background sync for existing session on app startup
            BackgroundSyncManager.init(user).catch((e) =>
              console.warn('BackgroundSyncManager restore warning:', e)
            );
          } else {
            setCurrentUser(null);
            setSession(null);
            if (error) {
              setAuthError(error);
            }
          }
        }
      } catch (err: unknown) {
        console.warn('Auth initialization warning:', err instanceof Error ? err.message : err);
        await lockCRMData();
        stopSynchronization();
        if (isMounted) {
          setCurrentUser(null);
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for Auth State Changes
    const subscription = AuthService.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !newSession) {
        stopSynchronization();
        await lockCRMData();
        setCurrentUser(null);
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_IN') {
          // A SIGNED_IN event can represent an account switch. Keep the old
          // account locked until the new server profile is verified.
          stopSynchronization();
          await lockCRMData();
          setCurrentUser(null);
          setSession(null);
        } else {
          setSession(newSession);
        }
        const { user, error } = await AuthService.validateAndLoadCurrentProfile();
        if (isMounted) {
          setCurrentUser(user);
          if (user) {
            setSession(newSession);
            void BackgroundSyncManager.init(user).catch((e) =>
              console.warn('BackgroundSyncManager auth refresh warning:', e)
            );
          }
          if (!user) {
            stopSynchronization();
            setSession(null);
            if (error) setAuthError(error);
          }
        }
      }
    });

    const revalidationTimer = setInterval(() => {
      void revalidateProfile();
    }, PROFILE_REVALIDATION_INTERVAL_MS);
    const handleFocusOrOnline = () => {
      void revalidateProfile();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocusOrOnline);
      window.addEventListener('online', handleFocusOrOnline);
    }

    return () => {
      isMounted = false;
      clearInterval(revalidationTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocusOrOnline);
        window.removeEventListener('online', handleFocusOrOnline);
      }
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    setAuthError(null);
    try {
      const { user, session: newSession } = await AuthService.signIn(email, password);
      setCurrentUser(user);
      setSession(newSession);
      // Start background sync automatically after successful login
      BackgroundSyncManager.init(user).catch((e) =>
        console.warn('BackgroundSyncManager init warning:', e)
      );
      return user;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Stop background sync before signing out
      stopSynchronization();
      await AuthService.signOut();
    } finally {
      setCurrentUser(null);
      setSession(null);
      setAuthError(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        isLoading,
        isConfigured,
        configError,
        authError,
        signIn,
        signOut,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
