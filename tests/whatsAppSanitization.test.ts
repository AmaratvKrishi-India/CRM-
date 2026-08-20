import { describe, it, expect } from 'vitest';
import { NativePlatformService } from '../src/services/nativePlatform';

describe('WhatsApp Phone Number Sanitization (Part 2C)', () => {
  it('sanitizes numbers with spaces and + prefix', () => {
    const raw = '+91 70544 47888';
    const sanitized = NativePlatformService.sanitizeWhatsAppPhone(raw);
    expect(sanitized).toBe('917054447888');
  });

  it('sanitizes standard E.164 numbers with + prefix', () => {
    const raw = '+917054447888';
    const sanitized = NativePlatformService.sanitizeWhatsAppPhone(raw);
    expect(sanitized).toBe('917054447888');
  });

  it('sanitizes hyphenated numbers', () => {
    const raw = '91-70544-47888';
    const sanitized = NativePlatformService.sanitizeWhatsAppPhone(raw);
    expect(sanitized).toBe('917054447888');
  });

  it('sanitizes bracketed and spaced numbers', () => {
    const raw = '+91 (70544) 47888';
    const sanitized = NativePlatformService.sanitizeWhatsAppPhone(raw);
    expect(sanitized).toBe('917054447888');
  });

  it('strips all non-digit characters strictly', () => {
    const raw = '+91 70544-47888 #ext 12';
    const sanitized = NativePlatformService.sanitizeWhatsAppPhone(raw);
    expect(sanitized).toBe('91705444788812');
  });

  it('handles empty or whitespace strings', () => {
    expect(NativePlatformService.sanitizeWhatsAppPhone('')).toBe('');
    expect(NativePlatformService.sanitizeWhatsAppPhone('   ')).toBe('');
  });
});
