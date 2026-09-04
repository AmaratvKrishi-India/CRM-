import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Paperclip,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Trash2,
  Share2,
  Sparkles,
  Edit3,
  Settings,
  Send,
} from 'lucide-react';
import { crmData } from '../../db';
import type { Lead, MessageTemplate } from '../../db/types';
import { renderMessageTemplate } from '../../services/templateRenderer';
import type {
  AttachmentMetadata} from '../../services/attachmentService';
import {
  AttachmentService
} from '../../services/attachmentService';
import { AppSettingsService } from '../../services/appSettingsService';
import { NativePlatformService } from '../../services/nativePlatform';
import { Modal } from '../common/Modal';

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

  if (!lead) return null;

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

      // F8 — Successful hand-off to WhatsApp/share: advance the log from
      // INITIATED to SENT so the activity timeline shows a terminal state.
      // (True delivery confirmation is not possible from a wa.me hand-off,
      // so SENT here means "handed to WhatsApp".)
      if (loggedMessageId) {
        await crmData.messages.updateMessageStatus(loggedMessageId, 'SENT');
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lead.businessName}
      subtitle={`${lead.phoneE164 || lead.phone} • ${lead.locality}`}
      closeOnBackdrop={false}
      maxWidthClassName="max-w-lg"
      headerIcon={
        <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-text flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5" aria-hidden="true" />
        </span>
      }
    >
      {/* Modal Content */}
      <div className="space-y-4">
        {/* Landline Warning */}
        {isLandline && (
          <div className="p-3 bg-info-soft border border-info/30 rounded-xl text-sm text-info-text flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong>WhatsApp unavailable for landlines</strong>
              <p className="mt-0.5">
                This contact has a Lucknow landline number (0522). Please use the <strong>Call</strong> button instead.
              </p>
            </div>
          </div>
        )}

        {isInvalidPhone && !isLandline && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-sm text-danger-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Invalid phone number. WhatsApp messaging cannot be initiated.</span>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="p-3 bg-danger-soft border border-danger/30 rounded-xl text-sm text-danger-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {catalogueWarning && (
          <div role="alert" className="p-3 bg-warning-soft border border-warning/30 rounded-xl text-sm text-warning-text flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{catalogueWarning}</span>
          </div>
        )}

        {/* First-Time Setup Prompt */}
        {isFirstTimeSetup ? (
          <div className="p-4 bg-accent-soft border border-accent/30 rounded-2xl space-y-3 text-center">
            <div className="w-10 h-10 rounded-2xl bg-accent text-on-accent flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-ink">Create your default WhatsApp message</h4>
              <p className="text-sm text-soft mt-0.5">
                Save a generic message once. Amaratv CRM will automatically insert the gym name and locality for every lead.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateDefaultIntro}
                className="flex-1 min-h-11 py-2.5 px-3 rounded-xl bg-accent hover:bg-accent-hover text-on-accent font-bold text-sm transition-colors"
              >
                Use Amaratv intro pitch
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="flex-1 min-h-11 py-2.5 px-3 rounded-xl bg-surface hover:bg-inset border border-line text-soft font-bold text-sm transition-colors"
                >
                Write my own
              </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Template Selector Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label htmlFor="wa-template-select" className="text-sm font-bold text-soft">
                  Pitch template:
                </label>
                <select
                  id="wa-template-select"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="min-h-11 text-sm bg-inset hover:bg-inset-strong border border-line rounded-lg py-1 px-2 text-ink font-bold focus:outline-none focus:ring-2 focus:ring-focus-ring"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.isDefault ? `★ [Default] ${tpl.title}` : tpl.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    aria-label="Manage pitch templates and catalogue in settings"
                    className="min-h-11 min-w-11 px-2 text-soft hover:text-ink rounded-lg hover:bg-inset transition-colors flex items-center justify-center"
                  >
                    <Settings className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingMessage(!isEditingMessage)}
                  aria-pressed={isEditingMessage}
                  className={`min-h-11 text-sm font-bold px-2.5 rounded-lg flex items-center gap-1 transition-colors ${
                    isEditingMessage
                      ? 'bg-accent-soft text-accent-text'
                      : 'text-soft hover:text-ink hover:bg-inset'
                  }`}
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>{isEditingMessage ? 'Done editing' : 'Edit'}</span>
                </button>
              </div>
            </div>

            {/* Message Preview / Editor Box */}
            <div className="space-y-1">
              {isEditingMessage ? (
                <textarea
                  rows={6}
                  aria-label="WhatsApp message text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your WhatsApp message..."
                  className="w-full text-sm bg-inset border border-line rounded-xl p-3 text-ink font-mono leading-relaxed placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-focus-ring"
                />
              ) : (
                <div className="p-3.5 bg-inset border border-line rounded-2xl space-y-1">
                  <p className="text-sm text-ink font-mono whitespace-pre-wrap leading-relaxed">
                    {messageText}
                  </p>
                  <p className="text-xs text-success-text font-semibold pt-1 border-t border-line">
                    ✓ Personalised with {lead.businessName} &amp; {lead.locality || 'Lucknow'}
                  </p>
                </div>
              )}
            </div>

            {/* Product Catalogue Attachment Section */}
            <div className="space-y-2 pt-2 border-t border-line">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />

              {attachment ? (
                <div className="bg-accent-soft/70 border border-accent/30 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachment.isPdf ? (
                      <FileText className="w-6 h-6 text-danger flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-success flex-shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{attachment.name}</p>
                      <p className="text-xs text-soft">
                        {attachment.sizeFormatted} • {attachment.isPdf ? 'PDF document' : 'Image'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    aria-label={`Remove attachment ${attachment.name}`}
                    className="min-h-11 min-w-11 p-1.5 text-faint hover:text-danger rounded-lg hover:bg-surface transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-11 py-2 px-3 border border-dashed border-line-strong hover:border-accent rounded-xl bg-inset hover:bg-accent-soft/40 text-soft hover:text-accent-text text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Paperclip className="w-4 h-4 text-faint" aria-hidden="true" />
                  <span>Attach product catalogue PDF (optional)</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-line flex flex-col gap-2">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={isLaunching || isLandline || isInvalidPhone || !messageText.trim()}
            className="w-full min-h-12 py-3.5 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hover active:scale-[0.99] text-on-accent shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLaunching ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : attachment ? (
              <Share2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {attachment
                ? 'Quick send: catalogue & message in WhatsApp'
                : 'Quick send: open in WhatsApp'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isLaunching}
            className="w-full min-h-11 py-2.5 px-4 rounded-xl font-medium text-sm text-soft hover:text-ink hover:bg-inset transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
