/**
 * Admin Shell Placeholder (Phase 2C)
 * Rendered when an authenticated user has the ADMIN role.
 * Allows switching into Field Sales Rep mode or Logging Out.
 * Complete Admin CRM Dashboard & Agent Management will be implemented in subsequent milestones (2D/2K).
 */

import React from 'react';
import {
  ShieldCheck,
  LogOut,
  UserCheck,
  PhoneCall,
  Users,
  BarChart3,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminShellPlaceholderProps {
  onEnterSalesMode: () => void;
}

export const AdminShellPlaceholder: React.FC<AdminShellPlaceholderProps> = ({
  onEnterSalesMode,
}) => {
  const { currentUser, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Top Admin Header */}
      <header className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white truncate">
                {currentUser?.name || 'Administrator'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] uppercase tracking-wider border border-purple-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {currentUser?.email || 'admin@amaratvkrishi.com'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 text-slate-300 text-xs font-semibold border border-slate-600/60 transition-all active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Milestone Notice */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-slate-800 to-slate-800 rounded-3xl border border-purple-500/20 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Phase 2C — Authentication Verified
            </h3>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            You are logged in as an <strong>Administrator</strong>. Your role has been authenticated with Supabase and mapped to your local profile.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onEnterSalesMode}
              className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Operate Leads (Sales CRM Mode)</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* Next Milestones Preview Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Upcoming Administrative Modules
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h5 className="font-bold text-xs text-white">Phase 2D: Agent Management</h5>
              <p className="text-[11px] text-slate-400">
                Create new agent credentials, activate/deactivate representatives, and assign lead pools.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h5 className="font-bold text-xs text-white">Phase 2K: Executive Dashboard</h5>
              <p className="text-[11px] text-slate-400">
                View team KPIs, verified call durations, real-time activity feeds, and pipeline reports.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h5 className="font-bold text-xs text-white">Phase 2F: Supabase Sync Hub</h5>
              <p className="text-[11px] text-slate-400">
                Centralized PostgreSQL delta synchronisation with Row Level Security enforcement.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <h5 className="font-bold text-xs text-white">Phase 2E: Lead Ownership</h5>
              <p className="text-[11px] text-slate-400">
                Assign and reassign gym leads across sales representatives with full historical audit trails.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
