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
  Clock,
  MapPin,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Activity,
  Plus,
  Settings,
} from 'lucide-react';
import { crmData } from '../../db';
import {
  FullDashboardData,
  DashboardMetrics,
} from '../../services/dashboardService';
import { Lead, LeadStatus } from '../../db/types';
import { SyncStatusBadge } from '../sync/SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';

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
  const [data, setData] = useState<FullDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await crmData.dashboard.getDashboardData();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading sales metrics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, todayFollowUps, pipeline, localities, recentActivities } = data;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Top Brand Header */}
      <div className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-base font-bold tracking-tight">Amaratv Krishi</h1>
            </div>
            <p className="text-[11px] text-slate-400">Lucknow Field Sales Dashboard</p>
          </div>

          <div className="flex items-center gap-1.5">
            <SyncStatusBadge />
            {currentUser?.role === 'ADMIN' && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                title="Settings & Pitch Templates"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-colors"
                title="Backup & Restore local database"
              >
                Backup
              </button>
            )}
            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onOpenImporter}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-colors"
              >
                Import Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-5">
        {/* KPI METRICS GRID */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Today & Pipeline Performance
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {/* Total Leads */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Total Leads</span>
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-lg font-black text-slate-900">{metrics.totalLeads}</span>
            </div>

            {/* Calls Today */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Calls Today</span>
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-lg font-black text-slate-900">{metrics.callsToday}</span>
            </div>

            {/* WhatsApp Today */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">WA Pitches</span>
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-lg font-black text-slate-900">{metrics.whatsAppToday}</span>
            </div>

            {/* Interested */}
            <div
              onClick={() => onOpenLeadsWithStatus('INTERESTED')}
              className="bg-emerald-50/50 hover:bg-emerald-50 p-3 rounded-2xl border border-emerald-200 shadow-xs cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Interested</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-lg font-black text-emerald-900">{metrics.interested}</span>
            </div>

            {/* Samples Sent / Requested */}
            <div
              onClick={() => onOpenLeadsWithStatus('SAMPLE_REQUESTED')}
              className="bg-amber-50/50 hover:bg-amber-50 p-3 rounded-2xl border border-amber-200 shadow-xs cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between text-amber-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Samples</span>
                <Package className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <span className="text-lg font-black text-amber-900">{metrics.samplesRequested}</span>
            </div>

            {/* Customers */}
            <div
              onClick={() => onOpenLeadsWithStatus('CUSTOMER')}
              className="bg-emerald-700 p-3 rounded-2xl border border-emerald-800 text-white shadow-xs cursor-pointer hover:bg-emerald-800 transition-colors"
            >
              <div className="flex items-center justify-between text-emerald-200 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Customers</span>
                <Award className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span className="text-lg font-black text-white">{metrics.customers}</span>
            </div>

            {/* Follow-ups Today */}
            <div
              onClick={onOpenFollowUps}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Due Today</span>
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-lg font-black text-slate-900">{metrics.followUpsToday}</span>
            </div>

            {/* Overdue */}
            <div
              onClick={onOpenFollowUps}
              className="bg-rose-50/60 p-3 rounded-2xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-50 transition-colors"
            >
              <div className="flex items-center justify-between text-rose-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Overdue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <span className="text-lg font-black text-rose-700">{metrics.overdueFollowUps}</span>
            </div>

            {/* Uncontacted Leads */}
            <div
              onClick={() => onOpenLeadsWithStatus('NEW')}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight">Uncontacted</span>
                <Users className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-lg font-black text-slate-700">{metrics.notContacted}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: TODAY'S FOLLOW-UPS PROMINENT SECTION */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Today's Follow-ups ({todayFollowUps.length})</span>
            </h2>
            <button
              type="button"
              onClick={onOpenFollowUps}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayFollowUps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-1.5 shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800">No Follow-ups Due Today</h4>
              <p className="text-[11px] text-slate-400">
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
                    className="bg-white rounded-2xl border border-emerald-200 p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => onOpenLead(item.leadId)}
                        className="flex-1 min-w-0 cursor-pointer group"
                      >
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                          {lead?.businessName || 'Gym Lead'}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{lead?.locality || 'Lucknow'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-blue-700">
                            {formatTimeOnly(item.scheduledAt)}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        {item.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {item.title}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCompleteTodayFollowUp(item.id)}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mark Done</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => onOpenWhatsApp(lead as any)}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onCallLead(lead as any)}
                          className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                        >
                          <PhoneCall className="w-3 h-3 text-emerald-400" />
                          <span>Call</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: SALES PIPELINE SUMMARY (CLICKABLE) */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight px-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Sales Pipeline (Tap to Filter Leads)</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pipeline.map((stage) => (
              <div
                key={stage.status}
                onClick={() => onOpenLeadsWithStatus(stage.status)}
                className="bg-white hover:bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block truncate group-hover:text-emerald-700">
                    {stage.label}
                  </span>
                  <span className="text-base font-black text-slate-900">{stage.count}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: LOCALITY SUMMARY */}
        {localities.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight px-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Lucknow Localities Breakdown</span>
            </h2>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
              <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight px-2 pb-1 border-b border-slate-100">
                <span>Locality / Area</span>
                <span className="text-center">Total Leads</span>
                <span className="text-right">Interested/Cust</span>
              </div>

              <div className="divide-y divide-slate-100">
                {localities.map((loc) => (
                  <div
                    key={loc.locality}
                    onClick={() => onOpenLeadsWithLocality(loc.locality)}
                    className="grid grid-cols-3 items-center py-2 px-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="font-bold text-slate-800 truncate">{loc.locality}</span>
                    <span className="text-center font-semibold text-slate-700">{loc.total}</span>
                    <div className="text-right flex items-center justify-end gap-1 font-bold">
                      <span className="text-emerald-700">{loc.interested + loc.customers}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: RECENT ACTIVITY FEED */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight px-1 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Recent Activity Stream</span>
          </h2>

          {recentActivities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400">
              No sales activity recorded yet.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => onOpenLead(act.leadId)}
                  className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-2.5"
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white mt-0.5 ${
                      act.type === 'CALL'
                        ? 'bg-slate-900'
                        : act.type === 'WHATSAPP'
                        ? 'bg-emerald-600'
                        : act.type === 'FOLLOW_UP_COMPLETED'
                        ? 'bg-blue-600'
                        : 'bg-amber-600'
                    }`}
                  >
                    {act.type === 'CALL' ? (
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
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
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {act.businessName}
                      </h4>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatActivityTime(act.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 font-medium truncate">{act.title}</p>
                    {act.detail && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{act.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
