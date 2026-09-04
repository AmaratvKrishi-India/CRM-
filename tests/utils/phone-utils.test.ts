/**
 * Phone normalization regression tests.
 *
 * The application owns this behavior in leadNormalizer; the retired utils/phone
 * path exposed a different, less strict contract. These cases exercise the
 * production normalization path used for manual entry and spreadsheet import.
 */

import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from '@/db/services/leadNormalizer';

describe('Phone normalization', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize +91 mobile numbers', () => {
      for (const value of ['+919876543210', '+91 98765 43210', '+91-98765-43210']) {
        expect(normalizePhoneNumber(value)).toMatchObject({ clean: '9876543210', e164: '+919876543210', isValid: true });
      }
    });

    it('should normalize 0-prefixed mobile numbers', () => {
      for (const value of ['09876543210', '0 98765 43210']) {
        expect(normalizePhoneNumber(value).clean).toBe('9876543210');
      }
    });

    it('should normalize 91-prefixed numbers without a plus sign', () => {
      expect(normalizePhoneNumber('919876543210').clean).toBe('9876543210');
    });

    it('should handle plain 10-digit mobile numbers', () => {
      expect(normalizePhoneNumber('9876543210')).toMatchObject({ clean: '9876543210', type: 'mobile', isValid: true });
    });

    it('should normalize Lucknow STD landlines', () => {
      for (const value of ['0522 2345678', '0522-2345678', '+91 522 2345678']) {
        expect(normalizePhoneNumber(value)).toMatchObject({ clean: '05222345678', type: 'landline', isValid: true });
      }
    });

    it('should remove punctuation before validating formatted input', () => {
      expect(normalizePhoneNumber('+91 (987) 654-3210').clean).toBe('9876543210');
      expect(normalizePhoneNumber('987.654.3210').clean).toBe('9876543210');
    });

    it('should return an invalid result for missing or malformed input', () => {
      for (const value of ['', 'abc', '123', null, undefined]) {
        expect(normalizePhoneNumber(value)).toMatchObject({ isValid: false, type: 'invalid' });
      }
    });
  });

  describe('display formatting', () => {
    it('should format Indian mobile numbers for display', () => {
      const result = normalizePhoneNumber('9876543210');
      expect(result.displayFormatted).toBe('+91 98765 43210');
      expect(result.e164).toBe('+919876543210');
    });

    it('should format Lucknow landlines for display', () => {
      const result = normalizePhoneNumber('05222345678');
      expect(result.displayFormatted).toBe('0522 234 5678');
      expect(result.e164).toBe('+915222345678');
    });

    it('should normalize an already formatted number to one display format', () => {
      expect(normalizePhoneNumber('+91 98765 43210').displayFormatted).toBe('+91 98765 43210');
    });

    it('should preserve unrecognized raw input for operator review', () => {
      expect(normalizePhoneNumber('abc').displayFormatted).toBe('abc');
      expect(normalizePhoneNumber('123').displayFormatted).toBe('123');
    });
  });

  describe('validation', () => {
    it('should validate mobile numbers', () => {
      for (const value of ['9876543210', '+919876543210', '09876543210', '919876543210']) {
        expect(normalizePhoneNumber(value)).toMatchObject({ type: 'mobile', isValid: true, canWhatsApp: true });
      }
    });

    it('should validate Lucknow landline numbers', () => {
      for (const value of ['05222345678', '+915222345678', '2345678']) {
        expect(normalizePhoneNumber(value)).toMatchObject({ type: 'landline', isValid: true, canWhatsApp: false });
      }
    });

    it('should reject invalid numbers', () => {
      for (const value of ['1234567890', '987654321', '98765432101', 'abcdefghij', '']) {
        expect(normalizePhoneNumber(value).isValid).toBe(false);
      }
    });

    it('should accept each supported mobile starting digit', () => {
      for (const leadingDigit of ['6', '7', '8', '9']) {
        expect(normalizePhoneNumber(`${leadingDigit}123456789`)).toMatchObject({ type: 'mobile', isValid: true });
      }
    });
  });

  describe('input digit handling', () => {
    it('should normalize formatted digits consistently', () => {
      const formatted = normalizePhoneNumber('+91 98765 43210');
      const punctuated = normalizePhoneNumber('(987) 654-3210');
      expect(formatted.clean).toBe('9876543210');
      expect(punctuated.clean).toBe('9876543210');
    });

    it('should handle an empty string without manufacturing a number', () => {
      expect(normalizePhoneNumber('')).toMatchObject({ clean: '', e164: '', isValid: false });
    });
  });

  describe('phone type', () => {
    it('should identify mobile numbers', () => {
      expect(normalizePhoneNumber('9876543210').type).toBe('mobile');
      expect(normalizePhoneNumber('+919876543210').type).toBe('mobile');
    });

    it('should identify landline numbers', () => {
      expect(normalizePhoneNumber('05222345678').type).toBe('landline');
      expect(normalizePhoneNumber('+915222345678').type).toBe('landline');
    });

    it('should reject unsupported toll-free numbers instead of misclassifying them', () => {
      expect(normalizePhoneNumber('1800123456')).toMatchObject({ type: 'invalid', isValid: false });
    });

    it('should return invalid for unrecognized numbers', () => {
      expect(normalizePhoneNumber('1234567890').type).toBe('invalid');
    });
  });
});
