/**
 * Create Agent Modal (Phase 2D & 2H)
 * Admin-only form to provision a new Sales Agent account.
 * Securely captures initial password for Edge Function provisioning without local storage.
 * Strictly forces role to AGENT and records immutable audit activity.
 */

import React, { useState } from 'react';
import {
  UserPlus,
  Mail,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Info,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AgentManagementService } from '../../services/agentManagementService';
import type { User as UserType, UserStatus } from '../../db/types';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated: (agent: UserType) => void;
}

export const CreateAgentModal: React.FC<CreateAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentCreated,
}) => {
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter the agent full name.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Please enter the agent email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Initial password must be at least 6 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { agent } = await AgentManagementService.createAgent(currentUser, {
        name: cleanName,
        email: cleanEmail,
        phone: phone.trim(),
        password,
        status,
      });

      onAgentCreated(agent);
      onClose();
      // Reset form and purge passwords from memory
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setStatus('ACTIVE');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create agent account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-inset border border-line rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent transition-all';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sales Agent"
      subtitle="Provision a field representative account"
      maxWidthClassName="max-w-md"
      closeOnBackdrop={false}
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-info-soft text-info-text border border-info flex items-center justify-center flex-shrink-0">
          <UserPlus className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Informational Security Notice */}
        <div className="p-3 bg-info-soft border border-info rounded-2xl text-sm text-info-text flex items-start gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Authentication & Security</p>
            <p className="text-xs mt-0.5">
              Role is strictly fixed to <strong>Agent</strong>. The agent uses this email and password to log into the field sales application. Passwords are never stored in the local CRM database.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="agent-name" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Agent Full Name *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <User className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="agent-name"
              data-autofocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              disabled={isSubmitting}
              className={inputClass}
              required
            />
          </div>
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <label htmlFor="agent-email" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Email Address / Login ID *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Mail className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="agent-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@amaratvkrishi.com"
              disabled={isSubmitting}
              className={inputClass}
              required
            />
          </div>
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <label htmlFor="agent-phone" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Mobile Phone (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Phone className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="agent-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              disabled={isSubmitting}
              className={inputClass}
            />
          </div>
        </div>

        {/* Initial Password */}
        <div className="space-y-1.5">
          <label htmlFor="agent-password" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Initial Password * (min 6 characters)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="agent-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className={`${inputClass} pr-12`}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-faint hover:text-ink"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label htmlFor="agent-confirm-password" className="block text-xs font-bold text-soft uppercase tracking-wide">
            Confirm Password *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="agent-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className={inputClass}
              required
              minLength={6}
            />
          </div>
        </div>

        {/* Initial Status */}
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-soft uppercase tracking-wide" id="agent-status-label">
            Initial Account Status
          </span>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-labelledby="agent-status-label"
          >
            <button
              type="button"
              onClick={() => setStatus('ACTIVE')}
              aria-pressed={status === 'ACTIVE'}
              className={`min-h-11 py-2 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                status === 'ACTIVE'
                  ? 'bg-success-soft border-success text-success-text'
                  : 'bg-inset border-line text-faint hover:text-soft'
              }`}
            >
              {status === 'ACTIVE' && <Check className="w-4 h-4" aria-hidden="true" />}
              <span>{labelFor('ACTIVE')}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('INACTIVE')}
              aria-pressed={status === 'INACTIVE'}
              className={`min-h-11 py-2 px-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                status === 'INACTIVE'
                  ? 'bg-danger-soft border-danger text-danger-text'
                  : 'bg-inset border-line text-faint hover:text-soft'
              }`}
            >
              {status === 'INACTIVE' && <Check className="w-4 h-4" aria-hidden="true" />}
              <span>{labelFor('INACTIVE')}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-11 py-2.5 px-4 rounded-xl bg-inset hover:bg-inset-strong text-ink text-sm font-bold border border-line transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 py-2.5 px-5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Provisioning...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Create Agent</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
