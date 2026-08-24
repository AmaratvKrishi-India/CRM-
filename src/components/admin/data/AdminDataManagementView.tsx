/**
 * Admin Data Management Hub (Phase 2K)
 * Dedicated Admin-only section for central CRM data governance:
 * - 1. Lead Database Explorer (all leads, multi-filter, search, source batch tracking)
 * - 2. Import Center (Excel/CSV ingestion, preview, import audit history)
 * - 3. Data Quality & Duplicate Cleanup (duplicate detection, safe soft-deletion)
 * - 4. Database Health & Sync Inspector (sync outbox status, agent assignment metrics)
 *
 * UX remediation pass: design tokens (F1/F12), tablist ARIA + keyboard nav (F14),
 * debounced search (F10), human-readable enum labels (F15), visible error + retry
 * states (F4), shared accessible Modal for the importer (F5), 44px targets (F6).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  FileSpreadsheet,
  Trash2,
  Activity,
  Search,
  Building2,
  Phone,
  MapPin,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Archive,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { crmData } from '../../../db';
import { Lead, User, ImportAudit, LeadStatus } from '../../../db/types';
import { ExcelImporter } from '../../import/ExcelImporter';
import { AgentManagementService } from '../../../services/agentManagementService';
import { LeadAssignmentService } from '../../../services/leadAssignmentService';
import { Modal } from '../../common/Modal';
import { useToast } from '../../common/Toast';
import { labelFor } from '../../../lib/labels';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';

export type DataSubTab = 'DATABASE' | 'IMPORTS' | 'CLEANUP' | 'HEALTH';

const TAB_ORDER: DataSubTab[] = ['DATABASE', 'IMPORTS', 'CLEANUP', 'HEALTH'];

const STATUS_FILTERS: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'SAMPLE_REQUESTED',
  'CUSTOMER',
  'WRONG_NUMBER',
];

const SELECT_CLASSES =
  'min-h-11 w-full bg-inset border border-line rounded-xl px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring';

export const AdminDataManagementView: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<DataSubTab>('DATABASE');
  const tabRefs = useRef<Partial<Record<DataSubTab, HTMLButtonElement | null>>>({});

  // Sub-tab 1: Database Explorer State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [localityFilter, setLocalityFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [localities, setLocalities] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  // Sub-tab 2: Import Center State
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importAudits, setImportAudits] = useState<ImportAudit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditsError, setAuditsError] = useState<string | null>(null);

  // Sub-tab 3: Cleanup & Duplicates State
  const [duplicateClusters, setDuplicateClusters] = useState<Array<{ phone: string; leads: Lead[] }>>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
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
  const [healthError, setHealthError] = useState<string | null>(null);

  // F14 — roving-tabindex arrow-key navigation for the sub-tab strip.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, tab: DataSubTab) => {
    const idx = TAB_ORDER.indexOf(tab);
    let next: DataSubTab | null = null;
    if (e.key === 'ArrowRight') next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    else if (e.key === 'ArrowLeft') next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    else if (e.key === 'Home') next = TAB_ORDER[0];
    else if (e.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];
    if (next) {
      e.preventDefault();
      setActiveSubTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  // Load Initial Reference Data
  useEffect(() => {
    if (currentUser && currentUser.role === 'ADMIN') {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Load Data based on active tab (search is debounced — F10)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, debouncedSearchTerm, statusFilter, localityFilter, sourceFilter]);

  const loadDatabaseExplorer = async () => {
    setLoadingLeads(true);
    setDatabaseError(null);
    try {
      const filter: {
        searchTerm?: string;
        status?: LeadStatus;
        locality?: string;
        limit?: number;
      } = {
        searchTerm: debouncedSearchTerm.trim() || undefined,
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
      setDatabaseError('Could not load lead records from the local database.');
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadImportAudits = async () => {
    setLoadingAudits(true);
    setAuditsError(null);
    try {
      const audits = await crmData.importAudits.getAuditHistory(50);
      setImportAudits(audits);
    } catch (err) {
      console.error('Failed to load import audits:', err);
      setAuditsError('Could not load the import history.');
    } finally {
      setLoadingAudits(false);
    }
  };

  const loadDuplicates = async () => {
    setLoadingDuplicates(true);
    setDuplicatesError(null);
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
      setDuplicatesError('Could not scan the database for duplicates.');
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const loadHealthMetrics = async () => {
    setLoadingHealth(true);
    setHealthError(null);
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
      setHealthError('Could not compute database health metrics.');
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleArchiveDuplicate = async (leadId: string) => {
    try {
      await crmData.leads.softDeleteLead(leadId);
      setCleanupSuccessMessage('Duplicate lead archived successfully.');
      setTimeout(() => setCleanupSuccessMessage(null), 4000);
      await loadDuplicates();
    } catch (err) {
      console.error('Failed to archive lead:', err);
      showToast({
        message: 'Could not archive the duplicate lead. Please try again.',
        tone: 'error',
        action: { label: 'Retry', onClick: () => void handleArchiveDuplicate(leadId) },
      });
    }
  };

  const renderErrorBanner = (message: string, onRetry: () => void) => (
    <div
      role="alert"
      className="p-3 bg-danger-soft border border-danger rounded-2xl text-sm text-danger-text flex items-center justify-between gap-3"
    >
      <span className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 px-3 rounded-xl bg-danger text-on-accent text-sm font-bold shrink-0 flex items-center gap-1.5"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  );

  const tabButton = (tab: DataSubTab, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      key={tab}
      ref={(el) => {
        tabRefs.current[tab] = el;
      }}
      type="button"
      role="tab"
      id={`data-tab-${tab}`}
      aria-selected={activeSubTab === tab}
      aria-controls={`data-panel-${tab}`}
      tabIndex={activeSubTab === tab ? 0 : -1}
      onClick={() => setActiveSubTab(tab)}
      onKeyDown={(e) => handleTabKeyDown(e, tab)}
      className={`min-h-11 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
        activeSubTab === tab
          ? 'bg-accent text-on-accent shadow-md'
          : 'text-faint hover:text-ink bg-surface'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-warning text-ink text-xs font-black min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-app text-ink font-sans">
      {/* Sub-Navigation Tabs (F14 — proper tablist semantics) */}
      <div
        role="tablist"
        aria-label="Data management sections"
        className="bg-surface border-b border-line p-2 flex items-center gap-1 overflow-x-auto scrollbar-none sticky top-0 z-20"
      >
        {tabButton('DATABASE', 'Lead Explorer', <Database className="w-4 h-4" aria-hidden="true" />)}
        {tabButton('IMPORTS', 'Import Center', <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />)}
        {tabButton('CLEANUP', 'Data Cleanup', <Trash2 className="w-4 h-4" aria-hidden="true" />, duplicateClusters.length)}
        {tabButton('HEALTH', 'Database Health', <Activity className="w-4 h-4" aria-hidden="true" />)}
      </div>

      {/* Main Sub-Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* SUB-TAB 1: LEAD DATABASE EXPLORER */}
        {activeSubTab === 'DATABASE' && (
          <div
            role="tabpanel"
            id="data-panel-DATABASE"
            aria-labelledby="data-tab-DATABASE"
            className="space-y-3"
          >
            {/* Filters Bar */}
            <div className="p-3 bg-surface border border-line rounded-2xl space-y-2.5">
              <div className="relative">
                <label htmlFor="data-explorer-search" className="sr-only">
                  Search organization database
                </label>
                <Search
                  className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="data-explorer-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search organization database (name, phone, locality)..."
                  className="min-h-11 w-full bg-inset border border-line rounded-xl pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="data-filter-status" className="sr-only">
                    Filter by status
                  </label>
                  <select
                    id="data-filter-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={SELECT_CLASSES}
                  >
                    <option value="ALL">All Statuses</option>
                    {STATUS_FILTERS.map((s) => (
                      <option key={s} value={s}>
                        {labelFor(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="data-filter-locality" className="sr-only">
                    Filter by locality
                  </label>
                  <select
                    id="data-filter-locality"
                    value={localityFilter}
                    onChange={(e) => setLocalityFilter(e.target.value)}
                    className={SELECT_CLASSES}
                  >
                    <option value="ALL">All Localities ({localities.length})</option>
                    {localities.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                {sources.length > 0 && (
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="data-filter-source" className="sr-only">
                      Filter by source
                    </label>
                    <select
                      id="data-filter-source"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className={SELECT_CLASSES}
                    >
                      <option value="ALL">All Sources ({sources.length})</option>
                      {sources.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Total Indicator */}
            <div className="flex items-center justify-between text-sm text-soft px-1" aria-live="polite">
              <span>
                Matching Leads: <strong className="text-ink">{leads.length}</strong> / {totalLeadsCount} total
              </span>
            </div>

            {/* Leads Table */}
            {databaseError ? (
              renderErrorBanner(databaseError, loadDatabaseExplorer)
            ) : loadingLeads ? (
              <div className="py-12 text-center" role="status">
                <Loader2 className="w-6 h-6 animate-spin text-accent-text mx-auto" aria-hidden="true" />
                <p className="text-sm text-soft mt-2">Loading database records...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="py-12 text-center bg-surface rounded-2xl border border-line">
                <Building2 className="w-8 h-8 text-faint mx-auto" aria-hidden="true" />
                <p className="text-sm font-bold text-ink mt-2">No Leads Found</p>
                <p className="text-xs text-soft mt-0.5">Try clearing filters or importing a new dataset.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const assignee = agents.find((a) => a.id === lead.assignedTo);

                  return (
                    <div
                      key={lead.id}
                      className="p-3 bg-surface border border-line rounded-2xl space-y-1.5 hover:border-line-strong transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-ink truncate">{lead.businessName}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-inset text-soft font-semibold text-xs whitespace-nowrap">
                          {labelFor(lead.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-soft">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                          {lead.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                          {lead.locality}
                        </span>
                        <span className="text-accent-text truncate">
                          {assignee ? `Agent: ${assignee.name}` : 'Unassigned'}
                        </span>
                      </div>

                      <div className="text-xs text-faint flex items-center justify-between pt-1 border-t border-line">
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
          <div
            role="tabpanel"
            id="data-panel-IMPORTS"
            aria-labelledby="data-tab-IMPORTS"
            className="space-y-4"
          >
            <div className="p-4 bg-accent-soft border border-line rounded-2xl flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Excel / CSV Spreadsheet Ingestion</h3>
                <p className="text-xs text-soft mt-0.5">
                  Import organization lead batches with auto-mapping & duplicate prevention.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImporterOpen(true)}
                className="min-h-11 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>Launch Importer</span>
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-faint uppercase tracking-wider px-1">
                Batch Import History
              </h4>

              {auditsError ? (
                renderErrorBanner(auditsError, loadImportAudits)
              ) : loadingAudits ? (
                <div className="py-8 text-center" role="status">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-text mx-auto" aria-hidden="true" />
                </div>
              ) : importAudits.length === 0 ? (
                <div className="py-8 text-center bg-surface rounded-2xl border border-line">
                  <FileSpreadsheet className="w-6 h-6 text-faint mx-auto" aria-hidden="true" />
                  <p className="text-sm text-soft mt-2">No spreadsheet imports logged yet.</p>
                </div>
              ) : (
                importAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="p-3 bg-surface border border-line rounded-2xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink">{audit.filename}</span>
                      <span className="text-xs text-faint font-mono">
                        {new Date(audit.completedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-sm pt-1">
                      <div className="p-1.5 bg-inset rounded-xl">
                        <span className="text-xs text-soft block">Total</span>
                        <strong className="text-ink font-bold">{audit.totalRows}</strong>
                      </div>
                      <div className="p-1.5 bg-success-soft rounded-xl border border-success">
                        <span className="text-xs text-success-text block">Imported</span>
                        <strong className="text-success-text font-bold">{audit.imported}</strong>
                      </div>
                      <div className="p-1.5 bg-info-soft rounded-xl border border-info">
                        <span className="text-xs text-info-text block">Updated</span>
                        <strong className="text-info-text font-bold">{audit.updated}</strong>
                      </div>
                      <div className="p-1.5 bg-warning-soft rounded-xl border border-warning">
                        <span className="text-xs text-warning-text block">Skipped</span>
                        <strong className="text-warning-text font-bold">{audit.duplicates}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Importer Modal (F5 — shared accessible modal shell) */}
            <Modal
              isOpen={isImporterOpen}
              onClose={() => setIsImporterOpen(false)}
              title="Excel Lead Importer"
              subtitle="Spreadsheet ingestion & duplicate prevention"
              maxWidthClassName="max-w-2xl"
              closeOnBackdrop={false}
              closeOnEscape={false}
              headerIcon={
                <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
                </span>
              }
            >
              <ExcelImporter
                onImportComplete={() => {
                  setIsImporterOpen(false);
                  loadImportAudits();
                }}
                onCancel={() => setIsImporterOpen(false)}
                currentUserId={currentUser?.id || null}
              />
            </Modal>
          </div>
        )}

        {/* SUB-TAB 3: DATA CLEANUP & DUPLICATES */}
        {activeSubTab === 'CLEANUP' && (
          <div
            role="tabpanel"
            id="data-panel-CLEANUP"
            aria-labelledby="data-tab-CLEANUP"
            className="space-y-4"
          >
            {cleanupSuccessMessage && (
              <div
                role="status"
                className="p-3 bg-success-soft border border-success rounded-2xl text-sm text-success-text flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{cleanupSuccessMessage}</span>
              </div>
            )}

            <div className="p-3 bg-warning-soft border border-warning rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-warning-text shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-warning-text">
                <p className="font-bold">Non-Destructive Duplicate Management</p>
                <p className="text-xs mt-0.5 opacity-90">
                  Reviewing duplicates flags conflicting records for archival. Associated call records and historical notes are permanently retained.
                </p>
              </div>
            </div>

            {duplicatesError ? (
              renderErrorBanner(duplicatesError, loadDuplicates)
            ) : loadingDuplicates ? (
              <div className="py-8 text-center" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-accent-text mx-auto" aria-hidden="true" />
                <p className="text-sm text-soft mt-2">Scanning database for duplicate phone numbers...</p>
              </div>
            ) : duplicateClusters.length === 0 ? (
              <div className="py-12 text-center bg-surface rounded-2xl border border-line space-y-2">
                <CheckCircle2 className="w-8 h-8 text-success-text mx-auto" aria-hidden="true" />
                <h4 className="text-sm font-bold text-ink">Database is Clean</h4>
                <p className="text-xs text-soft">Zero duplicate phone numbers found across active leads.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-soft">
                  Found <strong className="text-ink">{duplicateClusters.length}</strong> duplicate phone clusters:
                </div>

                {duplicateClusters.map((cluster) => (
                  <div
                    key={cluster.phone}
                    className="p-3 bg-surface border border-warning rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-warning-text font-mono flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                        {cluster.phone}
                      </span>
                      <span className="text-xs bg-warning-soft text-warning-text px-2 py-0.5 rounded-full font-bold">
                        {cluster.leads.length} Records
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {cluster.leads.map((lead, idx) => (
                        <div
                          key={lead.id}
                          className="p-2 bg-inset rounded-xl flex items-center justify-between text-sm gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-ink truncate">{lead.businessName}</p>
                            <p className="text-xs text-soft">
                              {lead.locality} • Status: {labelFor(lead.status)} • Calls: {lead.callCount}
                            </p>
                          </div>

                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleArchiveDuplicate(lead.id)}
                              aria-label={`Archive duplicate lead ${lead.businessName}`}
                              className="min-h-11 px-3 bg-danger-soft hover:bg-danger text-danger-text hover:text-on-accent border border-danger rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
                            >
                              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
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
          <div
            role="tabpanel"
            id="data-panel-HEALTH"
            aria-labelledby="data-tab-HEALTH"
            className="space-y-4"
          >
            {healthError ? (
              renderErrorBanner(healthError, loadHealthMetrics)
            ) : loadingHealth ? (
              <div className="py-8 text-center" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-accent-text mx-auto" aria-hidden="true" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3.5 bg-surface border border-line rounded-2xl">
                    <span className="text-xs font-bold text-faint uppercase tracking-wider block">
                      Lead Distribution
                    </span>
                    <p className="text-xl font-black text-ink mt-1">{healthStats.totalLeads}</p>
                    <div className="flex gap-2 text-xs mt-1.5">
                      <span className="text-success-text">Assigned: {healthStats.assignedLeads}</span>
                      <span className="text-warning-text">Unassigned: {healthStats.unassignedLeads}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface border border-line rounded-2xl">
                    <span className="text-xs font-bold text-faint uppercase tracking-wider block">
                      Sales Representatives
                    </span>
                    <p className="text-xl font-black text-ink mt-1">
                      {healthStats.activeAgents + healthStats.inactiveAgents}
                    </p>
                    <div className="flex gap-2 text-xs mt-1.5">
                      <span className="text-success-text">Active: {healthStats.activeAgents}</span>
                      <span className="text-soft">Inactive: {healthStats.inactiveAgents}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface border border-line rounded-2xl">
                    <span className="text-xs font-bold text-faint uppercase tracking-wider block">
                      Call Operations
                    </span>
                    <p className="text-xl font-black text-ink mt-1">{healthStats.totalCalls}</p>
                    <p className="text-xs text-info-text mt-1.5">
                      Verified Calls: {healthStats.verifiedCalls}
                    </p>
                  </div>

                  <div className="p-3.5 bg-surface border border-line rounded-2xl">
                    <span className="text-xs font-bold text-faint uppercase tracking-wider block">
                      Cloud Sync Outbox
                    </span>
                    <p className="text-xl font-black text-ink mt-1">{healthStats.pendingSyncCount}</p>
                    <div className="flex gap-2 text-xs mt-1.5">
                      <span className={healthStats.failedSyncCount > 0 ? 'text-danger-text font-bold' : 'text-soft'}>
                        Failed: {healthStats.failedSyncCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-surface border border-line rounded-2xl space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-soft">Last Successful Sync:</span>
                    <span className="font-mono text-ink text-xs">
                      {healthStats.lastSyncTimestamp
                        ? new Date(healthStats.lastSyncTimestamp).toLocaleString()
                        : 'Never (Offline)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-soft">Database Engine:</span>
                    <span className="font-semibold text-accent-text text-xs">IndexedDB (Dexie v5)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-soft">Cloud Sync Authority:</span>
                    <span className="font-semibold text-success-text text-xs">Supabase PostgreSQL + RLS</span>
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
