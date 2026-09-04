import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Paperclip,
  Settings,
  Plus,
  Check,
  Star,
  Copy,
  Edit3,
  Trash2,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Eye,
  Upload,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { crmData } from '../../db';
import type { MessageTemplate, TemplateCategory, Lead } from '../../db/types';
import type { StoredCatalogueMeta } from '../../services/appSettingsService';
import { AppSettingsService } from '../../services/appSettingsService';
import { AttachmentService } from '../../services/attachmentService';
import { renderMessageTemplate } from '../../services/templateRenderer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSync } from '../../services/sync/useSync';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import { labelFor } from '../../lib/labels';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplatesChanged?: () => void;
  initialTab?: 'MESSAGES' | 'CATALOGUE' | 'PREFERENCES';
}

type SettingsTab = 'MESSAGES' | 'CATALOGUE' | 'PREFERENCES';

const TAB_ORDER: SettingsTab[] = ['MESSAGES', 'CATALOGUE', 'PREFERENCES'];

const SAMPLE_LEAD: Lead = {
  id: 'sample-lead-001',
  businessName: 'Skywards Fitness Zone',
  category: 'Gym',
  phone: '7054447888',
  phoneRaw: '+91 70544 47888',
  phoneE164: '+917054447888',
  phoneType: 'mobile',
  alternatePhone: null,
  contactPerson: 'Amit Sharma',
  address: 'Sector B, Alambagh, Lucknow',
  locality: 'Alambagh',
  pincode: '226005',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  website: null,
  rating: 4.8,
  reviewCount: 45,
  source: 'Sample Preview',
  sourceFile: null,
  sourceRow: null,
  status: 'NEW',
  customNotes: '',
  lastContactedAt: null,
  nextFollowUpAt: '2026-08-25',
  callCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isSynced: 1,
  syncedAt: null,
  deletedAt: null,
};

const TEMPLATE_VARIABLES = [
  { tag: '{{businessName}}', desc: "Gym / Centre Name (e.g. Gold's Gym)" },
  { tag: '{{contactPersonOrSir}}', desc: 'Contact Person or "Gym Manager / Owner"' },
  { tag: '{{contactPerson}}', desc: 'Contact Person or "Sir/Madam"' },
  { tag: '{{locality}}', desc: 'Locality (e.g. Gomti Nagar, Alambagh)' },
  { tag: '{{city}}', desc: 'City (Lucknow)' },
  { tag: '{{phone}}', desc: 'Phone number' },
  { tag: '{{followUpDate}}', desc: 'Scheduled follow-up date' },
  { tag: '{{repName}}', desc: 'Sales representative name' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onTemplatesChanged,
  initialTab = 'MESSAGES',
}) => {
  const { currentUser, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { syncState, isSyncing, synchronizeNow } = useSync();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    category: TemplateCategory;
    body: string;
    isDefault: boolean;
  }>({
    title: '',
    category: 'INTRO',
    body: '',
    isDefault: false,
  });

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Default catalogue state
  const [defaultCatalogue, setDefaultCatalogue] = useState<StoredCatalogueMeta | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  // Preference state
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const allTemplates = await crmData.templates.getAllTemplates();
      setTemplates(allTemplates);

      const cat = AppSettingsService.getDefaultCatalogue();
      setDefaultCatalogue(cat);

      const isPrev = AppSettingsService.isWhatsappPreviewEnabled();
      setPreviewEnabled(isPrev);
    } catch (err) {
      console.error('Failed to load settings data:', err);
      showToast({ message: 'Could not load settings. Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
      setIsCreating(false);
      setEditingTemplate(null);
      setDeleteConfirmId(null);
      setCatalogueError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  const handleTabKeyDown = (e: React.KeyboardEvent, id: SettingsTab) => {
    const idx = TAB_ORDER.indexOf(id);
    let next: SettingsTab | null = null;
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

  const handleSetDefault = async (templateId: string) => {
    try {
      await crmData.templates.setDefaultTemplate(templateId);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
      showToast({ message: 'Default template updated.', tone: 'success' });
    } catch (err) {
      console.error('Failed to set default template:', err);
      showToast({ message: 'Could not set the default template.', tone: 'error' });
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      await crmData.templates.duplicateTemplate(templateId);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
      showToast({ message: 'Template duplicated.', tone: 'success' });
    } catch (err) {
      console.error('Failed to duplicate template:', err);
      showToast({ message: 'Could not duplicate the template.', tone: 'error' });
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await crmData.templates.softDeleteTemplate(templateId);
      setDeleteConfirmId(null);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
      showToast({ message: 'Template deleted.', tone: 'success' });
    } catch (err) {
      console.error('Failed to delete template:', err);
      showToast({ message: 'Could not delete the template.', tone: 'error' });
    }
  };

  const handleStartCreate = () => {
    setFormData({
      title: '',
      category: 'INTRO',
      body: `Hello {{businessName}},\n\nI'm reaching out from Amaratv Krishi (Lucknow).\n\nWe supply high-protein flour and nutrition blends suitable for fitness and wellness customers in {{locality}}.\n\nWe would like to provide a complimentary sample pack for evaluation.\n\nPlease let us know a convenient time to connect.\n\nRegards,\nAmaratv Krishi`,
      isDefault: templates.length === 0,
    });
    setIsCreating(true);
    setEditingTemplate(null);
  };

  const handleStartEdit = (tpl: MessageTemplate) => {
    setFormData({
      title: tpl.title,
      category: tpl.category,
      body: tpl.body,
      isDefault: tpl.isDefault,
    });
    setEditingTemplate(tpl);
    setIsCreating(false);
  };

  const handleSaveForm = async () => {
    if (!formData.title.trim() || !formData.body.trim()) return;

    try {
      if (isCreating) {
        await crmData.templates.createTemplate({
          title: formData.title,
          category: formData.category,
          body: formData.body,
          isDefault: formData.isDefault,
        });
      } else if (editingTemplate) {
        await crmData.templates.updateTemplate(editingTemplate.id, {
          title: formData.title,
          category: formData.category,
          body: formData.body,
          isDefault: formData.isDefault,
        });
      }

      setIsCreating(false);
      setEditingTemplate(null);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
      showToast({ message: 'Template saved.', tone: 'success' });
    } catch (err) {
      console.error('Failed to save template:', err);
      showToast({ message: 'Could not save the template. Please try again.', tone: 'error' });
    }
  };

  const handleInsertTag = (tag: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart || 0;
    const end = textareaRef.current.selectionEnd || 0;
    const current = formData.body;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setFormData({ ...formData, body: updated });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 50);
  };

  const handleCatalogueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const validation = AttachmentService.validateFile(file);
    if (!validation.isValid) {
      setCatalogueError(validation.error || 'Invalid file.');
      return;
    }

    setCatalogueError(null);
    try {
      const saved = await AppSettingsService.setDefaultCatalogue(file);
      setDefaultCatalogue(saved);
      showToast({ message: 'Catalogue saved for Quick Send.', tone: 'success' });
    } catch (err: any) {
      setCatalogueError(err.message || 'Failed to process file.');
    }
  };

  const handleRemoveCatalogue = () => {
    AppSettingsService.clearDefaultCatalogue();
    setDefaultCatalogue(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast({ message: 'Catalogue removed.', tone: 'info' });
  };

  const handleTogglePreview = (enabled: boolean) => {
    setPreviewEnabled(enabled);
    AppSettingsService.setWhatsappPreviewEnabled(enabled);
  };

  const tabButtonClass = (selected: boolean) =>
    `min-h-11 py-2 px-3 text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all ${
      selected
        ? 'border-accent text-accent-text bg-surface'
        : 'border-transparent text-soft hover:text-ink'
    }`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings & Pitch Templates"
      subtitle="Manage WhatsApp messages & collateral"
      maxWidthClassName="max-w-xl"
      headerIcon={
        <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5" aria-hidden="true" />
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex border-b border-line bg-inset px-2 -mx-4 -mt-4 mb-4"
      >
        <button
          ref={(el) => {
            tabRefs.current['MESSAGES'] = el;
          }}
          type="button"
          role="tab"
          id="settings-tab-messages"
          aria-selected={activeTab === 'MESSAGES'}
          aria-controls="settings-panel-messages"
          tabIndex={activeTab === 'MESSAGES' ? 0 : -1}
          onClick={() => {
            setActiveTab('MESSAGES');
            setIsCreating(false);
            setEditingTemplate(null);
          }}
          onKeyDown={(e) => handleTabKeyDown(e, 'MESSAGES')}
          className={tabButtonClass(activeTab === 'MESSAGES')}
        >
          <MessageSquare className="w-4 h-4" aria-hidden="true" />
          <span>WhatsApp Messages</span>
        </button>

        <button
          ref={(el) => {
            tabRefs.current['CATALOGUE'] = el;
          }}
          type="button"
          role="tab"
          id="settings-tab-catalogue"
          aria-selected={activeTab === 'CATALOGUE'}
          aria-controls="settings-panel-catalogue"
          tabIndex={activeTab === 'CATALOGUE' ? 0 : -1}
          onClick={() => setActiveTab('CATALOGUE')}
          onKeyDown={(e) => handleTabKeyDown(e, 'CATALOGUE')}
          className={tabButtonClass(activeTab === 'CATALOGUE')}
        >
          <Paperclip className="w-4 h-4" aria-hidden="true" />
          <span>Default Catalogue</span>
          {defaultCatalogue && (
            <span
              className="w-2 h-2 rounded-full bg-success"
              role="img"
              aria-label="Catalogue configured"
            />
          )}
        </button>

        <button
          ref={(el) => {
            tabRefs.current['PREFERENCES'] = el;
          }}
          type="button"
          role="tab"
          id="settings-tab-preferences"
          aria-selected={activeTab === 'PREFERENCES'}
          aria-controls="settings-panel-preferences"
          tabIndex={activeTab === 'PREFERENCES' ? 0 : -1}
          onClick={() => setActiveTab('PREFERENCES')}
          onKeyDown={(e) => handleTabKeyDown(e, 'PREFERENCES')}
          className={tabButtonClass(activeTab === 'PREFERENCES')}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
          <span>Preferences</span>
        </button>
      </div>

      {/* TAB 1: WHATSAPP MESSAGES */}
      {activeTab === 'MESSAGES' && (
        <div
          role="tabpanel"
          id="settings-panel-messages"
          aria-labelledby="settings-tab-messages"
          className="space-y-4"
        >
          {!isCreating && !editingTemplate ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    Saved Pitch Templates ({templates.length})
                  </h3>
                  <p className="text-xs text-soft mt-0.5">
                    Default template is automatically pre-filled when tapping WhatsApp on any lead.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="min-h-11 py-1.5 px-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm flex items-center gap-1 shadow-xs transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>New Message</span>
                </button>
              </div>

              {loading ? (
                <div className="space-y-2.5" aria-label="Loading templates" role="status">
                  {[0, 1].map((i) => (
                    <div key={i} className="p-3 rounded-2xl border border-line bg-surface animate-pulse">
                      <div className="h-3.5 w-1/3 rounded bg-inset-strong" />
                      <div className="h-3 w-full rounded bg-inset mt-2.5" />
                      <div className="h-3 w-2/3 rounded bg-inset mt-1.5" />
                    </div>
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-line-strong bg-inset text-center">
                  <p className="text-sm font-semibold text-ink">No templates yet</p>
                  <p className="text-xs text-soft mt-1">
                    Create your first pitch message to speed up WhatsApp outreach.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {templates.map((tpl) => {
                    const renderedSample = renderMessageTemplate(tpl.body, { lead: SAMPLE_LEAD });
                    const isConfirmingDelete = deleteConfirmId === tpl.id;

                    return (
                      <div
                        key={tpl.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          tpl.isDefault
                            ? 'bg-accent-soft border-accent shadow-xs'
                            : 'bg-surface border-line hover:border-line-strong'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-ink">{tpl.title}</h4>
                              {tpl.isDefault && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-accent text-on-accent uppercase tracking-wide">
                                  <Check className="w-3 h-3" aria-hidden="true" /> Default Pitch
                                </span>
                              )}
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-inset text-soft">
                                {labelFor(tpl.category)}
                              </span>
                            </div>

                            <p className="text-xs text-soft font-mono mt-1.5 line-clamp-2 leading-relaxed bg-inset p-2 rounded-lg border border-line">
                              {renderedSample}
                            </p>
                          </div>
                        </div>

                        {/* Template Action Buttons */}
                        <div className="mt-3 pt-2 border-t border-line flex items-center justify-between">
                          {!tpl.isDefault ? (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(tpl.id)}
                              className="min-h-11 px-1 text-sm font-bold text-soft hover:text-accent-text flex items-center gap-1 transition-colors"
                            >
                              <Star className="w-4 h-4 text-faint" aria-hidden="true" />
                              <span>Set as Default</span>
                            </button>
                          ) : (
                            <span className="text-sm font-semibold text-success-text flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                              Active for One-Tap Send
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(tpl.id)}
                              aria-label={`Duplicate template ${tpl.title}`}
                              className="w-11 h-11 flex items-center justify-center text-faint hover:text-ink hover:bg-inset rounded-lg transition-colors"
                            >
                              <Copy className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tpl)}
                              aria-label={`Edit template ${tpl.title}`}
                              className="w-11 h-11 flex items-center justify-center text-faint hover:text-accent-text hover:bg-accent-soft rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" aria-hidden="true" />
                            </button>

                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 bg-danger-soft px-2 py-1 rounded-lg border border-danger">
                                <span className="text-xs font-bold text-danger-text">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(tpl.id)}
                                  aria-label={`Confirm delete ${tpl.title}`}
                                  className="min-h-9 px-2 text-xs font-bold text-white bg-danger hover:opacity-90 rounded-lg"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  aria-label="Cancel delete"
                                  className="min-h-9 px-2 text-xs font-medium text-soft hover:text-ink rounded-lg"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(tpl.id)}
                                aria-label={`Delete template ${tpl.title}`}
                                className="w-11 h-11 flex items-center justify-center text-faint hover:text-danger-text hover:bg-danger-soft rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* CREATE / EDIT TEMPLATE FORM */
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h3 className="text-sm font-bold text-ink">
                  {isCreating ? 'Create WhatsApp Pitch Message' : 'Edit WhatsApp Pitch Message'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTemplate(null);
                  }}
                  className="min-h-11 px-2 text-sm text-soft hover:text-ink"
                >
                  Cancel
                </button>
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="tpl-title" className="text-xs font-bold text-soft">
                    Template Title *
                  </label>
                  <input
                    id="tpl-title"
                    data-autofocus
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Standard Gym Intro Pitch"
                    className="w-full text-sm bg-inset border border-line rounded-xl p-2.5 mt-1 font-semibold text-ink focus:ring-2 focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label htmlFor="tpl-category" className="text-xs font-bold text-soft">
                    Category
                  </label>
                  <select
                    id="tpl-category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as TemplateCategory })
                    }
                    className="w-full text-sm bg-inset border border-line rounded-xl p-2.5 mt-1 font-semibold text-ink focus:ring-2 focus:ring-focus-ring"
                  >
                    <option value="INTRO">Intro — Introduction & First Pitch</option>
                    <option value="SAMPLE_OFFER">Sample Offer — 1kg Sample Offer</option>
                    <option value="PRICING">Pricing — Wholesale Margins & Rates</option>
                    <option value="FOLLOW_UP">Follow-up — Post-Call Follow-up</option>
                    <option value="RE_ENGAGE">Re-engage — Re-engagement & Restock</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Variable Tag Chips */}
              <div>
                <span className="text-xs font-bold text-soft" id="tpl-vars-label">
                  Insert Dynamic Lead Variables (tap to insert)
                </span>
                <div
                  className="flex flex-wrap gap-1.5 mt-1.5"
                  role="group"
                  aria-labelledby="tpl-vars-label"
                >
                  {TEMPLATE_VARIABLES.map(({ tag, desc }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      aria-label={`Insert ${desc}`}
                      className="min-h-9 py-1 px-2 rounded-lg text-xs font-mono font-bold bg-accent-soft hover:bg-accent/20 text-accent-text border border-accent transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Textarea */}
              <div>
                <label htmlFor="tpl-body" className="text-xs font-bold text-soft">
                  Message Body *
                </label>
                <textarea
                  id="tpl-body"
                  ref={textareaRef}
                  rows={6}
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Type your message with {{businessName}} and {{locality}}..."
                  className="w-full text-sm bg-inset border border-line rounded-xl p-3 mt-1 font-mono text-ink leading-relaxed focus:ring-2 focus:ring-focus-ring focus:outline-none"
                />
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)] rounded-sm border-line-strong focus:ring-2 focus:ring-focus-ring"
                />
                <span className="text-sm font-bold text-ink">
                  Set as the default message for all leads (One-Tap Send)
                </span>
              </label>

              {/* Live Rendered Preview */}
              <div className="p-3 bg-inset rounded-xl border border-line space-y-1">
                <div className="flex items-center gap-1 text-xs font-bold text-faint uppercase tracking-tight">
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Live Preview (with sample lead: Skywards Fitness Zone, Alambagh)</span>
                </div>
                <p className="text-sm text-ink font-mono whitespace-pre-wrap leading-relaxed">
                  {renderMessageTemplate(formData.body, { lead: SAMPLE_LEAD })}
                </p>
              </div>

              {/* Form Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={!formData.title.trim() || !formData.body.trim()}
                  className="min-h-11 flex-1 py-3 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm shadow-md disabled:opacity-50 transition-colors"
                >
                  Save Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTemplate(null);
                  }}
                  className="min-h-11 py-3 px-4 rounded-xl bg-inset hover:bg-inset-strong text-ink font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEFAULT CATALOGUE */}
      {activeTab === 'CATALOGUE' && (
        <div
          role="tabpanel"
          id="settings-panel-catalogue"
          aria-labelledby="settings-tab-catalogue"
          className="space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-ink">Default Product Catalogue & Collateral</h3>
            <p className="text-xs text-soft mt-0.5">
              Select your product catalogue PDF or price sheet once. When you tap Quick Send on any
              lead, this catalogue is automatically attached.
            </p>
          </div>

          {catalogueError && (
            <div
              role="alert"
              className="p-3 bg-danger-soft border border-danger rounded-xl text-sm text-danger-text flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{catalogueError}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*,.doc,.docx"
            onChange={handleCatalogueUpload}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {defaultCatalogue ? (
            <div className="bg-accent-soft border border-accent rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {defaultCatalogue.isPdf ? (
                    <div className="w-10 h-10 rounded-xl bg-danger-soft text-danger-text flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-ink">{defaultCatalogue.name}</p>
                    <p className="text-xs text-soft mt-0.5">
                      {defaultCatalogue.sizeFormatted} •{' '}
                      {defaultCatalogue.isPdf ? 'PDF Document' : 'Image'}
                    </p>
                    <p className="text-xs text-success-text font-semibold mt-1">
                      ✓ Ready for auto-attachment during Quick Send
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-11 py-2 px-3 rounded-xl bg-surface hover:bg-inset border border-line-strong text-ink text-sm font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Replace Catalogue</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveCatalogue}
                  className="min-h-11 py-2 px-3 rounded-xl bg-surface hover:bg-danger-soft border border-danger text-danger-text text-sm font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-line-strong rounded-2xl bg-inset text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-sm text-ink">Select Default Catalogue PDF</p>
                <p className="text-xs text-soft mt-0.5">
                  PDF, Images, or DOC up to 25 MB. Saved 100% locally on this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-11 py-1.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm mt-2"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PREFERENCES */}
      {activeTab === 'PREFERENCES' && (
        <div
          role="tabpanel"
          id="settings-panel-preferences"
          aria-labelledby="settings-tab-preferences"
          className="space-y-4"
        >
          {/* ── Sync Status Section ── */}
          <div>
            <h3 className="text-sm font-bold text-ink">Sync Status</h3>
            <p className="text-xs text-soft mt-0.5">
              Data is automatically synced in the background. You can also trigger a sync manually.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl border border-line bg-surface space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-ink">Cloud Sync</p>
                <p className="text-xs text-soft leading-normal">
                  {syncState?.lastSuccessfulSyncAt
                    ? `Last synced: ${new Date(syncState.lastSuccessfulSyncAt).toLocaleString()}`
                    : 'Not yet synced this session'}
                </p>
                {syncState?.lastSyncError && (
                  <p className="text-xs text-danger-text">{syncState.lastSyncError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => synchronizeNow()}
                disabled={isSyncing}
                className="min-h-11 py-2 px-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-default flex-shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* ── Appearance Section ── */}
          <div>
            <h3 className="text-sm font-bold text-ink mt-2">Appearance</h3>
            <p className="text-xs text-soft mt-0.5">
              Choose your preferred app theme. This setting is saved on your device.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl border border-line bg-surface space-y-2">
            <p className="font-bold text-sm text-ink" id="theme-choice-label">
              App Theme
            </p>
            <div
              className="flex items-center gap-2"
              role="group"
              aria-labelledby="theme-choice-label"
            >
              <button
                type="button"
                onClick={() => setTheme('NIGHT')}
                aria-pressed={theme === 'NIGHT'}
                className={`min-h-11 flex-1 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'NIGHT'
                    ? 'bg-ink text-app border-ink shadow-sm'
                    : 'bg-surface text-soft border-line hover:border-line-strong'
                }`}
              >
                <Moon className="w-4 h-4" aria-hidden="true" />
                <span>Night</span>
                {theme === 'NIGHT' && (
                  <CheckCircle2 className="w-4 h-4 text-accent-text" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTheme('DAY')}
                aria-pressed={theme === 'DAY'}
                className={`min-h-11 flex-1 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  theme === 'DAY'
                    ? 'bg-warning-soft text-warning-text border-warning shadow-sm'
                    : 'bg-surface text-soft border-line hover:border-line-strong'
                }`}
              >
                <Sun className="w-4 h-4" aria-hidden="true" />
                <span>Day</span>
                {theme === 'DAY' && (
                  <CheckCircle2 className="w-4 h-4 text-accent-text" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* ── WhatsApp Preferences ── */}
          <div>
            <h3 className="text-sm font-bold text-ink mt-2">WhatsApp Outreach Preferences</h3>
            <p className="text-xs text-soft mt-0.5">
              Configure the one-tap sales workflow behavior on your device.
            </p>
          </div>

          {/* Toggle 1: Preview Before WhatsApp */}
          <div className="p-3.5 rounded-2xl border border-line bg-surface flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-ink" id="preview-toggle-label">
                Preview Before WhatsApp
              </p>
              <p className="text-xs text-soft leading-normal">
                Show the personalized message & catalogue preview before launching WhatsApp.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={previewEnabled}
              aria-labelledby="preview-toggle-label"
              onClick={() => handleTogglePreview(!previewEnabled)}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                previewEnabled ? 'bg-accent' : 'bg-inset-strong'
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white border border-line rounded-full transition-transform ${
                  previewEnabled ? 'translate-x-full' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* User Profile & Session Info */}
          {currentUser && (
            <div className="p-3.5 rounded-2xl border border-line bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-faint" aria-hidden="true" />
                    <p className="font-bold text-sm text-ink">{currentUser.name}</p>
                  </div>
                  <p className="text-xs text-soft ml-6">{currentUser.email}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-info-soft text-info-text border-info'
                      : 'bg-success-soft text-success-text border-success'
                  }`}
                >
                  {labelFor(currentUser.role)}
                </span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await signOut();
                }}
                className="min-h-11 w-full py-2 px-3 rounded-xl bg-danger-soft hover:bg-danger/20 border border-danger text-danger-text text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Status Note */}
          <div className="p-3 bg-inset rounded-xl border border-line text-xs text-soft space-y-1">
            <p className="font-bold text-ink">Local-First & Offline Integrity</p>
            <p>
              All templates, lead records, and settings are preserved locally on your device in
              IndexedDB. Logging out clears the authenticated session but does not delete local CRM
              records.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 mt-2 border-t border-line flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 py-2 px-4 rounded-xl bg-ink hover:opacity-90 text-app font-bold text-sm transition-colors"
        >
          Close Settings
        </button>
      </div>
    </Modal>
  );
};
