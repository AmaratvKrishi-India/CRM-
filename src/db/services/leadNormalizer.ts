/**
 * Lead Normalization Service
 * Handles data cleaning, phone number standardization (Indian mobile vs Lucknow landlines),
 * address parsing, PIN code extraction, and deduplication keys.
 */

import type { PhoneType } from '../types';

export interface NormalizedPhone {
  raw: string;
  clean: string; // Digits only (e.g. "7054447888" or "05224227316")
  e164: string; // Standard E.164 (e.g. "+917054447888" or "+915224227316")
  type: PhoneType;
  isValid: boolean;
  canWhatsApp: boolean; // True only for mobile numbers
  displayFormatted: string; // e.g. "+91 70544 47888" or "0522 422 7316"
}

export interface ParsedAddress {
  fullAddress: string;
  pincode: string;
  locality: string;
  city: string;
  state: string;
}

/**
 * Normalizes an Indian phone number string (from Excel or manual input).
 * Distinguishes 10-digit mobile numbers from Lucknow STD landlines (0522 / +91 522).
 */
export function normalizePhoneNumber(rawPhone: string | number | null | undefined): NormalizedPhone {
  const invalidResult: NormalizedPhone = {
    raw: '',
    clean: '',
    e164: '',
    type: 'invalid',
    isValid: false,
    canWhatsApp: false,
    displayFormatted: 'N/A',
  };

  if (rawPhone === null || rawPhone === undefined) {
    return invalidResult;
  }

  let raw: string;
  if (typeof rawPhone === 'number') {
    // Excel returns numeric cells as JS numbers; avoid scientific notation/grouping.
    raw = Number.isFinite(rawPhone)
      ? rawPhone.toLocaleString('fullwide', { useGrouping: false })
      : '';
  } else if (typeof rawPhone === 'string') {
    raw = rawPhone.trim();
  } else {
    return invalidResult;
  }

  if (raw === '') {
    return invalidResult;
  }

  const digits = raw.replace(/\D/g, '');

  // Case 1: 10-digit mobile number starting with 6, 7, 8, 9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return {
      raw,
      clean: digits,
      e164: `+91${digits}`,
      type: 'mobile',
      isValid: true,
      canWhatsApp: true,
      displayFormatted: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
    };
  }

  // Case 2: 12-digit number starting with 91 followed by 6, 7, 8, 9 (Indian mobile with +91)
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    const mobile10 = digits.slice(2);
    return {
      raw,
      clean: mobile10,
      e164: `+91${mobile10}`,
      type: 'mobile',
      isValid: true,
      canWhatsApp: true,
      displayFormatted: `+91 ${mobile10.slice(0, 5)} ${mobile10.slice(5)}`,
    };
  }

  // Case 3: 11-digit number starting with 0 followed by 6, 7, 8, 9 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    const mobile10 = digits.slice(1);
    return {
      raw,
      clean: mobile10,
      e164: `+91${mobile10}`,
      type: 'mobile',
      isValid: true,
      canWhatsApp: true,
      displayFormatted: `+91 ${mobile10.slice(0, 5)} ${mobile10.slice(5)}`,
    };
  }

  // Case 4: Lucknow Landline with +91 522 prefix (12 digits starting with 91522)
  if (digits.length === 12 && digits.startsWith('91522')) {
    const localNumber = digits.slice(5); // 7 digit local number
    return {
      raw,
      clean: `0522${localNumber}`,
      e164: `+91522${localNumber}`,
      type: 'landline',
      isValid: true,
      canWhatsApp: false, // Landlines do not support WhatsApp
      displayFormatted: `0522 ${localNumber.slice(0, 3)} ${localNumber.slice(3)}`,
    };
  }

  // Case 5: Lucknow Landline with STD 0522 (11 digits starting with 0522)
  if (digits.length === 11 && digits.startsWith('0522')) {
    const localNumber = digits.slice(4);
    return {
      raw,
      clean: `0522${localNumber}`,
      e164: `+91522${localNumber}`,
      type: 'landline',
      isValid: true,
      canWhatsApp: false,
      displayFormatted: `0522 ${localNumber.slice(0, 3)} ${localNumber.slice(3)}`,
    };
  }

  // Case 6: 7 or 8-digit local landline
  if (digits.length >= 7 && digits.length <= 8) {
    // Local Lucknow landlines begin with 2-4. A 7-8 digit string starting with
    // 6-9 is almost certainly a truncated mobile number (typo), not a landline.
    if (/^[6-9]/.test(digits)) {
      return {
        raw,
        clean: digits,
        e164: digits,
        type: 'invalid',
        isValid: false,
        canWhatsApp: false,
        displayFormatted: raw,
      };
    }

    return {
      raw,
      clean: `0522${digits}`,
      e164: `+91522${digits}`,
      type: 'landline',
      isValid: true,
      canWhatsApp: false,
      displayFormatted: `0522 ${digits}`,
    };
  }

  // Fallback: Non-standard / Invalid
  return {
    raw,
    clean: digits,
    e164: digits.length >= 10 ? `+91${digits.slice(-10)}` : digits,
    type: 'invalid',
    isValid: false,
    canWhatsApp: false,
    displayFormatted: raw,
  };
}

/**
 * Parses raw address strings from the Lucknow dataset.
 * Extracts Lucknow PIN codes (226xxx) and common Lucknow localities.
 */
export function parseAddress(rawAddress: string | null | undefined): ParsedAddress {
  const defaultRes: ParsedAddress = {
    fullAddress: '',
    pincode: '',
    locality: 'Lucknow',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
  };

  if (!rawAddress || typeof rawAddress !== 'string' || rawAddress.trim() === '') {
    return defaultRes;
  }

  const cleanAddr = rawAddress.replace(/\s+/g, ' ').trim();
  defaultRes.fullAddress = cleanAddr;

  // Extract 6-digit Lucknow PIN code (226xxx)
  const pinMatch = cleanAddr.match(/\b(226\d{3})\b/);
  if (pinMatch) {
    defaultRes.pincode = pinMatch[1];
  }

  // Known prominent Lucknow localities
  const knownLocalities = [
    'Alambagh',
    'LDA Colony',
    'Charbagh',
    'Hazratganj',
    'Gomti Nagar',
    'Indira Nagar',
    'Mahanagar',
    'Aliganj',
    'Jankipuram',
    'Chowk',
    'Nishat Ganj',
    'New Hyderabad',
    'Wazirganj',
    'Kaiser Bagh',
    'Aminabad',
    'Rajajipuram',
    'Butler Colony',
    'Sadar',
    'Cantonment',
    'Ashiyana',
    'Telibagh',
    'Vrindavan Colony',
    'Singar Nagar',
    'Chander Nagar',
    'Arya Nagar',
    'Mawaiyya',
    'Aishbagh',
    'Hussainganj',
    'Chinhat',
    'Faizabad Road',
    'Sitapur Road',
    'Kanpur Road',
  ];

  for (const loc of knownLocalities) {
    const regex = new RegExp(`\\b${loc}\\b`, 'i');
    if (regex.test(cleanAddr)) {
      defaultRes.locality = loc;
      break;
    }
  }

  // Fallback: If no known locality matched, pick the token before "Lucknow" or pin
  if (defaultRes.locality === 'Lucknow') {
    const parts = cleanAddr.split(',').map((p) => p.trim()).filter(Boolean);
    const lucknowIdx = parts.findIndex((p) => /lucknow/i.test(p));
    if (lucknowIdx > 0) {
      defaultRes.locality = parts[lucknowIdx - 1];
    } else if (parts.length >= 2) {
      defaultRes.locality = parts[parts.length - 2];
    }
  }

  return defaultRes;
}

/**
 * Sanitizes and cleans business title.
 */
export function cleanBusinessName(rawName: string | null | undefined): string {
  if (!rawName || typeof rawName !== 'string') return 'Unknown Business';
  return rawName
    .replace(/\s+/g, ' ')
    .trim();
}
