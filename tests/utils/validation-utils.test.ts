/**
 * Validation Utilities Unit Tests
 * Tests for email validation, required fields, enums, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateRequired,
  validateEnum,
  validateMinLength,
  validateMaxLength,
  validatePhoneNumber,
  validateUrl,
  validateObject,
  ValidationError,
} from '@/utils/validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true });
      expect(validateEmail('user.name@domain.org')).toEqual({ valid: true });
      expect(validateEmail('user+tag@domain.co.in')).toEqual({ valid: true });
      expect(validateEmail('user@subdomain.domain.com')).toEqual({ valid: true });
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toEqual({ valid: false, error: 'Invalid email format' });
      expect(validateEmail('missing@domain')).toEqual({ valid: false, error: 'Invalid email format' });
      expect(validateEmail('@nodomain.com')).toEqual({ valid: false, error: 'Invalid email format' });
      expect(validateEmail('noatsign.com')).toEqual({ valid: false, error: 'Invalid email format' });
      expect(validateEmail('spaces in@domain.com')).toEqual({ valid: false, error: 'Invalid email format' });
    });

    it('should reject empty strings', () => {
      expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
      expect(validateEmail('   ')).toEqual({ valid: false, error: 'Email is required' });
    });

    it('should allow optional custom error message', () => {
      const result = validateEmail('invalid', 'Custom error');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Custom error');
    });
  });

  describe('validateRequired', () => {
    it('should accept non-empty strings', () => {
      expect(validateRequired('hello')).toEqual({ valid: true });
      expect(validateRequired('  hello  ')).toEqual({ valid: true });
    });

    it('should reject empty strings', () => {
      expect(validateRequired('')).toEqual({ valid: false, error: 'This field is required' });
      expect(validateRequired('   ')).toEqual({ valid: false, error: 'This field is required' });
    });

    it('should reject null/undefined', () => {
      expect(validateRequired(null as any)).toEqual({ valid: false, error: 'This field is required' });
      expect(validateRequired(undefined as any)).toEqual({ valid: false, error: 'This field is required' });
    });

    it('should accept zero and false', () => {
      expect(validateRequired(0)).toEqual({ valid: true });
      expect(validateRequired(false)).toEqual({ valid: true });
    });

    it('should allow custom error message', () => {
      const result = validateRequired('', 'Name is required');
      expect(result.error).toBe('Name is required');
    });
  });

  describe('validateEnum', () => {
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED_WON', 'CLOSED_LOST'] as const;

    it('should accept valid enum values', () => {
      expect(validateEnum('NEW', statuses)).toEqual({ valid: true });
      expect(validateEnum('CONTACTED', statuses)).toEqual({ valid: true });
      expect(validateEnum('CLOSED_WON', statuses)).toEqual({ valid: true });
    });

    it('should reject invalid enum values', () => {
      expect(validateEnum('INVALID', statuses)).toEqual({
        valid: false,
        error: 'Value must be one of: NEW, CONTACTED, QUALIFIED, CLOSED_WON, CLOSED_LOST',
      });
      expect(validateEnum('new', statuses)).toEqual({
        valid: false,
        error: 'Value must be one of: NEW, CONTACTED, QUALIFIED, CLOSED_WON, CLOSED_LOST',
      });
    });

    it('should reject empty strings', () => {
      expect(validateEnum('', statuses)).toEqual({
        valid: false,
        error: 'Value must be one of: NEW, CONTACTED, QUALIFIED, CLOSED_WON, CLOSED_LOST',
      });
    });

    it('should allow custom error message', () => {
      const result = validateEnum('INVALID', statuses, 'Invalid status');
      expect(result.error).toBe('Invalid status');
    });
  });

  describe('validateMinLength', () => {
    it('should accept strings meeting minimum length', () => {
      expect(validateMinLength('hello', 5)).toEqual({ valid: true });
      expect(validateMinLength('hello world', 5)).toEqual({ valid: true });
    });

    it('should reject strings shorter than minimum', () => {
      expect(validateMinLength('hi', 5)).toEqual({ valid: false, error: 'Must be at least 5 characters' });
    });

    it('should accept exact length', () => {
      expect(validateMinLength('12345', 5)).toEqual({ valid: true });
    });

    it('should allow custom error message', () => {
      const result = validateMinLength('hi', 5, 'Too short');
      expect(result.error).toBe('Too short');
    });
  });

  describe('validateMaxLength', () => {
    it('should accept strings within maximum length', () => {
      expect(validateMaxLength('hello', 10)).toEqual({ valid: true });
      expect(validateMaxLength('hello world', 20)).toEqual({ valid: true });
    });

    it('should reject strings exceeding maximum', () => {
      expect(validateMaxLength('hello world', 5)).toEqual({ valid: false, error: 'Must be at most 5 characters' });
    });

    it('should accept exact length', () => {
      expect(validateMaxLength('12345', 5)).toEqual({ valid: true });
    });
  });

  describe('validatePhoneNumber', () => {
    it('should accept valid Indian mobile numbers', () => {
      expect(validatePhoneNumber('9876543210')).toEqual({ valid: true });
      expect(validatePhoneNumber('+919876543210')).toEqual({ valid: true });
      expect(validatePhoneNumber('09876543210')).toEqual({ valid: true });
    });

    it('should accept valid Indian landline numbers', () => {
      expect(validatePhoneNumber('05222345678')).toEqual({ valid: true });
      expect(validatePhoneNumber('05222345678')).toEqual({ valid: true });
    });

    it('should reject invalid numbers', () => {
      expect(validatePhoneNumber('1234567890')).toEqual({ valid: false, error: 'Invalid phone number' });
      expect(validatePhoneNumber('987654321')).toEqual({ valid: false, error: 'Invalid phone number' });
      expect(validatePhoneNumber('abcdefghij')).toEqual({ valid: false, error: 'Invalid phone number' });
    });

    it('should reject empty', () => {
      expect(validatePhoneNumber('')).toEqual({ valid: false, error: 'Phone number is required' });
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('https://example.com')).toEqual({ valid: true });
      expect(validateUrl('http://localhost:3000')).toEqual({ valid: true });
      expect(validateUrl('https://api.example.com/v1/endpoint')).toEqual({ valid: true });
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toEqual({ valid: false, error: 'Invalid URL format' });
      expect(validateUrl('ftp://example.com')).toEqual({ valid: false, error: 'Invalid URL format' });
      expect(validateUrl('javascript:alert(1)')).toEqual({ valid: false, error: 'Invalid URL format' });
    });

    it('should reject empty', () => {
      expect(validateUrl('')).toEqual({ valid: false, error: 'URL is required' });
    });
  });

  describe('validateObject', () => {
    const schema = {
      name: { required: true, type: 'string' },
      email: { required: true, type: 'string', format: 'email' },
      age: { required: false, type: 'number', min: 18 },
      status: { required: true, type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    };

    it('should validate correct object', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 25, status: 'ACTIVE' };
      expect(validateObject(obj, schema)).toEqual({ valid: true });
    });

    it('should reject missing required fields', () => {
      const obj = { email: 'john@example.com' };
      const result = validateObject(obj, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('should reject wrong types', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 'twenty-five', status: 'ACTIVE' };
      const result = validateObject(obj, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'age' }));
    });

    it('should reject invalid enum values', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 25, status: 'PENDING' };
      const result = validateObject(obj, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'status' }));
    });

    it('should reject values below minimum', () => {
      const obj = { name: 'John', email: 'john@example.com', age: 15, status: 'ACTIVE' };
      const result = validateObject(obj, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'age' }));
    });

    it('should collect multiple errors', () => {
      const obj = { name: '', email: 'invalid', age: 15, status: 'PENDING' };
      const result = validateObject(obj, schema);
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(1);
    });

    it('should allow optional fields to be missing', () => {
      const obj = { name: 'John', email: 'john@example.com', status: 'ACTIVE' };
      expect(validateObject(obj, schema)).toEqual({ valid: true });
    });
  });

  describe('ValidationError class', () => {
    it('should create error with field and message', () => {
      const error = new ValidationError('email', 'Invalid email format');
      expect(error.field).toBe('email');
      expect(error.message).toBe('Invalid email format');
      expect(error.name).toBe('ValidationError');
    });

    it('should be instanceof Error', () => {
      const error = new ValidationError('field', 'message');
      expect(error instanceof Error).toBe(true);
    });
  });
});
