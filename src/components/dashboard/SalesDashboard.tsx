import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  PhoneCall,
  MessageSquare,
  Users,
  Calendar,
  AlertTriangle,
  Award,
  Package,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Activity,
  Settings,
  RefreshCw,
  CloudOff,
} from 'lucide-react';
import { crmData } from '../../db';
import type { FullDashboardData } from '../../services/dashboardService';
import type { Lead, LeadStatus } from '../../db/types';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { labelFor } from '../../lib/labels';

interface SalesDashboardProps {
  onOpenLeadsWithStatus: (status: LeadStatus) => void;
  onOpenLeadsWithLocality: (locality: string) => void;
  onOpenLead: (leadId: string) => void;
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenImporter: () => void;
  onOpenFollowUps: () => void;
  onOpenBackupModal: () => void;
  onOpenSettings?: () => void;
}

/** F19 — skeleton placeholder matching the dashboard layout. */
const DashboardSkeleton: React.FC = () => (
  <div className="ui-screen w-full p-4 space-y-5 animate-pulse" aria-hidden="true">
    <div className="space-y-1.5">
      <div className="h-4 w-48 rounded bg-inset" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface border border-line" />
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 w-40 rounded bg-inset" />
      <div className="h-28 rounded-2xl bg-surface border border-line" />
    </div>
    <div className="space-y-2">
      <div className="h-4 w-52 rounded bg-inset" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-surface border border-line" />
        ))}
      </div>
    </div>
  </div>
);

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  onOpenLeadsWithStatus,
  onOpenLeadsWithLocality,
  onOpenLead,
  onCallLead,
  onOpenWhatsApp,
  onOpenImporter,
  onOpenFollowUps,
  onOpenBackupModal,
  onOpenSettings,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<FullDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSecondaryMetricsMobile, setShowSecondaryMetricsMobile] = useState(false);
  const [showFullPipelineMobile, setShowFullPipelineMobile] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await crmData.dashboard.getDashboardData();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      // F4 — never blank the screen on failure; show a retryable error state.
      setLoadError('Could not load your sales metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleCompleteTodayFollowUp = async (id: string) => {
    try {
      await crmData.followUps.completeFollowUp(id);
      await loadDashboard();
    } catch (err) {
      console.error('Failed to complete follow up:', err);
      showToast({
        message: 'Could not mark the follow-up as done. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleCompleteTodayFollowUp(id) },
      });
    }
  };

  const formatTimeOnly = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatActivityTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // F4 — visible error state with retry instead of a blank screen.
  if (loadError && !data) {
    return (
      <div className="min-h-screen bg-app flex flex-col pb-safe-nav ui-screen">
        <div className="ui-topbar px-4 py-4 sticky top-0 z-30">
          <div className="ui-screen flex items-center gap-2">
            <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
            <h1 className="text-base font-bold tracking-tight text-ink">Amaratv Krishi</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
            <CloudOff className="w-10 h-10 text-danger mx-auto" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink">{loadError}</h2>
            <p className="text-sm text-soft">
              Your data is still stored safely on this device. Check the connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="w-full min-h-11 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-app flex flex-col pb-safe-nav ui-screen">
        <div className="ui-topbar px-4 py-4 sticky top-0 z-30">
          <div className="ui-screen flex items-center gap-2">
            <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
            <h1 className="text-base font-bold tracking-tight text-ink">Amaratv Krishi</h1>
          </div>
        </div>
        <DashboardSkeleton />
        <p className="sr-only" role="status">Loading sales metrics…</p>
      </div>
    );
  }

  const { metrics, todayFollowUps, pipeline, localities, recentActivities } = data;

  return (
    <div className="min-h-screen bg-app flex flex-col pb-safe-nav ui-screen">
      {/* Top Brand Header */}
      <div className="ui-topbar px-4 py-3 sticky top-0 z-30">
        <div className="ui-screen flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
              <h1 className="text-base font-bold tracking-tight text-ink">Amaratv Krishi</h1>
            </div>
            <p className="text-xs text-faint">Lucknow Field Sales Dashboard</p>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
            <SyncStatusBadge />
            {currentUser?.role === 'ADMIN' && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Settings and pitch templates"
                className="w-11 h-11 flex items-center justify-center text-soft hover:text-ink bg-inset hover:bg-inset-strong rounded-xl transition-colors"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="min-h-11 bg-inset hover:bg-inset-strong text-soft px-3 rounded-xl font-semibold text-xs transition-colors"
              >
                Backup
              </button>
            )}
            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onOpenImporter}
                className="min-h-11 bg-accent hover:bg-accent-hover text-on-accent px-3 rounded-xl font-bold text-xs transition-colors"
              >
                Import Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="ui-screen w-full p-4 flex-1 flex flex-col space-y-5">
        {/* KPI METRICS GRID */}
        <section className="space-y-1.5" aria-label="Today and pipeline performance">
          <h2 className="text-xs font-bold text-faint uppercase tracking-wide px-1">
            Today & Pipeline Performance
          </h2>

          <div className="ui-kpi-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Total Leads */}
            <div className={`${showSecondaryMetricsMobile ? '' : 'hidden sm:block'} bg-surface p-3 rounded-2xl border border-line shadow-xs`}>
              <div className="flex items-center justify-between text-faint mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Total Leads</span>
                <Users className="hidden sm:block w-3.5 h-3.5 text-info" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-ink">{metrics.totalLeads}</span>
            </div>

            {/* Calls Today */}
            <div className="bg-surface p-3 rounded-2xl border border-line shadow-xs">
              <div className="flex items-center justify-between text-faint mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Calls Today</span>
                <PhoneCall className="hidden sm:block w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-ink">{metrics.callsToday}</span>
            </div>

            {/* WhatsApp Today */}
            <div className={`${showSecondaryMetricsMobile ? '' : 'hidden sm:block'} bg-surface p-3 rounded-2xl border border-line shadow-xs`}>
              <div className="flex items-center justify-between text-faint mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">WA Pitches</span>
                <MessageSquare className="hidden sm:block w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-ink">{metrics.whatsAppToday}</span>
            </div>

            {/* Interested */}
            <button
              type="button"
              onClick={() => onOpenLeadsWithStatus('INTERESTED')}
              className="bg-success-soft hover:bg-success/20 p-3 rounded-2xl border border-success/30 shadow-xs transition-colors text-left"
            >
              <div className="flex items-center justify-between text-success-text mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Interested</span>
                <TrendingUp className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-success-text">{metrics.interested}</span>
            </button>

            {/* Samples Sent / Requested */}
            <button
              type="button"
              onClick={() => onOpenLeadsWithStatus('SAMPLE_REQUESTED')}
              className={`${showSecondaryMetricsMobile ? '' : 'hidden sm:block'} bg-warning-soft hover:bg-warning/20 p-3 rounded-2xl border border-warning/30 shadow-xs transition-colors text-left`}
            >
              <div className="flex items-center justify-between text-warning-text mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Samples</span>
                <Package className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-warning-text">{metrics.samplesRequested}</span>
            </button>

            {/* Customers */}
            <button
              type="button"
              onClick={() => onOpenLeadsWithStatus('CUSTOMER')}
              className="bg-success hover:opacity-90 p-3 rounded-2xl border border-success text-on-accent shadow-xs transition-colors text-left"
            >
              <div className="flex items-center justify-between text-on-accent mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Customers</span>
                <Award className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-on-accent">{metrics.customers}</span>
            </button>

            {/* Follow-ups Today */}
            <button
              type="button"
              onClick={onOpenFollowUps}
              className="bg-surface p-3 rounded-2xl border border-line shadow-xs hover:border-line-strong transition-colors text-left"
            >
              <div className="flex items-center justify-between text-faint mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Due Today</span>
                <Calendar className="hidden sm:block w-3.5 h-3.5 text-info" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-ink">{metrics.followUpsToday}</span>
            </button>

            {/* Overdue */}
            <button
              type="button"
              onClick={onOpenFollowUps}
              className="bg-danger-soft hover:bg-danger/20 p-3 rounded-2xl border border-danger/30 shadow-xs transition-colors text-left"
            >
              <div className="flex items-center justify-between text-danger-text mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Overdue</span>
                <AlertTriangle className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-danger-text">{metrics.overdueFollowUps}</span>
            </button>

            {/* Uncontacted Leads */}
            <button
              type="button"
              onClick={() => onOpenLeadsWithStatus('NEW')}
              className="bg-surface p-3 rounded-2xl border border-line shadow-xs hover:border-line-strong transition-colors text-left"
            >
              <div className="flex items-center justify-between text-faint mb-1">
                <span className="text-xs font-bold uppercase tracking-tight">Uncontacted</span>
                <Users className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <span className="text-xl font-black text-ink">{metrics.notContacted}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSecondaryMetricsMobile((value) => !value)}
            aria-expanded={showSecondaryMetricsMobile}
            className="sm:hidden w-full min-h-11 rounded-xl border border-line bg-surface hover:bg-inset text-sm font-semibold text-accent-text transition-colors"
          >
            {showSecondaryMetricsMobile ? 'Hide secondary metrics' : 'Show 3 more metrics'}
          </button>
        </section>

        {/* SECTION 2: TODAY'S FOLLOW-UPS PROMINENT SECTION */}
        <section className="space-y-2" aria-label="Today's follow-ups">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-accent-text" aria-hidden="true" />
              <span>Today's Follow-ups ({todayFollowUps.length})</span>
            </h2>
            <button
              type="button"
              onClick={onOpenFollowUps}
              className="min-h-11 px-2 text-xs font-bold text-accent-text flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {todayFollowUps.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line p-6 text-center space-y-1.5 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-accent mx-auto" aria-hidden="true" />
              <h3 className="text-sm font-bold text-ink">No Follow-ups Due Today</h3>
              <p className="text-xs text-faint">
                You are all caught up for today! Call new gym leads or review sample feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayFollowUps.slice(0, 3).map((item) => {
                const lead = item.lead;
                const isMobile = lead?.phoneType === 'mobile';

                return (
                  <div
                    key={item.id}
                    className="bg-surface rounded-2xl border border-accent/30 p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* F3 — real button instead of a clickable div */}
                      <button
                        type="button"
                        onClick={() => onOpenLead(item.leadId)}
                        className="flex-1 min-w-0 text-left group"
                      >
                        <h3 className="text-sm font-bold text-ink group-hover:text-accent-text truncate">
                          {lead?.businessName || 'Gym Lead'}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-soft mt-0.5">
                          <MapPin className="w-3 h-3 text-faint" aria-hidden="true" />
                          <span>{lead?.locality || 'Lucknow'}</span>
                          <span className="text-faint">•</span>
                          <span className="font-semibold text-info-text">
                            {formatTimeOnly(item.scheduledAt)}
                          </span>
                        </div>
                      </button>

                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-info-soft text-info-text border border-info/30">
                        {labelFor(item.priority)}
                      </span>
                    </div>

                    <p className="text-xs text-soft font-medium bg-inset p-2 rounded-lg border border-line">
                      {item.title}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
                      <button
                        type="button"
                        onClick={() => handleCompleteTodayFollowUp(item.id)}
                        className="min-h-11 text-xs font-bold text-accent-text bg-accent-soft hover:bg-accent/20 border border-accent/30 px-3 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Mark Done</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => onOpenWhatsApp(lead as Lead)}
                            className="min-h-11 px-3 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>WhatsApp</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onCallLead(lead as Lead)}
                          className="min-h-11 px-3 bg-ink hover:opacity-90 text-app rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                          <span>Call</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3: SALES PIPELINE SUMMARY (CLICKABLE) */}
        <section className="space-y-2" aria-label="Sales pipeline">
          <h2 className="text-sm font-bold text-ink px-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <span>Sales Pipeline (Tap to Filter Leads)</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pipeline.map((stage, index) => (
              <button
                key={stage.status}
                type="button"
                onClick={() => onOpenLeadsWithStatus(stage.status)}
                className={`${index >= 4 && !showFullPipelineMobile ? 'hidden sm:flex' : 'flex'} bg-surface hover:bg-inset p-3 min-h-11 rounded-2xl border border-line shadow-xs transition-all items-center justify-between group text-left`}
              >
                <div>
                  <span className="text-xs font-bold text-soft block truncate group-hover:text-accent-text">
                    {stage.label}
                  </span>
                  <span className="text-base font-black text-ink">{stage.count}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent-text transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            ))}
          </div>
          {pipeline.length > 4 && (
            <button
              type="button"
              onClick={() => setShowFullPipelineMobile((value) => !value)}
              aria-expanded={showFullPipelineMobile}
              className="sm:hidden w-full min-h-11 rounded-xl border border-line bg-surface hover:bg-inset text-sm font-semibold text-accent-text transition-colors"
            >
              {showFullPipelineMobile ? 'Show fewer pipeline stages' : `Show all ${pipeline.length} pipeline stages`}
            </button>
          )}
        </section>

        {/* SECTION 4: LOCALITY SUMMARY */}
        {localities.length > 0 && (
          <section className="space-y-2" aria-label="Localities breakdown">
            <h2 className="text-sm font-bold text-ink px-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-accent-text" aria-hidden="true" />
              <span>Lucknow Localities Breakdown</span>
            </h2>

            <div className="bg-surface rounded-2xl border border-line p-3 shadow-xs space-y-1">
              <div className="grid grid-cols-3 text-xs font-bold text-faint uppercase tracking-tight px-2 pb-1 border-b border-line">
                <span>Locality / Area</span>
                <span className="text-center">Total Leads</span>
                <span className="text-right">Interested/Cust</span>
              </div>

              <div>
                {localities.map((loc) => (
                  <button
                    key={loc.locality}
                    type="button"
                    onClick={() => onOpenLeadsWithLocality(loc.locality)}
                    className="w-full grid grid-cols-3 items-center py-2.5 px-2 text-xs hover:bg-inset rounded-lg transition-colors text-left"
                  >
                    <span className="font-bold text-ink truncate">{loc.locality}</span>
                    <span className="text-center font-semibold text-soft">{loc.total}</span>
                    <div className="text-right flex items-center justify-end gap-1 font-bold">
                      <span className="text-accent-text">{loc.interested + loc.customers}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: RECENT ACTIVITY FEED */}
        <section className="space-y-2" aria-label="Recent activity">
          <h2 className="text-sm font-bold text-ink px-1 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-accent-text" aria-hidden="true" />
            <span>Recent Activity Stream</span>
          </h2>

          {recentActivities.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line p-6 text-center text-xs text-faint">
              No sales activity recorded yet.
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-line divide-y divide-line shadow-xs overflow-hidden">
              {recentActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onOpenLead(act.leadId)}
                  className="w-full p-3 hover:bg-inset transition-colors flex items-start gap-2.5 text-left"
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white mt-0.5 ${
                      act.type === 'CALL'
                        ? 'bg-ink'
                        : act.type === 'WHATSAPP'
                        ? 'bg-accent'
                        : act.type === 'FOLLOW_UP_COMPLETED'
                        ? 'bg-info'
                        : 'bg-warning'
                    }`}
                    aria-hidden="true"
                  >
                    {act.type === 'CALL' ? (
                      <PhoneCall className="w-3.5 h-3.5 text-success" />
                    ) : act.type === 'WHATSAPP' ? (
                      <MessageSquare className="w-3.5 h-3.5" />
                    ) : act.type === 'FOLLOW_UP_COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-xs font-bold text-ink truncate">
                        {act.businessName}
                      </h3>
                      <span className="text-xs text-faint flex-shrink-0">
                        {formatActivityTime(act.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-soft font-medium truncate">{act.title}</p>
                    {act.detail && (
                      <p className="text-xs text-faint truncate mt-0.5">{act.detail}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
