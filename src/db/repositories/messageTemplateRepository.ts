/**
 * MessageTemplate Repository
 * Manages message templates, default template assignments, and variable rendering with dynamic lead data.
 */

import type { SalesCRMDatabase } from '../database';
import type { MessageTemplate, TemplateCategory, Lead } from '../types';

export class MessageTemplateRepository {
  constructor(private db: SalesCRMDatabase) {}

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Retrieves all active templates.
   */
  async getAllTemplates(): Promise<MessageTemplate[]> {
    this.db.requireAccessScope();
    return await this.db.messageTemplates
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  /**
   * Retrieves a single template by ID.
   */
  async getTemplateById(id: string): Promise<MessageTemplate | undefined> {
    this.db.requireAccessScope();
    const tpl = await this.db.messageTemplates.get(id);
    if (tpl && tpl.deletedAt === null) return tpl;
    return undefined;
  }

  /**
   * Retrieves the current default message template.
   * If multiple or none are marked default, picks the primary designated one or the first active one.
   */
  async getDefaultTemplate(): Promise<MessageTemplate | undefined> {
    const all = await this.getAllTemplates();
    if (all.length === 0) return undefined;
    const def = all.find((t) => t.isDefault);
    return def || all[0];
  }

  /**
   * Sets a template as the single default template.
   * Ensures all other active templates have isDefault: false.
   */
  async setDefaultTemplate(templateId: string): Promise<MessageTemplate> {
    this.db.requireAccessScope();
    const now = new Date().toISOString();
    await this.db.transaction('rw', this.db.messageTemplates, async () => {
      const all = await this.db.messageTemplates
        .filter((t) => t.deletedAt === null)
        .toArray();

      for (const t of all) {
        if (t.id === templateId) {
          await this.db.messageTemplates.update(t.id, {
            isDefault: true,
            updatedAt: now,
            isSynced: 0,
          });
        } else if (t.isDefault) {
          await this.db.messageTemplates.update(t.id, {
            isDefault: false,
            updatedAt: now,
            isSynced: 0,
          });
        }
      }
    });

    return (await this.db.messageTemplates.get(templateId))!;
  }

  /**
   * Retrieves templates filtered by category.
   */
  async getTemplatesByCategory(category: TemplateCategory): Promise<MessageTemplate[]> {
    this.db.requireAccessScope();
    return await this.db.messageTemplates
      .filter((t) => t.deletedAt === null && t.category === category)
      .toArray();
  }

  /**
   * Creates a custom template.
   */
  async createTemplate(params: {
    title: string;
    category?: TemplateCategory;
    body: string;
    isDefault?: boolean;
  }): Promise<MessageTemplate> {
    this.db.requireAccessScope();
    const now = new Date().toISOString();
    const isDefault = params.isDefault || false;

    const template: MessageTemplate = {
      id: this.generateId(),
      title: params.title.trim(),
      category: params.category || 'INTRO',
      body: params.body.trim(),
      isDefault,
      createdAt: now,
      updatedAt: now,
      isSynced: 0,
      deletedAt: null,
    };

    if (isDefault) {
      await this.setDefaultTemplate(template.id);
    }

    await this.db.messageTemplates.add(template);

    if (isDefault) {
      // Re-apply to guarantee exclusivity
      await this.setDefaultTemplate(template.id);
    }

    return template;
  }

  /**
   * Duplicates an existing template.
   */
  async duplicateTemplate(id: string): Promise<MessageTemplate> {
    const original = await this.getTemplateById(id);
    if (!original) {
      throw new Error(`Template with id ${id} not found.`);
    }

    return await this.createTemplate({
      title: `Copy of ${original.title}`,
      category: original.category,
      body: original.body,
      isDefault: false,
    });
  }

  /**
   * Updates an existing template.
   */
  async updateTemplate(
    id: string,
    updates: Partial<Pick<MessageTemplate, 'title' | 'category' | 'body' | 'isDefault'>>
  ): Promise<MessageTemplate> {
    const now = new Date().toISOString();

    if (updates.isDefault) {
      await this.setDefaultTemplate(id);
    }

    await this.db.messageTemplates.update(id, {
      ...updates,
      updatedAt: now,
      isSynced: 0,
    });

    return (await this.db.messageTemplates.get(id))!;
  }

  /**
   * Renders template text by substituting dynamic lead placeholders.
   */
  renderTemplate(templateBody: string, lead: Lead, repName = 'Amaratv Krishi Team'): string {
    this.db.requireAccessScope();
    let text = templateBody;
    const contactOrSir = lead.contactPerson || 'Gym Manager / Owner';

    text = text.replace(/\{\{businessName\}\}/g, lead.businessName);
    text = text.replace(/\{\{contactPersonOrSir\}\}/g, contactOrSir);
    text = text.replace(/\{\{contactPerson\}\}/g, lead.contactPerson || 'Sir/Madam');
    text = text.replace(/\{\{locality\}\}/g, lead.locality || 'Lucknow');
    text = text.replace(/\{\{city\}\}/g, lead.city || 'Lucknow');
    text = text.replace(/\{\{phone\}\}/g, lead.phoneE164 || lead.phone);
    text = text.replace(/\{\{followUpDate\}\}/g, lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : 'soon');
    text = text.replace(/\{\{repName\}\}/g, repName);

    // Remove any unresolved tags
    text = text.replace(/\{\{[a-zA-Z0-9_-]+\}\}/g, '');

    return text.trim();
  }

  /**
   * Soft-deletes a template.
   */
  async softDeleteTemplate(id: string): Promise<void> {
    this.db.requireAccessScope();
    const now = new Date().toISOString();
    await this.db.messageTemplates.update(id, {
      deletedAt: now,
      updatedAt: now,
      isDefault: false,
      isSynced: 0,
    });
  }
}
