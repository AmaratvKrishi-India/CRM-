import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizePhoneNumber,
  parseAddress,
  cleanBusinessName,
} from '../src/db/services/leadNormalizer.ts';

describe('Lead Normalization Service (Tests)', () => {
  describe('Phone Number Normalization', () => {
    it('1. Standard 10-digit Indian mobile number', () => {
      const res = normalizePhoneNumber('9876543210');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'mobile');
      assert.strictEqual(res.canWhatsApp, true);
      assert.strictEqual(res.clean, '9876543210');
      assert.strictEqual(res.e164, '+919876543210');
      assert.strictEqual(res.displayFormatted, '+91 98765 43210');
    });

    it('2. 12-digit Indian mobile number with +91 country code and formatting', () => {
      const res = normalizePhoneNumber('+91 70544 47888');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'mobile');
      assert.strictEqual(res.canWhatsApp, true);
      assert.strictEqual(res.clean, '7054447888');
      assert.strictEqual(res.e164, '+917054447888');
      assert.strictEqual(res.displayFormatted, '+91 70544 47888');
    });

    it('3. 11-digit Indian mobile number with leading 0', () => {
      const res = normalizePhoneNumber('08887776655');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'mobile');
      assert.strictEqual(res.canWhatsApp, true);
      assert.strictEqual(res.clean, '8887776655');
      assert.strictEqual(res.e164, '+918887776655');
      assert.strictEqual(res.displayFormatted, '+91 88877 76655');
    });

    it('4. Lucknow landline with STD 0522 prefix', () => {
      const res = normalizePhoneNumber('0522 4227316');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'landline');
      assert.strictEqual(res.canWhatsApp, false);
      assert.strictEqual(res.clean, '05224227316');
      assert.strictEqual(res.e164, '+915224227316');
      assert.strictEqual(res.displayFormatted, '0522 422 7316');
    });

    it('5. Lucknow landline with +91 522 prefix', () => {
      const res = normalizePhoneNumber('+91 522 2345678');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'landline');
      assert.strictEqual(res.canWhatsApp, false);
      assert.strictEqual(res.clean, '05222345678');
      assert.strictEqual(res.e164, '+915222345678');
      assert.strictEqual(res.displayFormatted, '0522 234 5678');
    });

    it('6. Local 7/8-digit landline number auto-assigned Lucknow STD', () => {
      const res = normalizePhoneNumber('2345678');
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.type, 'landline');
      assert.strictEqual(res.canWhatsApp, false);
      assert.strictEqual(res.clean, '05222345678');
      assert.strictEqual(res.e164, '+915222345678');
    });

    it('7. Empty or invalid phone numbers', () => {
      const emptyRes = normalizePhoneNumber('');
      assert.strictEqual(emptyRes.isValid, false);
      assert.strictEqual(emptyRes.type, 'invalid');
      assert.strictEqual(emptyRes.displayFormatted, 'N/A');

      const nullRes = normalizePhoneNumber(null);
      assert.strictEqual(nullRes.isValid, false);

      const invalidRes = normalizePhoneNumber('12345');
      assert.strictEqual(invalidRes.isValid, false);
      assert.strictEqual(invalidRes.type, 'invalid');
    });
  });

  describe('Address & Locality Parsing', () => {
    it('1. Extracts 6-digit Lucknow PIN code (226xxx)', () => {
      const res = parseAddress('Shop 4, Alambagh Market, Lucknow 226005');
      assert.strictEqual(res.pincode, '226005');
      assert.strictEqual(res.locality, 'Alambagh');
      assert.strictEqual(res.city, 'Lucknow');
      assert.strictEqual(res.state, 'Uttar Pradesh');
    });

    it('2. Identifies prominent Lucknow localities', () => {
      const gomtiRes = parseAddress('Plot 12, Vibhuti Khand, Gomti Nagar, Lucknow');
      assert.strictEqual(gomtiRes.locality, 'Gomti Nagar');

      const hazratRes = parseAddress('Near Post Office, Hazratganj, Lucknow');
      assert.strictEqual(hazratRes.locality, 'Hazratganj');

      const indiraRes = parseAddress('Sector 14, Indira Nagar, Lucknow, UP');
      assert.strictEqual(indiraRes.locality, 'Indira Nagar');
    });

    it('3. Fallback token extraction before Lucknow', () => {
      const res = parseAddress('Shop 10, Random Shopping Complex, Transport Nagar, Lucknow');
      assert.strictEqual(res.locality, 'Transport Nagar');
    });

    it('4. Handles null or empty address strings gracefully', () => {
      const res = parseAddress('');
      assert.strictEqual(res.locality, 'Lucknow');
      assert.strictEqual(res.city, 'Lucknow');
      assert.strictEqual(res.pincode, '');
    });
  });

  describe('Business Name Sanitization', () => {
    it('1. Strips excess whitespace and tabs', () => {
      assert.strictEqual(cleanBusinessName('   Gold\'s   Gym   Lucknow   '), 'Gold\'s Gym Lucknow');
    });

    it('2. Falls back to default on null/empty strings', () => {
      assert.strictEqual(cleanBusinessName(null), 'Unknown Business');
      assert.strictEqual(cleanBusinessName(''), 'Unknown Business');
    });
  });
});
