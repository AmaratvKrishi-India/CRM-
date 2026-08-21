import React, { useEffect, useState, useCallback } from 'react';
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
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { crmData } from '../../db';
import { Lead, LeadStatus } from '../../db/types';
import { CreateLeadModal } from './CreateLeadModal';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (initialStatusFilter) setSelectedStatus(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialLocalityFilter) setSelectedLocality(initialLocalityFilter);
  }, [initialLocalityFilter]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const filter: {
        searchTerm?: string;
        status?: LeadStatus;
        locality?: string;
        assignedTo?: string;
        limit?: number;
      } = {
        searchTerm: searchTerm.trim() || undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as LeadStatus) : undefined,
        locality: selectedLocality !== 'ALL' ? selectedLocality : undefined,
        limit: 150,
      };

      // Restrict AGENT users strictly to their assigned leads or leads they created
      if (currentUser?.role === 'AGENT') {
        filter.assignedTo = currentUser.id;
      }

      const result = await crmData.leads.searchAndFilterLeads(filter);
      setLeads(result.leads);
      setTotalCount(result.total);

      const distinctLocs = await crmData.leads.getDistinctLocalities();
      setLocalities(distinctLocs);
    } catch (err: unknown) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedLocality, currentUser]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const getStatusBadgeClass = (status: LeadStatus) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CONTACTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'INTERESTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'SAMPLE_REQUESTED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CUSTOMER':
        return 'bg-emerald-600 text-white border-emerald-600';
      case 'WRONG_NUMBER':
      case 'DO_NOT_CONTACT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Amaratv Krishi Logo" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
              <h1 className="text-base font-bold tracking-tight">Amaratv Krishi CRM</h1>
            </div>
            <p className="text-[11px] text-slate-400">
              {currentUser?.role === 'AGENT' ? `Field Sales • ${currentUser.name}` : 'Lucknow Field Sales • Leads Database'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
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
            {currentUser?.role === 'ADMIN' && onOpenBackupModal && (
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
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1 transition-colors"
              >
                <span>Import</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-3">
        {/* Search & Filters Card */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by gym name, phone, locality..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight flex-shrink-0">
              Status:
            </span>
            {['ALL', 'NEW', 'CONTACTED', 'INTERESTED', 'SAMPLE_REQUESTED', 'CUSTOMER'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium text-xs whitespace-nowrap transition-colors ${
                  selectedStatus === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Locality Dropdown if available */}
          {localities.length > 0 && (
            <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-100">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500 font-medium flex-shrink-0">Area:</span>
              <select
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Lucknow Localities ({localities.length})</option>
                {localities.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Header Stats */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500">
          <span>
            {currentUser?.role === 'AGENT' ? 'Assigned to You: ' : 'Total in Database: '}
            <strong className="text-slate-900">{totalCount}</strong> leads
          </span>
        </div>

        {/* Empty State */}
        {totalCount === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center my-auto space-y-3">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {currentUser?.role === 'AGENT' ? 'No Leads Assigned Yet' : 'No Leads in Database Yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {currentUser?.role === 'AGENT'
                ? 'Your administrator has not assigned leads to you yet, or add a field lead with the button below.'
                : 'Import leads from the Admin Data section or add a lead directly.'}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Field Lead</span>
            </button>
          </div>
        )}

        {/* Leads List */}
        <div className="space-y-2.5">
          {leads.map((lead) => {
            const isCallable = lead.phoneType !== 'invalid' && Boolean(lead.phone);

            return (
              <div
                key={lead.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-300 transition-all flex flex-col gap-2"
              >
                {/* Clickable Header Area -> Opens Lead Detail */}
                <div
                  onClick={() => onOpenLead(lead.id)}
                  className="flex items-start justify-between gap-2 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 truncate transition-colors">
                        {lead.businessName}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">{lead.locality}</span>
                      {lead.pincode && <span>• PIN {lead.pincode}</span>}
                      <span>• {lead.category}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                      lead.status
                    )} flex-shrink-0`}
                  >
                    {lead.status}
                  </span>
                </div>

                {/* Address Snippet */}
                <p
                  onClick={() => onOpenLead(lead.id)}
                  className="text-[11px] text-slate-400 line-clamp-1 cursor-pointer"
                >
                  {lead.address}
                </p>

                {/* Action Buttons (One-Hand Ergonomics) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Phone */}
                  <div className="flex items-center gap-1 font-mono text-xs font-semibold text-slate-800">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{lead.phoneE164 || lead.phone}</span>
                    {lead.phoneType === 'landline' && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded font-normal flex-shrink-0">
                        0522
                      </span>
                    )}
                  </div>

                  {/* Communication triggers */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* WhatsApp Button */}
                    {lead.phoneType === 'mobile' ? (
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp(lead)}
                        className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl transition-all flex items-center gap-1 text-xs font-bold shadow-xs shadow-emerald-600/20"
                        title="WhatsApp pitch & catalogue"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    ) : (
                      <span
                        className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-xl font-medium cursor-not-allowed"
                        title="WhatsApp unavailable — landline"
                      >
                        WA N/A
                      </span>
                    )}

                    {/* Native Dialer Button */}
                    <button
                      type="button"
                      onClick={() => onCallLead(lead)}
                      disabled={!isCallable}
                      className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl transition-colors flex items-center gap-1 text-xs font-bold shadow-xs"
                      title="Dial phone"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controlled Create Lead Modal */}
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
