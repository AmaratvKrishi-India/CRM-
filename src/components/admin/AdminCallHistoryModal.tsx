/**
 * Admin Call History Modal (Phase 2L)
 * Displays organization-wide call records with filters for Agent, Date,
 * Outcome, and Verification Status.
 * Rewritten for the shared accessible Modal + design tokens (F1/F2/F5/F15).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type {
  DashboardDateRange,
  CallRecordFilterParams} from '../../services/adminAnalyticsService';
import {
  AdminAnalyticsService
} from '../../services/adminAnalyticsService';
import type { CallRecord, User } from '../../db/types';
import { getDatabase } from '../../db/database';
import { Modal } from '../common/Modal';
import { labelFor } from '../../lib/labels';

interface AdminCallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatSeconds = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const selectClass =
  'w-full min-h-11 bg-inset border border-line rounded-xl px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring';

export const AdminCallHistoryModal: React.FC<AdminCallHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [calls, setCalls] = useState<Array<CallRecord & { leadName?: string; agentName?: string }>>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState<string>('ALL');
  const [selectedVerification, setSelectedVerification] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DashboardDateRange>('ALL_TIME');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const loadAgents = async () => {
      try {
        const db = getDatabase();
        const allAgents = await db.users
          .filter((u) => u.role === 'AGENT' && u.deletedAt === null)
          .toArray();
        setAgents(allAgents);
      } catch (err) {
        console.warn('Failed to load agents for call history filter:', err);
      }
    };

    loadAgents();
  }, [isOpen]);

  const loadCalls = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params: CallRecordFilterParams = {
        agentId: selectedAgent !== 'ALL' ? selectedAgent : undefined,
        verificationStatus: selectedVerification,
        outcome: selectedOutcome !== 'ALL' ? selectedOutcome : undefined,
        dateRange,
        limit: 200,
      };

      const result = await AdminAnalyticsService.getAllCallRecords(currentUser, params);
      setCalls(result);
    } catch (err) {
      console.warn('Failed to load call history records:', err);
      setLoadError('Could not load call history. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, currentUser, selectedAgent, selectedVerification, selectedOutcome, dateRange]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.leadName && c.leadName.toLowerCase().includes(q)) ||
      (c.agentName && c.agentName.toLowerCase().includes(q)) ||
      (c.remark && c.remark.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Organization Call History"
      subtitle={`${filteredCalls.length} calls logged across sales team`}
      maxWidthClassName="max-w-2xl"
      headerIcon={
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent-soft text-accent-text border border-accent">
          <PhoneCall className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      {/* Filter bar stays pinned above the scrolling list */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 -mt-1 bg-surface border-b border-line space-y-2.5">
        <div>
          <label htmlFor="call-history-search" className="sr-only">
            Search by lead name, agent, or note
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="call-history-search"
              type="text"
              data-autofocus
              placeholder="Search by lead name, agent, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 bg-inset border border-line rounded-xl pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label htmlFor="filter-agent" className="block text-xs font-semibold text-faint mb-1">
              Agent
            </label>
            <select
              id="filter-agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-verification" className="block text-xs font-semibold text-faint mb-1">
              Verification
            </label>
            <select
              id="filter-verification"
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value as 'ALL' | 'VERIFIED' | 'UNVERIFIED')}
              className={selectClass}
            >
              <option value="ALL">All Verification</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="UNVERIFIED">Unverified Only</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-outcome" className="block text-xs font-semibold text-faint mb-1">
              Outcome
            </label>
            <select
              id="filter-outcome"
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Outcomes</option>
              <option value="CONNECTED">Connected</option>
              <option value="BUSY">Busy</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="WRONG_NUMBER">Wrong Number</option>
              <option value="CALL_BACK">Call Back</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-date-range" className="block text-xs font-semibold text-faint mb-1">
              Date Range
            </label>
            <select
              id="filter-date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DashboardDateRange)}
              className={selectClass}
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Call Records List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center gap-2 text-sm text-soft" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-accent-text" aria-hidden="true" />
          <span>Loading call history...</span>
        </div>
      ) : loadError ? (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-6 h-6 text-danger-text" aria-hidden="true" />
          <p role="alert" className="text-sm text-danger-text font-medium max-w-sm">
            {loadError}
          </p>
          <button
            type="button"
            onClick={loadCalls}
            className="min-h-11 px-5 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="py-12 text-center text-sm text-faint">
          No call records match the filter criteria.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {filteredCalls.map((c) => {
            const isVerified = c.verificationStatus === 'VERIFIED' && c.durationSeconds > 0;
            const durStr = isVerified
              ? formatSeconds(c.durationSeconds)
              : c.reportedDurationSeconds
              ? `Reported ${formatSeconds(c.reportedDurationSeconds)}`
              : 'Duration unavailable';

            return (
              <li
                key={c.id}
                className="py-3 flex items-start justify-between gap-3 px-2 rounded-xl hover:bg-inset transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-ink truncate">{c.leadName}</h4>
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-inset text-soft border border-line">
                      {labelFor(c.outcome)}
                    </span>
                  </div>

                  <p className="text-xs text-accent-text font-medium mt-0.5">
                    Rep: <span className="font-bold">{c.agentName}</span>
                  </p>

                  {c.remark && (
                    <p className="text-xs text-soft mt-1 italic line-clamp-1">
                      &ldquo;{c.remark}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                    <span className={isVerified ? 'text-success-text font-semibold' : 'text-soft'}>
                      {durStr}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${
                        isVerified
                          ? 'bg-success-soft text-success-text'
                          : 'bg-warning-soft text-warning-text'
                      }`}
                    >
                      {isVerified ? (
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      )}
                      {isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-soft block">
                    {new Date(c.startedAt || c.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-xs text-faint">
                    {new Date(c.startedAt || c.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};
