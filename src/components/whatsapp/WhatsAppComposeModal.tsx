import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Paperclip,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Share2,
  Sparkles,
  Edit3,
  Settings,
  Send,
  Zap,
} from 'lucide-react';
import { crmData } from '../../db';
import { Lead, MessageTemplate, TemplateCategory } from '../../db/types';
import { renderMessageTemplate } from '../../services/templateRenderer';
import {
  AttachmentService,
  AttachmentMetadata,
} from '../../services/attachmentService';
import { AppSettingsService } from '../../services/appSettingsService';
import { NativePlatformService } from '../../services/nativePlatform';

interface WhatsAppComposeModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenSettings?: () => void;
}

export const WhatsAppComposeModal: React.FC<WhatsAppComposeModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSuccess,
  onOpenSettings,
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentMetadata | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load templates & default configuration on open
  useEffect(() => {
    if (isOpen && lead) {
      setErrorMessage(null);
      setCatalogueWarning(null);
      setIsEditingMessage(false);

      crmData.templates.getAllTemplates().then((tpls) => {
        setTemplates(tpls);

        if (tpls.length === 0) {
          setIsFirstTimeSetup(true);
          return;
        }

        setIsFirstTimeSetup(false);

        // Find single default or fallback
        const defaultTpl = tpls.find((t) => t.isDefault) || tpls[0];
        setSelectedTemplateId(defaultTpl.id);
        const rendered = renderMessageTemplate(defaultTpl.body, { lead });
        setMessageText(rendered);

        // Load Default Catalogue if configured
        const storedCatalogue = AppSettingsService.getDefaultCatalogue();
        if (storedCatalogue) {
          const defaultAtt = AppSettingsService.createAttachmentFromStoredCatalogue(storedCatalogue);
          if (defaultAtt) {
            setAttachment(defaultAtt);
          } else {
            setCatalogueWarning('Default catalogue is unavailable. Please select another file.');
          }
        }
      });
    } else {
      // Clean up attachment when closed
      if (attachment) {
        AttachmentService.revokeAttachmentUrl(attachment);
        setAttachment(null);
      }
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const isLandline = lead.phoneType === 'landline';
  const isInvalidPhone = !lead.phone || lead.phoneType === 'invalid';

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const chosen = templates.find((t) => t.id === templateId);
    if (chosen && lead) {
      const rendered = renderMessageTemplate(chosen.body, { lead });
      setMessageText(rendered);
    }
  };

  const handleCreateDefaultIntro = async () => {
    try {
      const tpl = await crmData.templates.createTemplate({
        title: 'Amaratv Krishi — Standard Intro Pitch',
        category: 'INTRO',
        body: `Hello {{businessName}},\n\nI’m reaching out from Amaratv Krishi.\n\nWe supply high-protein flour suitable for fitness and wellness customers in {{locality}}.\n\nWe would like to introduce our products at your centre and provide a sample for evaluation.\n\nPlease let us know a convenient time to connect.\n\nRegards,\nAmaratv Krishi`,
        isDefault: true,
      });

      const all = await crmData.templates.getAllTemplates();
      setTemplates(all);
      setSelectedTemplateId(tpl.id);
      setMessageText(renderMessageTemplate(tpl.body, { lead }));
      setIsFirstTimeSetup(false);
    } catch (err) {
      console.error('Failed to create default template:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const validation = AttachmentService.validateFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Invalid file.');
      return;
    }

    setErrorMessage(null);
    setCatalogueWarning(null);
    if (attachment) {
      AttachmentService.revokeAttachmentUrl(attachment);
    }
    const meta = AttachmentService.createAttachmentMetadata(file);
    setAttachment(meta);
  };

  const handleRemoveAttachment = () => {
    if (attachment) {
      AttachmentService.revokeAttachmentUrl(attachment);
      setAttachment(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenWhatsApp = async () => {
    if (isLandline || isInvalidPhone || !lead.phone) {
      setErrorMessage('WhatsApp is unavailable for this phone number.');
      return;
    }

    setIsLaunching(true);
    setErrorMessage(null);

    let loggedMessageId = '';

    try {
      // 1. Create MessageHistory record with status INITIATED
      const logRecord = await crmData.messages.logMessage({
        leadId: lead.id,
        channel: 'WHATSAPP',
        templateId: selectedTemplateId || null,
        recipientPhone: lead.phoneE164 || lead.phone,
        messageContent: messageText,
        sentStatus: 'INITIATED',
      });
      loggedMessageId = logRecord.id;

      // 2. Launch WhatsApp or Native Share Intent
      // wa.me links require the full international number (country code included),
      // so prefer the E.164 form over the 10-digit clean number.
      const waPhone = lead.phoneE164 || lead.phone;
      if (attachment) {
        const shareSuccess = await NativePlatformService.share({
          title: `Amaratv Krishi — ${lead.businessName}`,
          text: messageText,
          files: [attachment.localUrl],
          dialogTitle: 'Share Catalogue via WhatsApp',
        });

        if (!shareSuccess) {
          NativePlatformService.openWhatsApp(waPhone, messageText);
        }
      } else {
        NativePlatformService.openWhatsApp(waPhone, messageText);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('WhatsApp launch failed:', err);
      if (loggedMessageId) {
        await crmData.messages.updateMessageStatus(loggedMessageId, 'FAILED');
      }
      setErrorMessage(
        'Could not open WhatsApp. Please ensure WhatsApp or WhatsApp Business is installed on your device.'
      );
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{lead.businessName}</h3>
              <p className="text-[11px] text-emerald-100 font-mono truncate">
                {lead.phoneE164 || lead.phone} • {lead.locality}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="p-1.5 text-emerald-100 hover:text-white rounded-lg hover:bg-emerald-600 transition-colors"
                title="Manage Pitch Templates & Catalogue in Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-emerald-100 hover:text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Landline Warning */}
          {isLandline && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>WhatsApp Unavailable for Landlines</strong>
                <p className="text-blue-700 mt-0.5">
                  This contact has a Lucknow landline number (0522). Please use the <strong>Phone Call</strong> button instead.
                </p>
              </div>
            </div>
          )}

          {isInvalidPhone && !isLandline && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Invalid phone number. WhatsApp messaging cannot be initiated.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {catalogueWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{catalogueWarning}</span>
            </div>
          )}

          {/* First-Time Setup Prompt */}
          {isFirstTimeSetup ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-emerald-950">Create Your Default WhatsApp Message</h4>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Save a generic message once. Amaratv CRM will automatically insert the gym name and locality for every lead.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateDefaultIntro}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                >
                  Use Amaratv Intro Pitch
                </button>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-100/50 border border-emerald-300 text-emerald-800 font-bold text-xs transition-colors"
                  >
                    Write My Own
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Template Selector Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                    Pitch Template:
                  </span>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg py-1 px-2 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.isDefault ? `★ [Default] ${tpl.title}` : tpl.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingMessage(!isEditingMessage)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                    isEditingMessage
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  title="Edit message for this lead"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditingMessage ? 'Done Editing' : 'Edit'}</span>
                </button>
              </div>

              {/* Message Preview / Editor Box */}
              <div className="space-y-1">
                {isEditingMessage ? (
                  <textarea
                    rows={6}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your WhatsApp message..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <p className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                      {messageText}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-200/60">
                      ✓ Personalised with {lead.businessName} & {lead.locality || 'Lucknow'}
                    </p>
                  </div>
                )}
              </div>

              {/* Product Catalogue Attachment Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {attachment ? (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {attachment.isPdf ? (
                        <FileText className="w-6 h-6 text-rose-500 flex-shrink-0" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{attachment.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {attachment.sizeFormatted} • {attachment.isPdf ? 'PDF Document' : 'Image'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 hover:bg-emerald-50/40 text-slate-600 hover:text-emerald-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    <span>Attach Product Catalogue PDF (Optional)</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isLaunching || isLandline || isInvalidPhone || !messageText.trim()}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLaunching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : attachment ? (
                <Share2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {attachment
                  ? 'Quick Send: Catalogue & Message in WhatsApp'
                  : 'Quick Send: Open in WhatsApp'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isLaunching}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
