/**
 * Admin Shell (Phase 2K)
 * Main administrative layout providing mobile-first navigation across Home, Leads, Agents, Data, Reports, and Settings.
 * Retains one-tap access to Field Sales CRM Mode.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Home,
  Settings,
  LogOut,
  BarChart3,
  UserCheck,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminAgentsView } from './AdminAgentsView';
import { AdminLeadsView } from './AdminLeadsView';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminReportsView } from './AdminReportsView';
import { AdminDataManagementView } from './data/AdminDataManagementView';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';

export type AdminTab = 'HOME' | 'LEADS' | 'AGENTS' | 'DATA' | 'REPORTS' | 'SETTINGS';

interface AdminShellProps {
  onEnterSalesMode: () => void;
}

export const AdminShell: React.FC<AdminShellProps> = ({ onEnterSalesMode }) => {
  const { currentUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('HOME');

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between font-sans">
      {/* Top Admin Header */}
      <header className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3 sticky top-0 z-30 shadow-md flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm text-white truncate">
                {currentUser?.name || 'Administrator'}
              </h1>
              <span className="px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 font-bold text-[9px] uppercase tracking-wider border border-purple-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {currentUser?.email || 'admin@amaratvkrishi.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 text-slate-300 text-xs font-semibold border border-slate-600/60 transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-3 sm:p-6 max-w-3xl mx-auto w-full flex flex-col">
        {/* TAB 1: HOME */}
        {activeTab === 'HOME' && (
          <AdminDashboardView
            onEnterSalesMode={onEnterSalesMode}
            onNavigateToLeads={() => setActiveTab('LEADS')}
            onNavigateToAgents={() => setActiveTab('AGENTS')}
          />
        )}

        {/* TAB 2: LEADS */}
        {activeTab === 'LEADS' && <AdminLeadsView />}

        {/* TAB 3: AGENTS */}
        {activeTab === 'AGENTS' && <AdminAgentsView />}

        {/* TAB 4: DATA MANAGEMENT */}
        {activeTab === 'DATA' && <AdminDataManagementView />}

        {/* TAB 5: REPORTS */}
        {activeTab === 'REPORTS' && <AdminReportsView />}

        {/* TAB 6: SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-3">
              <h3 className="font-bold text-sm text-white">Administrator Account</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-semibold text-white">{currentUser?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-semibold text-white">{currentUser?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-semibold text-white">{currentUser?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-bold text-purple-400">ADMIN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-400">{currentUser?.status}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700 space-y-2">
                <button
                  type="button"
                  onClick={onEnterSalesMode}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 active:scale-98"
                >
                  <span>Switch to Field Sales Mode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={signOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center justify-center gap-2 transition-colors active:scale-98"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out from Admin Console</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Admin Navigation Bar */}
      <nav className="sticky bottom-0 z-30 bg-slate-800/95 backdrop-blur-md border-t border-slate-700/80 px-2 py-2 shadow-xl">
        <div className="max-w-md mx-auto grid grid-cols-6 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('HOME')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'HOME'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LEADS')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'LEADS'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Leads</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AGENTS')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'AGENTS'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Agents</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DATA')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'DATA'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REPORTS')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'REPORTS'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'SETTINGS'
                ? 'text-purple-400 bg-purple-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span className="text-[8px] uppercase tracking-tight">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
