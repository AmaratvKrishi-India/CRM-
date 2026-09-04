import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Loader2,
  Bell,
  X,
} from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { MinimalLeadsList } from './components/leads/MinimalLeadsList';
import { LeadDetailView } from './components/leads/LeadDetailView';
import { CallOutcomeModal } from './components/leads/CallOutcomeModal';
import { WhatsAppComposeModal } from './components/whatsapp/WhatsAppComposeModal';
import { SalesDashboard } from './components/dashboard/SalesDashboard';
import { FollowUpsView } from './components/followups/FollowUpsView';
import { LoginScreen } from './components/auth/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider, useToast } from './components/common/Toast';
import { CallLifecycleService } from './services/callLifecycleService';
import { RealtimeService } from './services/realtime/realtimeService';
import type { RealtimeInAppNotification } from './services/realtime/realtimeTypes';
import { crmData } from './db';
import type { Lead, CallOutcome, LeadStatus, FollowUpPriority } from './db/types';

// Lazy-load heavy Admin and Settings components for code splitting & faster mobile bundle load
const AdminShell = React.lazy(() =>
  import('./components/admin/AdminShell').then((m) => ({ default: m.AdminShell }))
);
const BackupRestoreModal = React.lazy(() =>
  import('./components/backup/BackupRestoreModal').then((m) => ({ default: m.BackupRestoreModal }))
);
const SettingsModal = React.lazy(() =>
  import('./components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ExcelImporter = React.lazy(() =>
  import('./components/import/ExcelImporter').then((m) => ({ default: m.ExcelImporter }))
);

export type AppNavTab = 'DASHBOARD' | 'LEADS' | 'FOLLOW_UPS' | 'IMPORT' | 'DETAIL';

/** F14 — the three primary nav tabs, in order, for arrow-key navigation. */
const NAV_TABS: AppNavTab[] = ['DASHBOARD', 'LEADS', 'FOLLOW_UPS'];

interface SalesAppContentProps {
  isSalesModeForAdmin?: boolean;
  onReturnToAdmin?: () => void;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8 text-center space-y-2">
      <Loader2 className="w-6 h-6 animate-spin text-accent-text mx-auto" aria-hidden="true" />
      <p className="text-sm text-soft font-medium">Loading component...</p>
    </div>
  );
}

function SalesAppContent({ isSalesModeForAdmin = false, onReturnToAdmin }: SalesAppContentProps) {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<AppNavTab>('DASHBOARD');
  const navTabRefs = useRef<Partial<Record<AppNavTab, HTMLButtonElement | null>>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Filters passed from Dashboard to Lead List
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>('ALL');
  const [leadsLocalityFilter, setLeadsLocalityFilter] = useState<string>('ALL');

  // In-Memory Pending Call State
  const [, setPendingCallLead] = useState<Lead | null>(null);
  const [, setCallStartedAt] = useState<string | null>(null);

  // Call Outcome Modal State
  const [activeOutcomeLead, setActiveOutcomeLead] = useState<Lead | null>(null);
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);

  // WhatsApp Compose Modal State
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState<Lead | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Backup & Restore Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Settings & Templates Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Follow-up Modal State
  const [isFollowUpModalOpen] = useState(false);

  // Badge count for pending follow-ups
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState<number>(0);

  /**
   * F14 — roving-tabindex arrow-key navigation for the bottom nav tablist.
   */
  const handleNavTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, target: AppNavTab) => {
    const idx = NAV_TABS.indexOf(target);
    let next: AppNavTab | null = null;
    if (e.key === 'ArrowRight') next = NAV_TABS[(idx + 1) % NAV_TABS.length];
    else if (e.key === 'ArrowLeft') next = NAV_TABS[(idx - 1 + NAV_TABS.length) % NAV_TABS.length];
    else if (e.key === 'Home') next = NAV_TABS[0];
    else if (e.key === 'End') next = NAV_TABS[NAV_TABS.length - 1];
    if (next) {
      e.preventDefault();
      if (next === 'LEADS') {
        setLeadsStatusFilter('ALL');
        setLeadsLocalityFilter('ALL');
      }
      setTab(next);
      navTabRefs.current[next]?.focus();
    }
  };

  /**
   * Cancels/skips outcome logging and records nothing.
   */
  const handleCancelOutcome = () => {
    CallLifecycleService.cancelCall();
    setPendingCallLead(null);
    setCallStartedAt(null);
    setIsOutcomeModalOpen(false);
    setActiveOutcomeLead(null);
  };

  // Keep latest UI state in a ref to avoid stale closures in the native back-button listener
  const backStateRef = useRef({
    isSettingsModalOpen,
    isBackupModalOpen,
    isWhatsAppModalOpen,
    isOutcomeModalOpen,
    isFollowUpModalOpen,
    tab,
  });

  useEffect(() => {
    backStateRef.current = {
      isSettingsModalOpen,
      isBackupModalOpen,
      isWhatsAppModalOpen,
      isOutcomeModalOpen,
      isFollowUpModalOpen,
      tab,
    };
  }, [isSettingsModalOpen, isBackupModalOpen, isWhatsAppModalOpen, isOutcomeModalOpen, isFollowUpModalOpen, tab]);

  // Android Hardware Back-Button Listener (Robust Promise-based cleanup)
  useEffect(() => {
    let isMounted = true;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const state = backStateRef.current;
      if (state.isSettingsModalOpen) {
        setIsSettingsModalOpen(false);
      } else if (state.isBackupModalOpen) {
        setIsBackupModalOpen(false);
      } else if (state.isWhatsAppModalOpen) {
        setIsWhatsAppModalOpen(false);
        setActiveWhatsAppLead(null);
      } else if (state.isOutcomeModalOpen) {
        setPendingCallLead(null);
        setCallStartedAt(null);
        setIsOutcomeModalOpen(false);
        setActiveOutcomeLead(null);
      } else if (state.tab === 'DETAIL') {
        setSelectedLeadId(null);
        setTab('LEADS');
      } else if (state.tab === 'IMPORT' || state.tab === 'FOLLOW_UPS') {
        setTab('DASHBOARD');
      } else if (state.tab === 'LEADS') {
        setTab('DASHBOARD');
      } else {
        if (isMounted) {
          CapacitorApp.minimizeApp();
        }
      }
    });

    return () => {
      isMounted = false;
      listenerPromise.then((handle) => {
        if (handle) {
          handle.remove();
        }
      }).catch((err) => {
        console.warn('Back button listener cleanup warning:', err);
      });
    };
  }, []);

  // Call lifecycle: drive the DIAL -> BACKGROUND -> FOREGROUND state machine.
  // When the user returns from the native dialer, re-open the outcome modal.
  useEffect(() => {
    let isMounted = true;

    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      const attempt = CallLifecycleService.handleAppStateChange(isActive);
      if (isActive && attempt && isMounted) {
        crmData.leads
          .getLeadById(attempt.leadId)
          .then((lead) => {
            if (!isMounted || !lead) return;
            setActiveOutcomeLead(lead);
            setIsOutcomeModalOpen(true);
          })
          .catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      listenerPromise
        .then((handle) => {
          if (handle) {
            handle.remove();
          }
        })
        .catch((err) => {
          console.warn('App state listener cleanup warning:', err);
        });
    };
  }, []);

  // Update pending follow-ups badge count
  const refreshPendingCount = async () => {
    try {
      const stats = await crmData.leads.getLeadStats();
      setPendingFollowUpsCount(stats.pendingFollowUpsCount);
    } catch {
      // Ignore count fetch failures
    }
  };

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Phone Call Trigger
   */
  const handleCallLead = async (lead: Lead) => {
    if (!currentUser) return;
    try {
      CallLifecycleService.initiateDial(currentUser, lead);
      setPendingCallLead(lead);
      setActiveOutcomeLead(lead);
      setIsOutcomeModalOpen(true);
    } catch (err) {
      console.error('Failed to trigger phone call:', err);
      showToast({
        message: `Could not start the call to ${lead.businessName}. Please try again.`,
        tone: 'error',
      });
    }
  };

  /**
   * Saves call outcome, remark, follow-up, and updates lead status
   */
  const { showToast } = useToast();

  const handleSaveOutcome = async (data: {
    outcome: CallOutcome;
    quickRemark: string | null;
    customNote: string;
    updatedStatus: LeadStatus;
    reportedDurationSeconds?: number | null;
    followUp?: {
      scheduledAt: string;
      title: string;
      notes?: string;
      priority?: FollowUpPriority;
    };
  }) => {
    if (!activeOutcomeLead || !currentUser) return;

    try {
      await CallLifecycleService.completeCall(currentUser, {
        outcome: data.outcome,
        quickRemark: data.quickRemark,
        customNote: data.customNote,
        updatedStatus: data.updatedStatus,
        reportedDurationSeconds: data.reportedDurationSeconds,
      });

      if (data.followUp) {
        await crmData.followUps.scheduleFollowUp({
          leadId: activeOutcomeLead.id,
          userId: currentUser.id,
          scheduledAt: data.followUp.scheduledAt,
          title: data.followUp.title,
          notes: data.followUp.notes || null,
          priority: data.followUp.priority || 'MEDIUM',
        });
      }

      setPendingCallLead(null);
      setCallStartedAt(null);
      setIsOutcomeModalOpen(false);
      setActiveOutcomeLead(null);
      refreshPendingCount();
    } catch (err) {
      console.error('Failed to save call outcome:', err);
      // F4 — surface write failures visibly with a retry action instead of
      // failing silently (the user must not believe the call was logged).
      // The outcome modal stays open; the toast adds a persistent retry.
      const dataForRetry = data;
      showToast({
        message: `Could not save the call outcome for ${activeOutcomeLead?.businessName || 'this lead'}. Your notes were not recorded.`,
        tone: 'error',
        durationMs: 10000,
        action: {
          label: 'Retry',
          onClick: () => void handleSaveOutcome(dataForRetry),
        },
      });
      // Re-throw so CallOutcomeModal shows its inline error banner too.
      throw err;
    }
  };

  /**
   * WhatsApp Modal Trigger
   */
  const handleOpenWhatsApp = (lead: Lead) => {
    setActiveWhatsAppLead(lead);
    setIsWhatsAppModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col justify-between font-sans">
      {/* Return to Admin Banner if in Admin Sales Mode */}
      {isSalesModeForAdmin && onReturnToAdmin && (
        <aside aria-label="Admin sales mode" className="bg-accent-soft text-accent-text px-4 py-2 text-sm flex items-center justify-between shadow-sm sticky top-0 z-40 border-b border-line">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            <span>Field Sales Rep Mode (Admin Preview)</span>
          </div>
          <button
            type="button"
            onClick={onReturnToAdmin}
            className="min-h-11 px-3 bg-accent hover:bg-accent-hover text-on-accent rounded-xl font-bold text-xs transition-colors"
          >
            Back to Admin Shell
          </button>
        </aside>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col min-h-0" aria-label="Field sales workspace">
        <div
          className="flex-1 flex flex-col min-h-0"
          role="tabpanel"
          id="app-tab-panel"
          aria-labelledby={`app-tab-${tab}`}
        >
        {/* TAB 1: DASHBOARD */}
        {tab === 'DASHBOARD' && (
          <SalesDashboard
            onOpenLeadsWithStatus={(st) => {
              setLeadsStatusFilter(st);
              setLeadsLocalityFilter('ALL');
              setTab('LEADS');
            }}
            onOpenLeadsWithLocality={(loc) => {
              setLeadsStatusFilter('ALL');
              setLeadsLocalityFilter(loc);
              setTab('LEADS');
            }}
            onOpenLead={(id) => {
              setSelectedLeadId(id);
              setTab('DETAIL');
            }}
            onCallLead={handleCallLead}
            onOpenWhatsApp={handleOpenWhatsApp}
            onOpenImporter={() => setTab('IMPORT')}
            onOpenFollowUps={() => setTab('FOLLOW_UPS')}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        )}

        {/* TAB 2: LEADS LIST */}
        {tab === 'LEADS' && (
          <MinimalLeadsList
            initialStatusFilter={leadsStatusFilter}
            initialLocalityFilter={leadsLocalityFilter}
            onOpenImporter={() => setTab('IMPORT')}
            onOpenLead={(id) => {
              setSelectedLeadId(id);
              setTab('DETAIL');
            }}
            onCallLead={handleCallLead}
            onOpenWhatsApp={handleOpenWhatsApp}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        )}

        {/* TAB 3: FOLLOW-UPS */}
        {tab === 'FOLLOW_UPS' && (
          <FollowUpsView
            onOpenLead={(id) => {
              setSelectedLeadId(id);
              setTab('DETAIL');
            }}
            onCallLead={handleCallLead}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        )}

        {/* TAB 4: IMPORT (Admin Only) */}
        {tab === 'IMPORT' && (
          <Suspense fallback={<LoadingFallback />}>
            <ExcelImporter
              currentUserId={currentUser?.id || null}
              onImportComplete={() => {
                refreshPendingCount();
                setTab('LEADS');
              }}
              onCancel={() => setTab('DASHBOARD')}
            />
          </Suspense>
        )}

        {/* TAB 5: LEAD DETAIL */}
        {tab === 'DETAIL' && selectedLeadId && (
          <LeadDetailView
            leadId={selectedLeadId}
            onBack={() => {
              setSelectedLeadId(null);
              setTab('LEADS');
            }}
            onCallLead={handleCallLead}
            onOpenOutcomeModal={(lead) => {
              setActiveOutcomeLead(lead);
              setIsOutcomeModalOpen(true);
            }}
            onOpenWhatsApp={handleOpenWhatsApp}
          />
        )}
        </div>
      </main>

      {/* Bottom Mobile Navigation Bar */}
      {tab !== 'DETAIL' && tab !== 'IMPORT' && (
        <nav aria-label="Sales sections" className="sticky bottom-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line px-3 py-1.5 shadow-lg">
          <div
            role="tablist"
            aria-label="Main sections"
            className="max-w-md mx-auto grid grid-cols-3 gap-1"
          >
            {/* DASHBOARD */}
            <button
              type="button"
              ref={(el) => {
                navTabRefs.current['DASHBOARD'] = el;
              }}
              role="tab"
              id="app-tab-DASHBOARD"
              aria-selected={tab === 'DASHBOARD'}
              aria-controls="app-tab-panel"
              tabIndex={tab === 'DASHBOARD' ? 0 : -1}
              onKeyDown={(e) => handleNavTabKeyDown(e, 'DASHBOARD')}
              onClick={() => setTab('DASHBOARD')}
              className={`min-h-11 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'DASHBOARD'
                  ? 'text-accent-text bg-accent-soft font-bold'
                  : 'text-faint hover:text-ink'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span className="text-xs">Dashboard</span>
            </button>

            {/* LEADS LIST */}
            <button
              type="button"
              ref={(el) => {
                navTabRefs.current['LEADS'] = el;
              }}
              role="tab"
              id="app-tab-LEADS"
              aria-selected={tab === 'LEADS'}
              aria-controls="app-tab-panel"
              tabIndex={tab === 'LEADS' ? 0 : -1}
              onKeyDown={(e) => handleNavTabKeyDown(e, 'LEADS')}
              onClick={() => {
                setLeadsStatusFilter('ALL');
                setLeadsLocalityFilter('ALL');
                setTab('LEADS');
              }}
              className={`min-h-11 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'LEADS'
                  ? 'text-accent-text bg-accent-soft font-bold'
                  : 'text-faint hover:text-ink'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span className="text-xs">Leads</span>
            </button>

            {/* FOLLOW-UPS */}
            <button
              type="button"
              ref={(el) => {
                navTabRefs.current['FOLLOW_UPS'] = el;
              }}
              role="tab"
              id="app-tab-FOLLOW_UPS"
              aria-selected={tab === 'FOLLOW_UPS'}
              aria-controls="app-tab-panel"
              tabIndex={tab === 'FOLLOW_UPS' ? 0 : -1}
              onKeyDown={(e) => handleNavTabKeyDown(e, 'FOLLOW_UPS')}
              onClick={() => setTab('FOLLOW_UPS')}
              className={`relative min-h-11 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'FOLLOW_UPS'
                  ? 'text-accent-text bg-accent-soft font-bold'
                  : 'text-faint hover:text-ink'
              }`}
            >
              <div className="relative">
                <Calendar className="w-5 h-5 mb-0.5" aria-hidden="true" />
                {pendingFollowUpsCount > 0 && (
                  <span
                    aria-label={`${pendingFollowUpsCount} pending follow-ups`}
                    className="absolute -top-1 -right-2 bg-danger text-on-accent text-xs font-black min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center"
                  >
                    {pendingFollowUpsCount > 9 ? '9+' : pendingFollowUpsCount}
                  </span>
                )}
              </div>
              <span className="text-xs">Follow-ups</span>
            </button>
          </div>
        </nav>
      )}

      {/* Global Call Outcome & Remark Modal */}
      <CallOutcomeModal
        isOpen={isOutcomeModalOpen}
        lead={activeOutcomeLead}
        onSave={handleSaveOutcome}
        onCancel={handleCancelOutcome}
      />

      {/* Global WhatsApp Compose & Product Catalogue Modal */}
      <WhatsAppComposeModal
        isOpen={isWhatsAppModalOpen}
        lead={activeWhatsAppLead}
        onClose={() => {
          setIsWhatsAppModalOpen(false);
          setActiveWhatsAppLead(null);
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Global CRM Local Backup & Restore Modal (Admin Only, Lazy Loaded) */}
      {isBackupModalOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <BackupRestoreModal
            isOpen={isBackupModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            onDatabaseChanged={() => {
              refreshPendingCount();
            }}
          />
        </Suspense>
      )}

      {/* Global Settings & Pitch Templates Modal (Lazy Loaded) */}
      {isSettingsModalOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            onTemplatesChanged={() => {
              // Template changes propagate dynamically
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function MainAppRouter() {
  const { currentUser, isLoading } = useAuth();
  const [adminSalesMode, setAdminSalesMode] = useState(false);
  const [activeToast, setActiveToast] = useState<RealtimeInAppNotification | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.status === 'ACTIVE') {
      // Give RealtimeService the sync engine so reconnect reconciliation uses
      // incremental pull (cursor-based) instead of a full re-pull from scratch.
      RealtimeService.setSyncEngine(crmData.syncEngine);
      RealtimeService.init(currentUser);

      const unsubNotif = RealtimeService.onNotification((notif) => {
        setActiveToast(notif);
        setTimeout(() => {
          setActiveToast((prev) => (prev?.id === notif.id ? null : prev));
        }, 8000);
      });

      return () => {
        unsubNotif();
        RealtimeService.unsubscribe();
      };
    } else {
      RealtimeService.unsubscribe();
    }
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app text-ink flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent text-accent-text flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold">Amaratv Krishi CRM</p>
        <p className="text-sm text-soft mt-1">Loading secure session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <>
      {/* Global In-App Realtime Toast Banner */}
      {activeToast && (
        <div
          aria-live="polite"
          className="fixed top-3 left-3 right-3 z-50 max-w-md mx-auto animate-in slide-in-from-top duration-300 font-sans"
        >
          <div
            role="status"
            className="bg-elevated border border-line-strong shadow-2xl rounded-2xl p-3 text-ink flex items-start justify-between gap-3 backdrop-blur-md"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-accent-soft text-accent-text shrink-0 mt-0.5">
                <Bell className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-ink">{activeToast.title}</h4>
                <p className="text-sm text-soft mt-0.5 leading-snug">{activeToast.message}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              aria-label="Dismiss notification"
              className="text-faint hover:text-ink p-2 -m-1 rounded-lg hover:bg-inset min-w-11 min-h-11 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {currentUser.role === 'ADMIN' && !adminSalesMode ? (
        <Suspense fallback={<LoadingFallback />}>
          <AdminShell onEnterSalesMode={() => setAdminSalesMode(true)} />
        </Suspense>
      ) : (
        <SalesAppContent
          isSalesModeForAdmin={currentUser.role === 'ADMIN'}
          onReturnToAdmin={() => setAdminSalesMode(false)}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MainAppRouter />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
