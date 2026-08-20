import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  PhoneCall,
  MessageSquare,
  MapPin,
  Tag,
  Clock,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  History,
  Info,
  Share2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { crmData } from '../../db';
import {
  Lead,
  LeadStatus,
  CallOutcome,
  CallHistory,
  Remark,
  MessageHistory,
  FollowUp,
} from '../../db/types';
import { LeadWithHistory } from '../../db/repositories/leadRepository';
import { FollowUpModal } from '../followups/FollowUpModal';

interface LeadDetailViewProps {
  leadId: string;
  onBack: () => void;
  onCallLead: (lead: Lead) => void;
  onOpenOutcomeModal: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export const LeadDetailView: React.FC<LeadDetailViewProps> = ({
  leadId,
  onBack,
  onCallLead,
  onOpenOutcomeModal,
  onOpenWhatsApp,
}) => {
  const [data, setData] = useState<LeadWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CALLS' | 'REMARKS' | 'MESSAGES' | 'FOLLOW_UPS'>('CALLS');

  // Quick Inline Remark State
  const [showAddRemark, setShowAddRemark] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  // Follow-up Modal State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedFollowUpToReschedule, setSelectedFollowUpToReschedule] = useState<FollowUp | null>(null);

  const fetchLeadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const historyData = await crmData.leads.getLeadWithFullHistory(leadId);
      if (!historyData) {
        throw new Error('Lead not found.');
      }
      setData(historyData);
    } catch (err: any) {
      console.error('Failed to load lead details:', err);
      setError(err.message || 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadData();
  }, [leadId]);

  const handleSaveInlineRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemarkText.trim() || !data) return;
    setSavingRemark(true);
    try {
      await crmData.remarks.addRemark({
        leadId: data.lead.id,
        content: newRemarkText.trim(),
        type: 'CUSTOM',
        author: 'Sales Rep',
      });
      setNewRemarkText('');
      setShowAddRemark(false);
      await fetchLeadData();
    } catch (err: any) {
      console.error('Failed to add remark:', err);
    } finally {
      setSavingRemark(false);
    }
  };

  const handleCompleteFollowUp = async (id: string) => {
    try {
      await crmData.followUps.completeFollowUp(id);
      await fetchLeadData();
    } catch (err) {
      console.error('Failed to complete follow up:', err);
    }
  };

  const handleCancelFollowUp = async (id: string) => {
    if (window.confirm('Cancel this follow-up reminder?')) {
      try {
        await crmData.followUps.cancelFollowUp(id);
        await fetchLeadData();
      } catch (err) {
        console.error('Failed to cancel follow up:', err);
      }
    }
  };

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

  const getOutcomeBadgeClass = (outcome: CallOutcome) => {
    switch (outcome) {
      case 'CONNECTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CALLBACK_REQUESTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BUSY':
      case 'NO_ANSWER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'WRONG_NUMBER':
      case 'INVALID_NUMBER':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
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
          <p className="text-xs text-slate-500 font-medium">Loading lead profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Lead Profile Error</h3>
          <p className="text-xs text-slate-500">{error || 'Lead not found.'}</p>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold"
          >
            Return to Leads List
          </button>
        </div>
      </div>
    );
  }

  const { lead, callHistory, remarks, messageHistory, followUps } = data;
  const isCallable = lead.phoneType !== 'invalid' && Boolean(lead.phone);
  const isMobile = lead.phoneType === 'mobile';
  const isLandline = lead.phoneType === 'landline';

  // Find next upcoming/overdue pending follow-up
  const nextPendingFollowUp = followUps
    ? followUps.filter((f: FollowUp) => f.status === 'PENDING').sort((a: FollowUp, b: FollowUp) => (a.scheduledAt > b.scheduledAt ? 1 : -1))[0]
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Sticky Header Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(
              lead.status
            )}`}
          >
            {lead.status}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col space-y-3">
        {/* Lead Profile Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {lead.businessName}
              </h1>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                {lead.category}
              </span>
            </div>

            {lead.contactPerson && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact: {lead.contactPerson}</span>
              </div>
            )}
          </div>

          {/* Location & Phone Info */}
          <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
            {/* Phone */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lead.phoneE164}</span>
                {isLandline && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-normal">
                    Lucknow Landline (0522)
                  </span>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-medium text-slate-700">{lead.locality}</span>
                {lead.pincode && <span> (PIN: {lead.pincode})</span>}
                <p className="text-[11px] text-slate-400 mt-0.5">{lead.address}</p>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Calls</span>
              <span className="font-bold text-slate-900 text-sm">{lead.callCount}</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last Spoke</span>
              <span className="font-medium text-slate-700 text-[11px] truncate block">
                {lead.lastContactedAt ? formatTimestamp(lead.lastContactedAt).split(',')[0] : 'Never'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Follow-up</span>
              <span className="font-medium text-slate-700 text-[11px] truncate block">
                {lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : 'None'}
              </span>
            </div>
          </div>

          {/* NEXT FOLLOW-UP PROMINENT CARD */}
          <div className="pt-2 border-t border-slate-100">
            {nextPendingFollowUp ? (
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Next Follow-up</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {nextPendingFollowUp.priority}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900">{nextPendingFollowUp.title}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-blue-800">
                      {formatTimestamp(nextPendingFollowUp.scheduledAt)}
                    </span>
                  </div>
                  {nextPendingFollowUp.notes && (
                    <p className="text-[11px] text-slate-500 mt-1">{nextPendingFollowUp.notes}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-blue-200/60">
                  <button
                    type="button"
                    onClick={() => handleCancelFollowUp(nextPendingFollowUp.id)}
                    className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFollowUpToReschedule(nextPendingFollowUp);
                      setIsFollowUpModalOpen(true);
                    }}
                    className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompleteFollowUp(nextPendingFollowUp.id)}
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">No follow-up reminder set</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFollowUpToReschedule(null);
                    setIsFollowUpModalOpen(true);
                  }}
                  className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Follow-up</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons (Prominent CALL & WHATSAPP) */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Prominent CALL Button */}
              <button
                type="button"
                onClick={() => onCallLead(lead)}
                disabled={!isCallable}
                className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-slate-900/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>CALL</span>
              </button>

              {/* Prominent WHATSAPP Button */}
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => onOpenWhatsApp(lead)}
                  className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WHATSAPP</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="py-3 px-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center justify-center text-center cursor-not-allowed leading-tight"
                  title="WhatsApp unavailable — landline"
                >
                  <span>WhatsApp unavailable — landline</span>
                </button>
              )}
            </div>

            {/* Log Call Outcome Manual Action */}
            <button
              type="button"
              onClick={() => onOpenOutcomeModal(lead)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Log Call Outcome & Add Remark</span>
            </button>
          </div>
        </div>

        {/* History Tabs Navigation */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('CALLS')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'CALLS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Calls ({callHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('REMARKS')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'REMARKS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Remarks ({remarks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('FOLLOW_UPS')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'FOLLOW_UPS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Follow-ups ({followUps ? followUps.length : 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MESSAGES')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'MESSAGES'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp ({messageHistory ? messageHistory.length : 0})</span>
            </button>
          </div>

          {activeTab === 'REMARKS' && (
            <button
              type="button"
              onClick={() => setShowAddRemark(true)}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          )}

          {activeTab === 'FOLLOW_UPS' && (
            <button
              type="button"
              onClick={() => {
                setSelectedFollowUpToReschedule(null);
                setIsFollowUpModalOpen(true);
              }}
              className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          )}
        </div>

        {/* Inline Add Note Form */}
        {showAddRemark && (
          <form
            onSubmit={handleSaveInlineRemark}
            className="bg-white rounded-xl border border-emerald-200 p-3 shadow-xs space-y-2 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Add Sales Remark</span>
              <button
                type="button"
                onClick={() => setShowAddRemark(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="Type sales remark or observation..."
              value={newRemarkText}
              onChange={(e) => setNewRemarkText(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 font-medium"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={savingRemark || !newRemarkText.trim()}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingRemark ? 'Saving...' : 'Save Remark'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 1: CALL HISTORY LIST */}
        {activeTab === 'CALLS' && (
          <div className="space-y-2">
            {callHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <PhoneCall className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No Call History Yet</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tap "CALL" to dial this gym, then record your call outcome.
                </p>
              </div>
            ) : (
              callHistory.map((call: CallHistory) => (
                <div
                  key={call.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getOutcomeBadgeClass(
                        call.outcome
                      )}`}
                    >
                      {call.outcome}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(call.startedAt)}</span>
                    </span>
                  </div>

                  {call.notes && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {call.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: REMARKS LIST */}
        {activeTab === 'REMARKS' && (
          <div className="space-y-2">
            {remarks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No Remarks Recorded Yet</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Log customer requirements, sample requests, and meeting notes.
                </p>
              </div>
            ) : (
              remarks.map((remark: Remark) => (
                <div
                  key={remark.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600">{remark.author}</span>
                    <span>{formatTimestamp(remark.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {remark.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: FOLLOW-UPS LIST */}
        {activeTab === 'FOLLOW_UPS' && (
          <div className="space-y-2">
            {!followUps || followUps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No Follow-ups Logged</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Schedule callbacks, sample deliveries, or owner meetings.
                </p>
              </div>
            ) : (
              followUps.map((fu: FollowUp) => (
                <div
                  key={fu.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        fu.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : fu.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {fu.status}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(fu.scheduledAt)}</span>
                    </span>
                  </div>

                  <h5 className="text-xs font-bold text-slate-900">{fu.title}</h5>
                  {fu.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {fu.notes}
                    </p>
                  )}

                  {fu.status === 'PENDING' && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFollowUpToReschedule(fu);
                          setIsFollowUpModalOpen(true);
                        }}
                        className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompleteFollowUp(fu.id)}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Done</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: MESSAGES / WHATSAPP HISTORY */}
        {activeTab === 'MESSAGES' && (
          <div className="space-y-2">
            {!messageHistory || messageHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No WhatsApp Messages Logged</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Tap "WHATSAPP" above to send pitch templates and catalogues.
                </p>
              </div>
            ) : (
              messageHistory.map((msg: MessageHistory) => (
                <div
                  key={msg.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        msg.sentStatus === 'INITIATED'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : msg.sentStatus === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {msg.sentStatus}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(msg.sentAt)}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 whitespace-pre-wrap font-mono">
                    {msg.messageContent}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Follow-up Scheduling / Reschedule Modal */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        lead={lead}
        existingFollowUp={selectedFollowUpToReschedule}
        onClose={() => {
          setIsFollowUpModalOpen(false);
          setSelectedFollowUpToReschedule(null);
        }}
        onSaved={fetchLeadData}
      />
    </div>
  );
};
