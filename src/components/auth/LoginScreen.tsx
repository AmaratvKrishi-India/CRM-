/**
 * Mobile-First Login Screen (Phase 2C)
 * Provides authentication UI for ADMIN and AGENT users.
 * Strictly avoids public registration, forgot password, social logins, and password storage.
 *
 * UX remediation: design tokens (F1/F12) — the day/night toggle now visibly
 * restyles this screen through the token system; labels associated with
 * inputs via htmlFor/id (F2); aria-label on the password visibility toggle
 * and theme toggle instead of hover-only title (F21); 44px targets (F6).
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Shield,
  Info,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export const LoginScreen: React.FC = () => {
  const { signIn, isConfigured, configError, authError, clearAuthError } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(cleanEmail, password);
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col justify-between p-4 sm:p-6 font-sans relative transition-colors duration-200">
      {/* Quick Theme Toggle Top-Right */}
      <div className="absolute top-6 right-5 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'NIGHT' ? 'Day' : 'Night'} Mode`}
          className="min-w-11 min-h-11 p-3 rounded-2xl border border-line bg-surface text-ink shadow-md hover:bg-inset transition-all active:scale-90 flex items-center justify-center gap-1.5 text-sm font-bold cursor-pointer"
        >
          {theme === 'DAY' ? (
            <Moon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Sun className="w-5 h-5 text-warning-text" aria-hidden="true" />
          )}
          <span className="hidden sm:inline font-semibold">{theme === 'DAY' ? 'Night' : 'Day'}</span>
        </button>
      </div>

      {/* Top Branding Section */}
      <div className="w-full max-w-md mx-auto pt-8 sm:pt-12 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-surface border border-line p-2 mb-3 shadow-xl">
          <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Amaratv Krishi
        </h1>
        <p className="text-sm text-accent-text font-medium tracking-wide uppercase mt-1">
          Field Sales CRM • Lucknow
        </p>
        <p className="text-sm text-soft mt-2 max-w-xs mx-auto">
          Sign in to access your designated gym leads, pitch catalogue, and sales workflows.
        </p>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-surface backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-line shadow-xl space-y-6 transition-colors duration-200">
          {/* Missing Configuration Notice */}
          {!isConfigured && (
            <div className="p-3.5 bg-warning-soft border border-warning rounded-2xl text-sm text-warning-text flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Authentication Setup Required</p>
                <p className="text-xs opacity-90 mt-0.5">
                  {configError || 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set.'}
                </p>
              </div>
            </div>
          )}

          {/* Error Message Box */}
          {displayError && (
            <div
              role="alert"
              className="p-3.5 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <span className="font-medium">{displayError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-bold text-soft">
                Email / Login ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@amaratvkrishi.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="min-h-11 w-full bg-inset border border-line rounded-xl pl-10 pr-3.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-bold text-soft">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className="min-h-11 w-full bg-inset border border-line rounded-xl pl-10 pr-12 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring transition-all disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-faint hover:text-ink transition-colors rounded-r-xl"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isConfigured}
              className="min-h-11 w-full py-3 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Admin Provisioning Notice */}
          <div className="pt-2 border-t border-line text-center">
            <p className="text-xs text-soft flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-accent-text shrink-0" aria-hidden="true" />
              <span>Accounts are managed &amp; provisioned by Administrators.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Status Footer */}
      <div className="w-full max-w-md mx-auto text-center pb-4 text-sm text-faint">
        <p>Amaratv Krishi CRM v2.0 • Offline-First Sales Engine</p>
      </div>
    </div>
  );
};
