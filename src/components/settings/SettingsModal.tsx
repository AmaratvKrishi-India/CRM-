import React, { useState, useEffect, useRef } from 'react';
import {
  X,
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
  ArrowRight,
  Upload,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { crmData } from '../../db';
import { MessageTemplate, TemplateCategory, Lead } from '../../db/types';
import { AppSettingsService, StoredCatalogueMeta } from '../../services/appSettingsService';
import { AttachmentService } from '../../services/attachmentService';
import { renderMessageTemplate } from '../../services/templateRenderer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSync } from '../../services/sync/useSync';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplatesChanged?: () => void;
  initialTab?: 'MESSAGES' | 'CATALOGUE' | 'PREFERENCES';
}

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
  const [activeTab, setActiveTab] = useState<'MESSAGES' | 'CATALOGUE' | 'PREFERENCES'>(initialTab);
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
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSetDefault = async (templateId: string) => {
    try {
      await crmData.templates.setDefaultTemplate(templateId);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
    } catch (err) {
      console.error('Failed to set default template:', err);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      await crmData.templates.duplicateTemplate(templateId);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
    } catch (err) {
      console.error('Failed to duplicate template:', err);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await crmData.templates.softDeleteTemplate(templateId);
      setDeleteConfirmId(null);
      await loadData();
      if (onTemplatesChanged) onTemplatesChanged();
    } catch (err) {
      console.error('Failed to delete template:', err);
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
    } catch (err) {
      console.error('Failed to save template:', err);
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
  };

  const handleTogglePreview = (enabled: boolean) => {
    setPreviewEnabled(enabled);
    AppSettingsService.setWhatsappPreviewEnabled(enabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Settings & Pitch Templates</h3>
              <p className="text-[11px] text-slate-400">Manage WhatsApp messages & collateral</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('MESSAGES');
              setIsCreating(false);
              setEditingTemplate(null);
            }}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'MESSAGES'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Messages</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CATALOGUE')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'CATALOGUE'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>Default Catalogue</span>
            {defaultCatalogue && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Catalogue configured" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PREFERENCES')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'PREFERENCES'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: WHATSAPP MESSAGES */}
          {activeTab === 'MESSAGES' && (
            <div className="space-y-4">
              {!isCreating && !editingTemplate ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                        Saved Pitch Templates ({templates.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Default template is automatically pre-filled when tapping WhatsApp on any lead.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Message</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {templates.map((tpl) => {
                      const renderedSample = renderMessageTemplate(tpl.body, { lead: SAMPLE_LEAD });
                      const isConfirmingDelete = deleteConfirmId === tpl.id;

                      return (
                        <div
                          key={tpl.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            tpl.isDefault
                              ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-xs text-slate-900">{tpl.title}</h5>
                                {tpl.isDefault && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                                    <Check className="w-2.5 h-2.5" /> Default Pitch
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  {tpl.category}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 font-mono mt-1.5 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {renderedSample}
                              </p>
                            </div>
                          </div>

                          {/* Template Action Buttons */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            {!tpl.isDefault ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(tpl.id)}
                                className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                              >
                                <Star className="w-3.5 h-3.5 text-slate-400" />
                                <span>Set as Default</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Active for One-Tap Send
                              </span>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicate(tpl.id)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Duplicate template"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStartEdit(tpl)}
                                className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Edit template"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 animate-in fade-in">
                                  <span className="text-[10px] font-bold text-rose-700">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(tpl.id)}
                                    className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-1.5 py-0.5 rounded"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="text-[10px] font-medium text-slate-600 hover:text-slate-900 px-1"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(tpl.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete template"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* CREATE / EDIT TEMPLATE FORM */
                <div className="space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                      {isCreating ? 'Create WhatsApp Pitch Message' : 'Edit WhatsApp Pitch Message'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingTemplate(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Title & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Template Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Standard Gym Intro Pitch"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value as TemplateCategory })
                        }
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="INTRO">INTRO — Introduction & First Pitch</option>
                        <option value="SAMPLE_OFFER">SAMPLE_OFFER — 1kg Sample Offer</option>
                        <option value="PRICING">PRICING — Wholesale Margins & Rates</option>
                        <option value="FOLLOW_UP">FOLLOW_UP — Post-Call Follow-up</option>
                        <option value="RE_ENGAGE">RE_ENGAGE — Re-engagement & Restock</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Variable Tag Chips */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Insert Dynamic Lead Variables (tap to insert)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {TEMPLATE_VARIABLES.map(({ tag }) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleInsertTag(tag)}
                          className="py-1 px-2 rounded-lg text-[10px] font-mono font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                          title="Click to insert"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Textarea */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Message Body *</label>
                    <textarea
                      ref={textareaRef}
                      rows={6}
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Type your message with {{businessName}} and {{locality}}..."
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Set as Default Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Set as the default message for all leads (One-Tap Send)
                    </span>
                  </label>

                  {/* Live Rendered Preview */}
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      <Eye className="w-3 h-3 text-slate-400" />
                      <span>Live Preview (with sample lead: Skywards Fitness Zone, Alambagh)</span>
                    </div>
                    <p className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                      {renderMessageTemplate(formData.body, { lead: SAMPLE_LEAD })}
                    </p>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveForm}
                      disabled={!formData.title.trim() || !formData.body.trim()}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors"
                    >
                      Save Template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingTemplate(null);
                      }}
                      className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
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
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Default Product Catalogue & Collateral
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select your product catalogue PDF or price sheet once. When you tap Quick Send on any lead, this catalogue is automatically attached.
                </p>
              </div>

              {catalogueError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{catalogueError}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*,.doc,.docx"
                onChange={handleCatalogueUpload}
                className="hidden"
              />

              {defaultCatalogue ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {defaultCatalogue.isPdf ? (
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs text-slate-900">{defaultCatalogue.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {defaultCatalogue.sizeFormatted} • {defaultCatalogue.isPdf ? 'PDF Document' : 'Image'}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                          ✓ Ready for auto-attachment during Quick Send
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Replace Catalogue</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveCatalogue}
                      className="py-2 px-3 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 text-center cursor-pointer transition-all space-y-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-800">Select Default Catalogue PDF</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      PDF, Images, or DOC up to 25 MB. Saved 100% locally on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs mt-2"
                  >
                    Browse Files
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREFERENCES */}
          {activeTab === 'PREFERENCES' && (
            <div className="space-y-4">

              {/* ── Sync Status Section ── */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Sync Status
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Data is automatically synced in the background. You can also trigger a sync manually.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-slate-900">Cloud Sync</p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {syncState?.lastSuccessfulSyncAt
                        ? `Last synced: ${new Date(syncState.lastSuccessfulSyncAt).toLocaleString()}`
                        : 'Not yet synced this session'}
                    </p>
                    {syncState?.lastSyncError && (
                      <p className="text-[11px] text-rose-500">{syncState.lastSyncError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => synchronizeNow()}
                    disabled={isSyncing}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-default flex-shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
                  </button>
                </div>
              </div>

              {/* ── Appearance Section ── */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight mt-2">
                  Appearance
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Choose your preferred app theme. This setting is saved on your device.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                <p className="font-bold text-xs text-slate-900">App Theme</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('NIGHT')}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      theme === 'NIGHT'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Night</span>
                    {theme === 'NIGHT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('DAY')}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      theme === 'DAY'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Day</span>
                    {theme === 'DAY' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                </div>
              </div>

              {/* ── WhatsApp Preferences ── */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight mt-2">
                  WhatsApp Outreach Preferences
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure the one-tap sales workflow behavior on your device.
                </p>
              </div>

              {/* Toggle 1: Preview Before WhatsApp */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-slate-900">Preview Before WhatsApp</p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Show the personalized message & catalogue preview before launching WhatsApp.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={previewEnabled}
                    onChange={(e) => handleTogglePreview(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* User Profile & Session Info */}
              {currentUser && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                        <p className="font-bold text-xs text-slate-900">{currentUser.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 ml-5">{currentUser.email}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        currentUser.role === 'ADMIN'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      onClose();
                      await signOut();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-98"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}

              {/* Status Note */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Local-First & Offline Integrity</p>
                <p>
                  All templates, lead records, and settings are preserved locally on your device in IndexedDB. Logging out clears the authenticated session but does not delete local CRM records.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
