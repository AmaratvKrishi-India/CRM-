/**
 * Admin Shell (Phase 2K)
 * Main administrative layout providing mobile-first navigation across Home,
 * Leads, Agents, Data, Reports, and Settings. Retains one-tap access to
 * Field Sales CRM Mode.
 * Rewritten for design tokens + accessible tablist nav (F1/F2/F14/F24).
 */

import React, { useRef, useState } from 'react';
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

const TAB_ORDER: AdminTab[] = ['HOME', 'LEADS', 'AGENTS', 'DATA', 'REPORTS', 'SETTINGS'];

const TAB_META: Record<AdminTab, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  HOME: { label: 'Overview', Icon: Home },
  LEADS: { label: 'Leads', Icon: UserCheck },
  AGENTS: { label: 'Agents', Icon: Users },
  DATA: { label: 'Data', Icon: Database },
  REPORTS: { label: 'Reports', Icon: BarChart3 },
  SETTINGS: { label: 'Settings', Icon: Settings },
};

interface AdminShellProps {
  onEnterSalesMode: () => void;
}

export const AdminShell: React.FC<AdminShellProps> = ({ onEnterSalesMode }) => {
  const { currentUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('HOME');
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});

  // Roving-tabindex keyboard support for the bottom tablist (F14).
  const handleTabKeyDown = (e: React.KeyboardEvent, id: AdminTab) => {
    const idx = TAB_ORDER.indexOf(id);
    let next: AdminTab | null = null;
    if (e.key === 'ArrowRight') next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    else if (e.key === 'ArrowLeft') next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    else if (e.key === 'Home') next = TAB_ORDER[0];
    else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];
    if (next) {
      e.preventDefault();
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <div
      data-role="admin"
      className="min-h-screen bg-app text-ink flex flex-col justify-between font-sans"
    >
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3 focus:text-ink focus:shadow-lg"
      >
        Skip to main content
      </a>
      {/* Top Admin Header */}
      <header className="bg-surface/90 border-b border-line px-4 py-3 sticky top-0 z-30 shadow-md flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent-soft border border-accent text-accent-text flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm text-ink truncate">
                {currentUser?.name || 'Administrator'}
              </h1>
              <span className="px-1.5 py-0.5 rounded-md bg-accent-soft text-accent-text font-bold text-xs uppercase tracking-wider border border-accent">
                Admin
              </span>
            </div>
            <p className="text-xs text-soft truncate">
              {currentUser?.email || 'admin@amaratvkrishi.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="min-h-11 flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-inset hover:bg-danger-soft hover:text-danger-text hover:border-danger text-soft text-sm font-semibold border border-line transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main id="admin-main-content" tabIndex={-1} className="flex-1 p-3 sm:p-6 max-w-3xl mx-auto w-full flex flex-col">
        <div
          id="admin-panel-home"
          role="tabpanel"
          aria-labelledby="admin-tab-home"
          hidden={activeTab !== 'HOME'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'HOME' && (
            <AdminDashboardView
              onEnterSalesMode={onEnterSalesMode}
              onNavigateToLeads={() => setActiveTab('LEADS')}
              onNavigateToAgents={() => setActiveTab('AGENTS')}
            />
          )}
        </div>

        <div
          id="admin-panel-leads"
          role="tabpanel"
          aria-labelledby="admin-tab-leads"
          hidden={activeTab !== 'LEADS'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'LEADS' && <AdminLeadsView />}
        </div>

        <div
          id="admin-panel-agents"
          role="tabpanel"
          aria-labelledby="admin-tab-agents"
          hidden={activeTab !== 'AGENTS'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'AGENTS' && <AdminAgentsView />}
        </div>

        <div
          id="admin-panel-data"
          role="tabpanel"
          aria-labelledby="admin-tab-data"
          hidden={activeTab !== 'DATA'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'DATA' && <AdminDataManagementView />}
        </div>

        <div
          id="admin-panel-reports"
          role="tabpanel"
          aria-labelledby="admin-tab-reports"
          hidden={activeTab !== 'REPORTS'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'REPORTS' && <AdminReportsView />}
        </div>

        <div
          id="admin-panel-settings"
          role="tabpanel"
          aria-labelledby="admin-tab-settings"
          hidden={activeTab !== 'SETTINGS'}
          className="flex-1 flex flex-col"
        >
          {activeTab === 'SETTINGS' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface rounded-2xl border border-line space-y-3">
                <h3 className="font-bold text-sm text-ink">Administrator Account</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-soft">Name:</span>
                    <span className="font-semibold text-ink">{currentUser?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-soft">Email:</span>
                    <span className="font-semibold text-ink">{currentUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-soft">Phone:</span>
                    <span className="font-semibold text-ink">{currentUser?.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-soft">Role:</span>
                    <span className="font-bold text-accent-text">Admin</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-soft">Status:</span>
                    <span className="font-bold text-success-text">{currentUser?.status}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-line space-y-2">
                  <button
                    type="button"
                    onClick={onEnterSalesMode}
                    className="w-full min-h-11 py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
                  >
                    <span>Switch to Field Sales Mode</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full min-h-11 py-2.5 px-4 rounded-xl bg-danger-soft hover:opacity-80 text-danger-text text-sm font-bold border border-danger flex items-center justify-center gap-2 transition-colors active:scale-98"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>Sign Out from Admin Console</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Admin Navigation Bar */}
      <nav
        aria-label="Admin sections"
        className="sticky bottom-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line px-2 py-2 shadow-xl"
      >
        <div role="tablist" aria-label="Admin console sections" className="max-w-md mx-auto grid grid-cols-6 gap-1">
          {TAB_ORDER.map((tab) => {
            const { label, Icon } = TAB_META[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[tab] = el;
                }}
                type="button"
                role="tab"
                id={`admin-tab-${tab.toLowerCase()}`}
                aria-selected={isActive}
                aria-controls={`admin-panel-${tab.toLowerCase()}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(e) => handleTabKeyDown(e, tab)}
                className={`min-h-11 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isActive
                    ? 'text-accent-text bg-accent-soft font-bold'
                    : 'text-soft hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" aria-hidden="true" />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
