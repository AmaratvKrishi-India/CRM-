/**
 * Admin Data Management Hub (Phase 2K)
 * Dedicated Admin-only section for central CRM data governance:
 * - 1. Lead Database Explorer (all leads, multi-filter, search, source batch tracking)
 * - 2. Import Center (Excel/CSV ingestion, preview, import audit history)
 * - 3. Data Quality & Duplicate Cleanup (duplicate detection, safe soft-deletion)
 * - 4. Database Health & Sync Inspector (sync outbox status, agent assignment metrics)
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  FileSpreadsheet,
  Trash2,
  Activity,
  Search,
  Filter,
  Users,
  Building2,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { crmData } from '../../../db';
import { Lead, User, ImportAudit, LeadStatus } from '../../../db/types';
import { ExcelImporter } from '../../import/ExcelImporter';
import { AgentManagementService } from '../../../services/agentManagementService';
import { LeadAssignmentService } from '../../../services/leadAssignmentService';

export type DataSubTab = 'DATABASE' | 'IMPORTS' | 'CLEANUP' | 'HEALTH';

export const AdminDataManagementView: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<DataSubTab>('DATABASE');

  // Sub-tab 1: Database Explorer State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [localityFilter, setLocalityFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [localities, setLocalities] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Sub-tab 2: Import Center State
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importAudits, setImportAudits] = useState<ImportAudit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  // Sub-tab 3: Cleanup & Duplicates State
  const [duplicateClusters, setDuplicateClusters] = useState<Array<{ phone: string; leads: Lead[] }>>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);

  // Sub-tab 4: Health Metrics State
  const [healthStats, setHealthStats] = useState<{
    totalLeads: number;
    assignedLeads: number;
    unassignedLeads: number;
    activeAgents: number;
    inactiveAgents: number;
    totalCalls: number;
    verifiedCalls: number;
    pendingSyncCount: number;
    failedSyncCount: number;
    lastSyncTimestamp: string | null;
  }>({
    totalLeads: 0,
    assignedLeads: 0,
    unassignedLeads: 0,
    activeAgents: 0,
    inactiveAgents: 0,
    totalCalls: 0,
    verifiedCalls: 0,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    lastSyncTimestamp: null,
  });
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Load Initial Reference Data
  useEffect(() => {
    if (currentUser && currentUser.role === 'ADMIN') {
      loadInitialData();
    }
  }, [currentUser]);

  const loadInitialData = async () => {
    try {
      const agentList = await AgentManagementService.getAgents(currentUser);
      setAgents(agentList);

      const distinctLocs = await crmData.leads.getDistinctLocalities();
      setLocalities(distinctLocs);
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  };

  // Load Data based on active tab
  useEffect(() => {
    if (activeSubTab === 'DATABASE') {
      loadDatabaseExplorer();
    } else if (activeSubTab === 'IMPORTS') {
      loadImportAudits();
    } else if (activeSubTab === 'CLEANUP') {
      loadDuplicates();
    } else if (activeSubTab === 'HEALTH') {
      loadHealthMetrics();
    }
  }, [activeSubTab, searchTerm, statusFilter, localityFilter, sourceFilter]);

  const loadDatabaseExplorer = async () => {
    setLoadingLeads(true);
    try {
      const filter: {
        searchTerm?: string;
        status?: LeadStatus;
        locality?: string;
        limit?: number;
      } = {
        searchTerm: searchTerm.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as LeadStatus) : undefined,
        locality: localityFilter !== 'ALL' ? localityFilter : undefined,
        limit: 200,
      };

      const result = await crmData.leads.searchAndFilterLeads(filter);
      let filtered = result.leads;
      if (sourceFilter !== 'ALL') {
        filtered = filtered.filter((l) => l.source === sourceFilter);
      }

      setLeads(filtered);
      setTotalLeadsCount(result.total);

      // Extract unique sources
      const allSources = Array.from(new Set(result.leads.map((l) => l.source).filter(Boolean)));
      setSources(allSources);
    } catch (err) {
      console.error('Failed to load database explorer leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadImportAudits = async () => {
    setLoadingAudits(true);
    try {
      const audits = await crmData.importAudits.getAuditHistory(50);
      setImportAudits(audits);
    } catch (err) {
      console.error('Failed to load import audits:', err);
    } finally {
      setLoadingAudits(false);
    }
  };

  const loadDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const allLeads = await crmData.db.leads.filter((l) => l.deletedAt === null).toArray();
      const phoneMap = new Map<string, Lead[]>();

      for (const lead of allLeads) {
        const cleanPhone = (lead.phone || '').trim();
        if (!cleanPhone) continue;

        if (!phoneMap.has(cleanPhone)) {
          phoneMap.set(cleanPhone, []);
        }
        phoneMap.get(cleanPhone)!.push(lead);
      }

      const clusters: Array<{ phone: string; leads: Lead[] }> = [];
      for (const [phone, group] of phoneMap.entries()) {
        if (group.length > 1) {
          clusters.push({ phone, leads: group });
        }
      }

      setDuplicateClusters(clusters);
    } catch (err) {
      console.error('Failed to detect duplicates:', err);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const loadHealthMetrics = async () => {
    setLoadingHealth(true);
    try {
      const assignmentStats = await LeadAssignmentService.getAssignmentStats(currentUser);
      const allAgents = await AgentManagementService.getAgents(currentUser);
      const activeAgents = allAgents.filter((a) => a.status === 'ACTIVE').length;
      const inactiveAgents = allAgents.filter((a) => a.status === 'INACTIVE').length;

      const allCalls = await crmData.db.callRecords.toArray();
      const verifiedCalls = allCalls.filter((c) => c.verificationStatus === 'VERIFIED').length;

      const outboxItems = await crmData.db.outbox.toArray();
      const pendingSync = outboxItems.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING').length;
      const failedSync = outboxItems.filter((i) => i.status === 'FAILED').length;

      const syncState = await crmData.syncStateRepo.getSyncState();

      setHealthStats({
        totalLeads: assignmentStats.totalLeads,
        assignedLeads: assignmentStats.assignedCount,
        unassignedLeads: assignmentStats.unassignedCount,
        activeAgents,
        inactiveAgents,
        totalCalls: allCalls.length,
        verifiedCalls,
        pendingSyncCount: pendingSync,
        failedSyncCount: failedSync,
        lastSyncTimestamp: syncState?.lastSuccessfulSyncAt || syncState?.lastPushAt || syncState?.lastPullAt || null,
      });
    } catch (err) {
      console.error('Failed to load health metrics:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleArchiveDuplicate = async (leadId: string) => {
    try {
      await crmData.leads.softDeleteLead(leadId);
      setCleanupSuccessMessage('Duplicate lead archived successfully.');
      setTimeout(() => setCleanupSuccessMessage(null), 3000);
      await loadDuplicates();
    } catch (err) {
      console.error('Failed to archive lead:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-white font-sans">
      {/* Sub-Navigation Tabs */}
      <div className="bg-slate-800/80 border-b border-slate-700 p-2 flex items-center gap-1 overflow-x-auto scrollbar-none sticky top-0 z-20">
        <button
          type="button"
          onClick={() => setActiveSubTab('DATABASE')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'DATABASE'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Lead Explorer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('IMPORTS')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'IMPORTS'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Import Center</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('CLEANUP')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'CLEANUP'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Data Cleanup</span>
          {duplicateClusters.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
              {duplicateClusters.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('HEALTH')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'HEALTH'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Database Health</span>
        </button>
      </div>

      {/* Main Sub-Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* SUB-TAB 1: LEAD DATABASE EXPLORER */}
        {activeSubTab === 'DATABASE' && (
          <div className="space-y-3">
            {/* Filters Bar */}
            <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search organization database (name, phone, locality)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="INTERESTED">INTERESTED</option>
                  <option value="SAMPLE_REQUESTED">SAMPLE_REQUESTED</option>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="WRONG_NUMBER">WRONG_NUMBER</option>
                </select>

                <select
                  value={localityFilter}
                  onChange={(e) => setLocalityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="ALL">All Localities ({localities.length})</option>
                  {localities.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>

                {sources.length > 0 && (
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white col-span-2 sm:col-span-1"
                  >
                    <option value="ALL">All Sources ({sources.length})</option>
                    {sources.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Total Indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Matching Leads: <strong className="text-white">{leads.length}</strong> / {totalLeadsCount} total
              </span>
            </div>

            {/* Leads Table */}
            {loadingLeads ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading database records...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="py-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50">
                <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-bold text-slate-300 mt-2">No Leads Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or importing a new dataset.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const assignee = agents.find((a) => a.id === lead.assignedTo);

                  return (
                    <div
                      key={lead.id}
                      className="p-3 bg-slate-800/80 border border-slate-700/70 rounded-2xl space-y-1.5 hover:border-slate-600 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{lead.businessName}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold text-[10px]">
                          {lead.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {lead.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {lead.locality}
                        </span>
                        <span className="text-purple-300 truncate">
                          {assignee ? `Agent: ${assignee.name}` : 'Unassigned'}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-700/50">
                        <span>Source: {lead.source || 'Manual'}</span>
                        <span>Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: IMPORT CENTER */}
        {activeSubTab === 'IMPORTS' && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-purple-900/40 to-slate-800 border border-purple-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">Excel / CSV Spreadsheet Ingestion</h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Import organization lead batches with auto-mapping & duplicate prevention.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImporterOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 active:scale-95 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Launch Importer</span>
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                Batch Import History
              </h4>

              {loadingAudits ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400 mx-auto" />
                </div>
              ) : importAudits.length === 0 ? (
                <div className="py-8 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50">
                  <FileSpreadsheet className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">No spreadsheet imports logged yet.</p>
                </div>
              ) : (
                importAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{audit.filename}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(audit.completedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                      <div className="p-1.5 bg-slate-900/60 rounded-xl">
                        <span className="text-[10px] text-slate-400 block">Total</span>
                        <strong className="text-white font-bold">{audit.totalRows}</strong>
                      </div>
                      <div className="p-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-300 block">Imported</span>
                        <strong className="text-emerald-400 font-bold">{audit.imported}</strong>
                      </div>
                      <div className="p-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <span className="text-[10px] text-blue-300 block">Updated</span>
                        <strong className="text-blue-400 font-bold">{audit.updated}</strong>
                      </div>
                      <div className="p-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <span className="text-[10px] text-amber-300 block">Skipped</span>
                        <strong className="text-amber-400 font-bold">{audit.duplicates}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Importer Modal */}
            {isImporterOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                  <ExcelImporter
                    onImportComplete={() => {
                      setIsImporterOpen(false);
                      loadImportAudits();
                    }}
                    onCancel={() => setIsImporterOpen(false)}
                    currentUserId={currentUser?.id || null}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: DATA CLEANUP & DUPLICATES */}
        {activeSubTab === 'CLEANUP' && (
          <div className="space-y-4">
            {cleanupSuccessMessage && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{cleanupSuccessMessage}</span>
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200">
                <p className="font-bold">Non-Destructive Duplicate Management</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Reviewing duplicates flags conflicting records for archival. Associated call records and historical notes are permanently retained.
                </p>
              </div>
            </div>

            {loadingDuplicates ? (
              <div className="py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Scanning database for duplicate phone numbers...</p>
              </div>
            ) : duplicateClusters.length === 0 ? (
              <div className="py-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">Database is Clean</h4>
                <p className="text-[11px] text-slate-400">Zero duplicate phone numbers found across active leads.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Found <strong className="text-white">{duplicateClusters.length}</strong> duplicate phone clusters:
                </div>

                {duplicateClusters.map((cluster) => (
                  <div
                    key={cluster.phone}
                    className="p-3 bg-slate-800/90 border border-amber-500/30 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 font-mono flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {cluster.phone}
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                        {cluster.leads.length} Records
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {cluster.leads.map((lead, idx) => (
                        <div
                          key={lead.id}
                          className="p-2 bg-slate-900/70 rounded-xl flex items-center justify-between text-xs gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{lead.businessName}</p>
                            <p className="text-[10px] text-slate-400">
                              {lead.locality} • Status: {lead.status} • Calls: {lead.callCount}
                            </p>
                          </div>

                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleArchiveDuplicate(lead.id)}
                              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold transition-colors shrink-0"
                            >
                              Archive Duplicate
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 4: DATABASE HEALTH & SYNC STATUS */}
        {activeSubTab === 'HEALTH' && (
          <div className="space-y-4">
            {loadingHealth ? (
              <div className="py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400 mx-auto" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Lead Distribution
                    </span>
                    <p className="text-xl font-black text-white mt-1">{healthStats.totalLeads}</p>
                    <div className="flex gap-2 text-[11px] mt-1.5">
                      <span className="text-emerald-400">Assigned: {healthStats.assignedLeads}</span>
                      <span className="text-amber-400">Unassigned: {healthStats.unassignedLeads}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sales Representatives
                    </span>
                    <p className="text-xl font-black text-white mt-1">
                      {healthStats.activeAgents + healthStats.inactiveAgents}
                    </p>
                    <div className="flex gap-2 text-[11px] mt-1.5">
                      <span className="text-emerald-400">Active: {healthStats.activeAgents}</span>
                      <span className="text-slate-400">Inactive: {healthStats.inactiveAgents}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Call Operations
                    </span>
                    <p className="text-xl font-black text-white mt-1">{healthStats.totalCalls}</p>
                    <p className="text-[11px] text-blue-400 mt-1.5">
                      Verified Calls: {healthStats.verifiedCalls}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-800 border border-slate-700 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Cloud Sync Outbox
                    </span>
                    <p className="text-xl font-black text-white mt-1">{healthStats.pendingSyncCount}</p>
                    <div className="flex gap-2 text-[11px] mt-1.5">
                      <span className={healthStats.failedSyncCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        Failed: {healthStats.failedSyncCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-800/70 border border-slate-700/80 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Last Successful Sync:</span>
                    <span className="font-mono text-slate-200">
                      {healthStats.lastSyncTimestamp
                        ? new Date(healthStats.lastSyncTimestamp).toLocaleString()
                        : 'Never (Offline)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className="font-semibold text-purple-300">IndexedDB (Dexie v5)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cloud Sync Authority:</span>
                    <span className="font-semibold text-emerald-400">Supabase PostgreSQL + RLS</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
