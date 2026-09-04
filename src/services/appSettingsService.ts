/**
 * Application Settings Service
 * Manages local user preferences, default WhatsApp configuration, and default product catalogue.
 * Stored 100% offline in browser localStorage with in-memory fallback.
 */

import type { AttachmentMetadata} from './attachmentService';
import { AttachmentService } from './attachmentService';

export interface StoredCatalogueMeta {
  name: string;
  sizeFormatted: string;
  sizeBytes: number;
  type: string;
  isPdf: boolean;
  isImage: boolean;
  base64Data: string; // Stored locally for offline sharing
  updatedAt: string;
}

export interface AppSettings {
  whatsappPreviewEnabled: boolean;
  defaultCatalogue: StoredCatalogueMeta | null;
}

const SETTINGS_STORAGE_KEY = 'amaratv_crm_app_settings_v1';

// In-memory fallback for environments without localStorage
let inMemorySettings: AppSettings = {
  whatsappPreviewEnabled: true,
  defaultCatalogue: null,
};

export class AppSettingsService {
  /**
   * Loads all application settings from local storage or in-memory fallback.
   */
  static getSettings(): AppSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          inMemorySettings = {
            whatsappPreviewEnabled: parsed.whatsappPreviewEnabled ?? true,
            defaultCatalogue: parsed.defaultCatalogue || null,
          };
          return inMemorySettings;
        }
      }
    } catch {
      // Fall through to inMemorySettings
    }

    return inMemorySettings;
  }

  /**
   * Saves updated settings to local storage and in-memory cache.
   */
  static saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settings,
    };

    inMemorySettings = updated;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('Failed to save app settings to localStorage:', err);
    }

    return updated;
  }

  /**
   * Sets the "Preview before WhatsApp" toggle.
   */
  static setWhatsappPreviewEnabled(enabled: boolean): void {
    this.saveSettings({ whatsappPreviewEnabled: enabled });
  }

  /**
   * Checks if WhatsApp preview is enabled (defaults to true).
   */
  static isWhatsappPreviewEnabled(): boolean {
    return this.getSettings().whatsappPreviewEnabled;
  }

  /**
   * Converts a File into a StoredCatalogueMeta record with Base64 data and saves it.
   */
  static async setDefaultCatalogue(file: File): Promise<StoredCatalogueMeta> {
    const validation = AttachmentService.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid file.');
    }

    const base64Data = await this.fileToBase64(file);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

    const catalogueMeta: StoredCatalogueMeta = {
      name: file.name,
      sizeFormatted: AttachmentService.formatFileSize(file.size),
      sizeBytes: file.size,
      type: file.type || 'application/octet-stream',
      isPdf,
      isImage,
      base64Data,
      updatedAt: new Date().toISOString(),
    };

    this.saveSettings({ defaultCatalogue: catalogueMeta });
    return catalogueMeta;
  }

  /**
   * Clears the default catalogue.
   */
  static clearDefaultCatalogue(): void {
    this.saveSettings({ defaultCatalogue: null });
  }

  /**
   * Gets the stored default catalogue, if configured.
   */
  static getDefaultCatalogue(): StoredCatalogueMeta | null {
    return this.getSettings().defaultCatalogue;
  }

  /**
   * Converts a StoredCatalogueMeta record back into an AttachmentMetadata instance with local object URL.
   * Returns null if missing or corrupted.
   */
  static createAttachmentFromStoredCatalogue(stored: StoredCatalogueMeta): AttachmentMetadata | null {
    try {
      if (!stored || !stored.base64Data) return null;

      const file = this.base64ToFile(stored.base64Data, stored.name, stored.type);
      return AttachmentService.createAttachmentMetadata(file);
    } catch (err) {
      console.warn('Failed to restore default catalogue from stored metadata:', err);
      return null;
    }
  }

  /**
   * Helper: converts File to Base64 string across browser and Node environments.
   */
  private static async fileToBase64(file: File): Promise<string> {
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader result is not a string.'));
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    } else if (file.arrayBuffer) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mime = file.type || 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    return '';
  }

  /**
   * Helper: converts Base64 Data URL to a File object.
   */
  private static base64ToFile(dataUrl: string, filename: string, mimeType: string): File {
    const arr = dataUrl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : mimeType;
    if (typeof atob !== 'undefined') {
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } else {
      const buffer = Buffer.from(arr[1], 'base64');
      return new File([buffer], filename, { type: mime });
    }
  }
}
