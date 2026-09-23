import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search,
  Phone,
  MessageSquare,
  MapPin,
  Plus,
  Building2,
  ChevronRight,
  PhoneCall,
  Settings,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { RealtimeService } from '../../services/realtime/realtimeService';
import type { Lead, LeadStatus } from '../../db/types';
import { CreateLeadModal } from './CreateLeadModal';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { labelFor } from '../../lib/labels';
import { leadStatusBadgeClass } from '../../lib/leadStatusStyles';

/** F9 â€” page size for the leads list; "Load more" appends the next page. */
const PAGE_SIZE = 150;

interface MinimalLeadsListProps {
  onOpenImporter: () => void;
  onOpenLead: (leadId: string) => void;
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenBackupModal?: () => void;
  onOpenSettings?: () => void;
  initialStatusFilter?: string;
  initialLocalityFilter?: string;
}

type CurrentUser = ReturnType<typeof useAuth>['currentUser'];

const LeadsHeader: React.FC<{
  currentUser: CurrentUser;
  onOpenImporter: () => void;
  onOpenBackupModal?: () => void;
  onOpenSettings?: () => void;
  onAddLead: () => void;
}> = ({ currentUser, onOpenImporter, onOpenBackupModal, onOpenSettings, onAddLead }) => (
  <div className="bg-surface border-b border-line px-4 py-3 sticky top-0 z-30 shadow-sm">
    <div className="max-w-2xl mx-auto flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
          <h1 className="text-base font-bold tracking-tight text-ink">Amaratv Krishi CRM</h1>
        </div>
        <p className="text-xs text-faint">
          {currentUser?.role === 'AGENT'
            ? 'Field Sales â€¢ ' + currentUser.name
            : 'Lucknow Field Sales â€¢ Leads Database'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
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
        {currentUser?.role === 'ADMIN' && onOpenBackupModal && (
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
            className="min-h-11 bg-inset hover:bg-inset-strong text-soft px-3 rounded-xl font-semibold text-xs transition-colors"
          >
            Import
          </button>
        )}
        <button
          type="button"
          onClick={onAddLead}
          id="add-lead-button"
          className="min-h-11 bg-accent hover:bg-accent-hover text-on-accent px-3 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Lead</span>
        </button>
      </div>
    </div>
  </div>
);

const LeadsFilters: React.FC<{
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedLocality: string;
  onLocalityChange: (locality: string) => void;
  localities: string[];
}> = ({
  searchTerm,
  onSearchTermChange,
  selectedStatus,
  onStatusChange,
  selectedLocality,
  onLocalityChange,
  localities,
}) => (
  <div className="bg-surface p-3.5 rounded-2xl border border-line shadow-xs space-y-2.5">
    <div className="relative">
      <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
      <label htmlFor="leads-search" className="sr-only">
        Search leads by name, phone, or locality
      </label>
      <input
        id="leads-search"
        type="search"
        placeholder="Search by gym name, phone, locality..."
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        className="min-h-11 w-full text-sm bg-inset border border-line rounded-xl pl-9 pr-3 py-2.5 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring font-medium"
      />
    </div>
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none" role="group" aria-label="Filter by status">
      <span className="text-xs font-semibold text-faint flex-shrink-0">Status:</span>
      {['ALL', 'NEW', 'CONTACTED', 'INTERESTED', 'SAMPLE_REQUESTED', 'CUSTOMER'].map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onStatusChange(status)}
          aria-pressed={selectedStatus === status}
          className={'min-w-11 min-h-11 px-3 rounded-xl font-medium text-xs whitespace-nowrap transition-colors touch-manipulation ' +
            (selectedStatus === status ? 'bg-ink text-app' : 'bg-inset text-soft hover:bg-inset-strong')}
        >
          {status === 'ALL' ? 'All' : labelFor(status)}
        </button>
      ))}
    </div>
    {localities.length > 0 && (
      <div className="flex items-center gap-2 text-xs pt-1 border-t border-line">
        <MapPin className="w-3.5 h-3.5 text-faint flex-shrink-0" aria-hidden="true" />
        <label htmlFor="leads-locality" className="text-soft font-medium flex-shrink-0">
          Area:
        </label>
        <select
          id="leads-locality"
          value={selectedLocality}
          onChange={(e) => onLocalityChange(e.target.value)}
          className="min-h-11 min-w-0 max-w-full text-xs bg-inset border border-line rounded-xl px-3 py-2 text-ink font-medium focus:ring-2 focus:ring-focus-ring"
        >
          <option value="ALL">{'All Lucknow Localities (' + localities.length + ')'}</option>
          {localities.map((locality) => (
            <option key={locality} value={locality}>
              {locality}
            </option>
          ))}
        </select>
      </div>
    )}
  </div>
);

const LeadsSummary: React.FC<{
  isAgent: boolean;
  totalCount: number;
  visibleCount: number;
  hasMore: boolean;
}> = ({ isAgent, totalCount, visibleCount, hasMore }) => (
  <div className="flex items-center justify-between px-1 text-xs text-soft">
    <span>
      {isAgent ? 'Assigned to You: ' : 'Total in Database: '}
      <strong className="text-ink">{totalCount}</strong> leads
    </span>
    {hasMore && <span className="text-faint">{'Showing ' + visibleCount + ' of ' + totalCount}</span>}
  </div>
);

const LeadsStatePanels: React.FC<{
  loadError: string | null;
  loading: boolean;
  totalCount: number;
  isAgent: boolean;
  onRetry: () => void;
  onAddLead: () => void;
}> = ({ loadError, loading, totalCount, isAgent, onRetry, onAddLead }) => (
  <>
    {loadError && !loading && (
      <div className="bg-surface rounded-2xl border border-line p-8 text-center my-auto space-y-3">
        <CloudOff className="w-10 h-10 text-danger mx-auto" aria-hidden="true" />
        <h2 className="text-base font-bold text-ink">{loadError}</h2>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 px-4 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold rounded-xl inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    )}
    {totalCount === 0 && !loading && !loadError && (
      <div className="bg-surface rounded-2xl border border-line p-8 text-center my-auto space-y-3">
        <div className="w-14 h-14 bg-accent-soft text-accent-text rounded-full flex items-center justify-center mx-auto">
          <Building2 className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-ink">
          {isAgent ? 'No Leads Assigned Yet' : 'No Leads in Database Yet'}
        </h2>
        <p className="text-sm text-soft max-w-xs mx-auto">
          {isAgent
            ? 'Your administrator has not assigned leads to you yet, or add a field lead with the button below.'
            : 'Import leads from the Admin Data section or add a lead directly.'}
        </p>
        <button
          type="button"
          onClick={onAddLead}
          className="min-h-11 px-4 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 active:scale-98 transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add New Field Lead</span>
        </button>
      </div>
    )}
  </>
);

const LeadCard: React.FC<{
  lead: Lead;
  index: number;
  onOpenLead: (leadId: string) => void;
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}> = ({ lead, index, onOpenLead, onCallLead, onOpenWhatsApp }) => {
  const isCallable = lead.phoneType !== 'invalid' && Boolean(lead.phone);
  return (
    <div className="bg-surface rounded-2xl border border-line p-3.5 shadow-xs hover:border-line-strong transition-all flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpenLead(lead.id)}
        id={'lead-item-' + index}
        className="w-full text-left group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="text-sm font-bold text-ink group-hover:text-accent-text truncate transition-colors">
                {lead.businessName}
              </h2>
              <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent-text transition-transform group-hover:translate-x-0.5 flex-shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-soft mt-0.5">
              <span className="font-medium text-soft">{lead.locality}</span>
              {lead.pincode && <span>â€¢ PIN {lead.pincode}</span>}
              <span>â€¢ {lead.category}</span>
            </div>
          </div>
          <span
            className={'text-xs font-bold px-2 py-0.5 rounded-full border ' +
              leadStatusBadgeClass(lead.status) + ' flex-shrink-0'}
          >
            {labelFor(lead.status)}
          </span>
        </div>
        <p className="text-xs text-faint line-clamp-1 mt-1.5">{lead.address}</p>
      </button>
      <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-ink">
          <Phone className="w-3.5 h-3.5 text-accent-text flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{lead.phoneE164 || lead.phone}</span>
          {lead.phoneType === 'landline' && (
            <span className="text-xs text-info-text bg-info-soft px-1 rounded font-normal flex-shrink-0">0522</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {lead.phoneType === 'mobile' ? (
            <button
              type="button"
              onClick={() => onOpenWhatsApp(lead)}
              aria-label={'Send WhatsApp pitch to ' + lead.businessName}
              className="min-h-11 py-1.5 px-2.5 bg-accent hover:bg-accent-hover active:scale-[0.98] text-on-accent rounded-xl transition-all flex items-center gap-1 text-xs font-bold shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>WhatsApp</span>
            </button>
          ) : (
            <span
              className="text-xs text-faint bg-inset border border-line px-2 py-1.5 rounded-xl font-medium"
              aria-label="WhatsApp unavailable â€” landline"
            >
              WA N/A
            </span>
          )}
          <button
            type="button"
            onClick={() => onCallLead(lead)}
            disabled={!isCallable}
            aria-label={'Call ' + lead.businessName}
            className="min-h-11 py-1.5 px-2.5 bg-ink hover:opacity-90 disabled:opacity-40 text-app rounded-xl transition-colors flex items-center gap-1 text-xs font-bold shadow-xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-success" aria-hidden="true" />
            <span>Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const LeadCards: React.FC<{
  leads: Lead[];
  onOpenLead: (leadId: string) => void;
  onCallLead: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}> = ({ leads, onOpenLead, onCallLead, onOpenWhatsApp }) => (
  <div id="leads-list" className="space-y-2.5">
    {leads.map((lead, index) => (
      <LeadCard
        key={lead.id}
        lead={lead}
        index={index}
        onOpenLead={onOpenLead}
        onCallLead={onCallLead}
        onOpenWhatsApp={onOpenWhatsApp}
      />
    ))}
  </div>
);

const LeadsLoadMore: React.FC<{
  hasMore: boolean;
  loading: boolean;
  loadError: string | null;
  loadingMore: boolean;
  remaining: number;
  onLoadMore: () => void;
}> = ({ hasMore, loading, loadError, loadingMore, remaining, onLoadMore }) => {
  if (!hasMore || loading || loadError) return null;
  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loadingMore}
      className="w-full min-h-11 py-2.5 rounded-xl border border-line bg-surface hover:bg-inset text-soft font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {loadingMore ? (
        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <ChevronRight className="w-4 h-4 rotate-90" aria-hidden="true" />
      )}
      <span>{loadingMore ? 'Loadingâ€¦' : 'Load More (' + remaining + ' remaining)'}</span>
    </button>
  );
};

export const MinimalLeadsList: React.FC<MinimalLeadsListProps> = ({
  onOpenImporter,
  onOpenLead,
  onCallLead,
  onOpenWhatsApp,
  onOpenBackupModal,
  onOpenSettings,
  initialStatusFilter = 'ALL',
  initialLocalityFilter = 'ALL',
}) => {
  const { currentUser } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [selectedLocality, setSelectedLocality] = useState<string>(initialLocalityFilter);
  const [localities, setLocalities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // F10 â€” debounce the search so we don't run a full Dexie query per keystroke.
  const debouncedSearch = useDebouncedValue(searchTerm, 250);

  // NEW-BUG-003 â€” request-sequence guard. Every fresh loadLeads bumps the
  // sequence; in-flight results that resolve after a newer request started are
  // discarded instead of clobbering/appending onto the newer list. loadMore
  // captures the current sequence so a filter/search change mid-flight drops
  // its stale page instead of appending rows from the old filter.
  const requestSeq = useRef(0);

  useEffect(() => {
    if (initialStatusFilter) setSelectedStatus(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialLocalityFilter) setSelectedLocality(initialLocalityFilter);
  }, [initialLocalityFilter]);

  const buildFilter = useCallback(
    (offset: number) => {
      const filter: {
        searchTerm?: string;
        status?: LeadStatus;
        locality?: string;
        assignedTo?: string;
        limit?: number;
        offset?: number;
      } = {
        searchTerm: debouncedSearch.trim() || undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as LeadStatus) : undefined,
        locality: selectedLocality !== 'ALL' ? selectedLocality : undefined,
        limit: PAGE_SIZE,
        offset,
      };

      // Restrict AGENT users strictly to their assigned leads or leads they created
      if (currentUser?.role === 'AGENT') {
        filter.assignedTo = currentUser.id;
      }
      return filter;
    },
    [debouncedSearch, selectedStatus, selectedLocality, currentUser]
  );

  const loadLeads = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await crmData.leads.searchAndFilterLeads(buildFilter(0));
      if (seq !== requestSeq.current) return; // stale result â€” a newer load started
      setLeads(result.leads);
      setTotalCount(result.total);

      const distinctLocs = await crmData.leads.getDistinctLocalities();
      if (seq !== requestSeq.current) return;
      setLocalities(distinctLocs);
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      console.error('Failed to load leads:', err);
      setLoadError('Could not load leads from the local database.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [buildFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // RealtimeService reconciles incoming lead changes into Dexie. Refresh the
  // visible list from that canonical local state so an assignment, update, or
  // delete delivered from another client is reflected without navigation.
  useEffect(() => {
    return RealtimeService.onEntityChange((table) => {
      if (table === 'leads') void loadLeads();
    });
  }, [loadLeads]);

  // F9 â€” append the next page instead of silently capping at 150.
  const loadMore = async () => {
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const result = await crmData.leads.searchAndFilterLeads(buildFilter(leads.length));
      // NEW-BUG-003 â€” if the filter/search changed while this page was in
      // flight, loadLeads has already replaced the list; appending this stale
      // page would mix rows from the old filter into the new list.
      if (seq !== requestSeq.current) return;
      setLeads((prev) => [...prev, ...result.leads]);
      setTotalCount(result.total);
    } catch (err) {
      console.error('Failed to load more leads:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = leads.length < totalCount;

  return (
    <div className="min-h-screen bg-app flex flex-col pb-safe-nav font-sans">
      <LeadsHeader
        currentUser={currentUser}
        onOpenImporter={onOpenImporter}
        onOpenBackupModal={onOpenBackupModal}
        onOpenSettings={onOpenSettings}
        onAddLead={() => setIsCreateModalOpen(true)}
      />
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-3">
        <LeadsFilters
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedLocality={selectedLocality}
          onLocalityChange={setSelectedLocality}
          localities={localities}
        />
        <LeadsSummary
          isAgent={currentUser?.role === 'AGENT'}
          totalCount={totalCount}
          visibleCount={leads.length}
          hasMore={hasMore}
        />
        <LeadsStatePanels
          loadError={loadError}
          loading={loading}
          totalCount={totalCount}
          isAgent={currentUser?.role === 'AGENT'}
          onRetry={() => void loadLeads()}
          onAddLead={() => setIsCreateModalOpen(true)}
        />
        <LeadCards
          leads={leads}
          onOpenLead={onOpenLead}
          onCallLead={onCallLead}
          onOpenWhatsApp={onOpenWhatsApp}
        />
        <LeadsLoadMore
          hasMore={hasMore}
          loading={loading}
          loadError={loadError}
          loadingMore={loadingMore}
          remaining={totalCount - leads.length}
          onLoadMore={() => void loadMore()}
        />
      </div>
      <CreateLeadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLeadCreated={() => {
          loadLeads();
        }}
      />
    </div>
  );

};
