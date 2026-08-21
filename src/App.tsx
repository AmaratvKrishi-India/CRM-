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
import { CallLifecycleService } from './services/callLifecycleService';
import { RealtimeService } from './services/realtime/realtimeService';
import { RealtimeInAppNotification } from './services/realtime/realtimeTypes';
import { crmData } from './db';
import { Lead, CallOutcome, LeadStatus, FollowUpPriority } from './db/types';

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

interface SalesAppContentProps {
  isSalesModeForAdmin?: boolean;
  onReturnToAdmin?: () => void;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8 text-center space-y-2">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
      <p className="text-xs text-slate-500 font-medium">Loading component...</p>
    </div>
  );
}

function SalesAppContent({ isSalesModeForAdmin = false, onReturnToAdmin }: SalesAppContentProps) {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<AppNavTab>('DASHBOARD');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Filters passed from Dashboard to Lead List
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>('ALL');
  const [leadsLocalityFilter, setLeadsLocalityFilter] = useState<string>('ALL');

  // In-Memory Pending Call State
  const [pendingCallLead, setPendingCallLead] = useState<Lead | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);

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
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Badge count for pending follow-ups
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState<number>(0);

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
    }
  };

  /**
   * Saves call outcome, remark, follow-up, and updates lead status
   */
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Return to Admin Banner if in Admin Sales Mode */}
      {isSalesModeForAdmin && onReturnToAdmin && (
        <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>Field Sales Rep Mode (Admin Preview)</span>
          </div>
          <button
            type="button"
            onClick={onReturnToAdmin}
            className="px-2.5 py-1 bg-purple-800 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-colors"
          >
            Back to Admin Shell
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
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

      {/* Bottom Mobile Navigation Bar */}
      {tab !== 'DETAIL' && tab !== 'IMPORT' && (
        <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-lg">
          <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
            {/* DASHBOARD */}
            <button
              type="button"
              onClick={() => setTab('DASHBOARD')}
              className={`py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'DASHBOARD'
                  ? 'text-emerald-700 bg-emerald-50/70 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] uppercase tracking-tight">Dashboard</span>
            </button>

            {/* LEADS LIST */}
            <button
              type="button"
              onClick={() => {
                setLeadsStatusFilter('ALL');
                setLeadsLocalityFilter('ALL');
                setTab('LEADS');
              }}
              className={`py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'LEADS'
                  ? 'text-emerald-700 bg-emerald-50/70 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] uppercase tracking-tight">Leads</span>
            </button>

            {/* FOLLOW-UPS */}
            <button
              type="button"
              onClick={() => setTab('FOLLOW_UPS')}
              className={`relative py-1.5 px-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                tab === 'FOLLOW_UPS'
                  ? 'text-emerald-700 bg-emerald-50/70 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Calendar className="w-5 h-5 mb-0.5" />
                {pendingFollowUpsCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {pendingFollowUpsCount > 9 ? '9+' : pendingFollowUpsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-tight">Follow-ups</span>
            </button>
          </div>
        </div>
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
      RealtimeService.init(currentUser);

      const unsubNotif = RealtimeService.onNotification((notif) => {
        setActiveToast(notif);
        setTimeout(() => {
          setActiveToast((prev) => (prev?.id === notif.id ? null : prev));
        }, 5000);
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
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
        <p className="text-sm font-bold">Amaratv Krishi CRM</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Loading secure session...</p>
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
        <div className="fixed top-3 left-3 right-3 z-50 max-w-md mx-auto animate-in slide-in-from-top duration-300 font-sans">
          <div className="bg-slate-900/95 border border-purple-500/50 shadow-2xl rounded-2xl p-3 text-white flex items-start justify-between gap-3 backdrop-blur-md">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white">{activeToast.title}</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug">{activeToast.message}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
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
        <AuthProvider>
          <MainAppRouter />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
