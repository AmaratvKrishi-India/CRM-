/**
 * Attachment & Collateral Service
 * Handles local PDF and image file validation, metadata formatting, and safe Android sharing preparation.
 */

export interface AttachmentMetadata {
  file: File;
  name: string;
  sizeFormatted: string;
  sizeBytes: number;
  type: string;
  isPdf: boolean;
  isImage: boolean;
  localUrl: string;
}

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB WhatsApp limit

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export class AttachmentService {
  /**
   * Formats raw byte count into human-readable size string (e.g. 1.5 MB, 320 KB).
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Validates selected file against MIME types and size constraints.
   */
  static validateFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file selected.' };
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return {
        isValid: false,
        error: `File size (${this.formatFileSize(file.size)}) exceeds the 25 MB WhatsApp limit.`,
      };
    }

    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
    const hasAllowedExtension = /\.(pdf|jpe?g|png|webp|doc|docx)$/i.test(file.name);

    if (!isAllowedMime && !hasAllowedExtension) {
      return {
        isValid: false,
        error: 'Unsupported file type. Please attach a PDF catalogue, image, or document.',
      };
    }

    return { isValid: true };
  }

  /**
   * Creates an AttachmentMetadata record from a validated File object.
   */
  static createAttachmentMetadata(file: File): AttachmentMetadata {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);
    const localUrl = URL.createObjectURL(file);

    return {
      file,
      name: file.name,
      sizeFormatted: this.formatFileSize(file.size),
      sizeBytes: file.size,
      type: file.type || 'application/octet-stream',
      isPdf,
      isImage,
      localUrl,
    };
  }

  /**
   * Releases an allocated object URL.
   */
  static revokeAttachmentUrl(metadata: AttachmentMetadata): void {
    if (metadata.localUrl) {
      try {
        URL.revokeObjectURL(metadata.localUrl);
      } catch {
        // Ignore revocation errors
      }
    }
  }
}
