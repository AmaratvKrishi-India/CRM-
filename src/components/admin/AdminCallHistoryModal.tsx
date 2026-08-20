/**
 * Admin Call History Modal (Phase 2L)
 * Displays organization-wide call records with filters for Agent, Date, Outcome, and Verification Status.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AdminAnalyticsService,
  DashboardDateRange,
  CallRecordFilterParams,
} from '../../services/adminAnalyticsService';
import { CallRecord, User } from '../../db/types';
import { getDatabase } from '../../db/database';

interface AdminCallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminCallHistoryModal: React.FC<AdminCallHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [calls, setCalls] = useState<Array<CallRecord & { leadName?: string; agentName?: string }>>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
        const allAgents = await db.users.filter((u) => u.role === 'AGENT' && u.deletedAt === null).toArray();
        setAgents(allAgents);
      } catch (err) {
        console.warn('Failed to load agents for call history filter:', err);
      }
    };

    loadAgents();
  }, [isOpen]);

  const loadCalls = async () => {
    if (!isOpen) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, [isOpen, selectedAgent, selectedVerification, selectedOutcome, dateRange]);

  if (!isOpen) return null;

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.leadName && c.leadName.toLowerCase().includes(q)) ||
      (c.agentName && c.agentName.toLowerCase().includes(q)) ||
      (c.remark && c.remark.toLowerCase().includes(q))
    );
  });

  const formatSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Organization Call History</h3>
              <p className="text-xs text-slate-400">
                {filteredCalls.length} calls logged across sales team
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 space-y-2.5 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by gym name, agent, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Agent Filter */}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Verification Status Filter */}
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Verification</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="UNVERIFIED">Unverified Only</option>
            </select>

            {/* Outcome Filter */}
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Outcomes</option>
              <option value="CONNECTED">Connected</option>
              <option value="BUSY">Busy</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="WRONG_NUMBER">Wrong Number</option>
              <option value="CALL_BACK">Call Back</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL_TIME">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Call Records List */}
        <div className="p-4 overflow-y-auto divide-y divide-slate-800/60 max-h-[60vh]">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading call history...</div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No call records match the filter criteria.</div>
          ) : (
            filteredCalls.map((c) => {
              const isVerified = c.verificationStatus === 'VERIFIED' && c.durationSeconds > 0;
              const durStr = isVerified
                ? `${formatSeconds(c.durationSeconds)} • VERIFIED`
                : (c as any).reportedDurationSeconds
                ? `Reported ${formatSeconds((c as any).reportedDurationSeconds)} • UNVERIFIED`
                : 'Duration unavailable • UNVERIFIED';

              return (
                <div key={c.id} className="py-3 flex items-start justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white truncate">{c.leadName}</h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {c.outcome}
                      </span>
                    </div>

                    <p className="text-xs text-purple-300 font-medium mt-0.5">
                      Rep: <span className="font-bold">{c.agentName}</span>
                    </p>

                    {c.remark && (
                      <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
                        &ldquo;{c.remark}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span
                        className={
                          isVerified ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                        }
                      >
                        {durStr}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-400 block">
                      {new Date(c.startedAt || c.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(c.startedAt || c.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
