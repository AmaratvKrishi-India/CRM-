import { normalizePhoneNumber } from '../db/services/leadNormalizer';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ObjectValidationError {
  field: string;
  message: string;
}

export interface ObjectValidationResult extends ValidationResult {
  errors?: ObjectValidationError[];
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  format?: 'email';
  min?: number;
  max?: number;
  enum?: readonly unknown[];
}

export type ValidationSchema = Record<string, ValidationRule>;

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired(value: unknown, message = 'This field is required'): ValidationResult {
  const missing = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  return missing ? { valid: false, error: message } : { valid: true };
}

export function validateEmail(value: string, message?: string): ValidationResult {
  if (!value || value.trim() === '') return { valid: false, error: message || 'Email is required' };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  return valid ? { valid: true } : { valid: false, error: message || 'Invalid email format' };
}

export function validateEnum<T>(value: T, values: readonly T[], message?: string): ValidationResult {
  if (values.includes(value)) return { valid: true };
  return { valid: false, error: message || `Value must be one of: ${values.join(', ')}` };
}

export function validateMinLength(value: string, minimum: number, message?: string): ValidationResult {
  if (value.length >= minimum) return { valid: true };
  return { valid: false, error: message || `Must be at least ${minimum} characters` };
}

export function validateMaxLength(value: string, maximum: number, message?: string): ValidationResult {
  if (value.length <= maximum) return { valid: true };
  return { valid: false, error: message || `Must be at most ${maximum} characters` };
}

export function validatePhoneNumber(value: string, message?: string): ValidationResult {
  if (!value || value.trim() === '') return { valid: false, error: message || 'Phone number is required' };
  return normalizePhoneNumber(value).isValid
    ? { valid: true }
    : { valid: false, error: message || 'Invalid phone number' };
}

export function validateUrl(value: string, message?: string): ValidationResult {
  if (!value || value.trim() === '') return { valid: false, error: message || 'URL is required' };
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return { valid: true };
  } catch {
    // Fall through to the shared invalid result.
  }
  return { valid: false, error: message || 'Invalid URL format' };
}

export function validateObject(value: Record<string, unknown>, schema: ValidationSchema): ObjectValidationResult {
  const errors: ObjectValidationError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const fieldValue = value[field];
    const requiredResult = rule.required ? validateRequired(fieldValue, `${field} is required`) : { valid: true };
    if (!requiredResult.valid) {
      errors.push({ field, message: requiredResult.error! });
      continue;
    }
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') continue;

    if (rule.type && (rule.type === 'array' ? !Array.isArray(fieldValue) : typeof fieldValue !== rule.type)) {
      errors.push({ field, message: `${field} must be a ${rule.type}` });
      continue;
    }
    if (rule.format === 'email' && typeof fieldValue === 'string') {
      const emailResult = validateEmail(fieldValue);
      if (!emailResult.valid) errors.push({ field, message: emailResult.error! });
    }
    if (rule.enum) {
      const enumResult = validateEnum(fieldValue, rule.enum);
      if (!enumResult.valid) errors.push({ field, message: enumResult.error! });
    }
    if (rule.min !== undefined && typeof fieldValue === 'number' && fieldValue < rule.min) {
      errors.push({ field, message: `${field} must be at least ${rule.min}` });
    }
    if (rule.max !== undefined && typeof fieldValue === 'number' && fieldValue > rule.max) {
      errors.push({ field, message: `${field} must be at most ${rule.max}` });
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
