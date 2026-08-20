/**
 * AuthContext & useAuth Hook (Phase 2C)
 * Provides application-wide authentication state, current user profile, role context,
 * and session lifecycle handlers.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { AuthService } from '../services/authService';
import { getSupabaseConfig } from '../services/supabaseClient';
import { User } from '../db/types';

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
        setCurrentUser(null);
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        const { user } = await AuthService.validateAndLoadCurrentProfile();
        if (isMounted) {
          setCurrentUser(user);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    setAuthError(null);
    try {
      const { user, session: newSession } = await AuthService.signIn(email, password);
      setCurrentUser(user);
      setSession(newSession);
      return user;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
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
