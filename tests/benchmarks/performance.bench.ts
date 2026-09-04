/**
 * Performance Benchmark Tests
 * Uses vitest bench for micro-benchmarks with statistical rigor
 */

import { describe, bench, expect } from 'vitest';
import { normalizePhoneNumber, formatPhoneNumber, isValidIndianPhoneNumber } from '@/utils/phone';
import { formatDate, formatRelativeTime, parseISODate } from '@/utils/date';
import { validateEmail, validateRequired, validateObject } from '@/utils/validation';
import { ConflictResolver } from '@/services/sync/ConflictResolver';

const conflictResolver = new ConflictResolver();

// Test data
const phoneNumbers = [
  '+919876543210',
  '09876543210',
  '9876543210',
  '+91 98765 43210',
  '919876543210',
  '05222345678',
  '+915222345678',
];

const dates = [
  '2024-01-15T10:30:00Z',
  '2024-12-25T00:00:00Z',
  '2023-06-15T12:00:00Z',
  new Date().toISOString(),
];

const emails = [
  'test@example.com',
  'user.name@domain.org',
  'invalid-email',
  'missing@domain',
  'user@subdomain.domain.com',
];

const validationSchemas = {
  lead: {
    name: { required: true, type: 'string' },
    email: { required: true, type: 'string', format: 'email' },
    phone: { required: true, type: 'string', format: 'phone' },
    status: { required: true, type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED'] },
  },
};

const validLead = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '9876543210',
  status: 'NEW',
};

const invalidLead = {
  name: '',
  email: 'invalid',
  phone: '123',
  status: 'INVALID',
};

describe('Phone Utilities Benchmarks', () => {
  bench('normalizePhoneNumber', () => {
    for (const phone of phoneNumbers) {
      normalizePhoneNumber(phone);
    }
  });

  bench('formatPhoneNumber', () => {
    for (const phone of phoneNumbers) {
      formatPhoneNumber(phone);
    }
  });

  bench('isValidIndianPhoneNumber', () => {
    for (const phone of phoneNumbers) {
      isValidIndianPhoneNumber(phone);
    }
  });
});

describe('Date Utilities Benchmarks', () => {
  bench('formatDate', () => {
    for (const date of dates) {
      formatDate(date);
    }
  });

  bench('formatRelativeTime', () => {
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      formatRelativeTime(new Date(now - i * 60000));
    }
  });

  bench('parseISODate', () => {
    for (const date of dates) {
      parseISODate(typeof date === 'string' ? date : date.toISOString());
    }
  });
});

describe('Validation Utilities Benchmarks', () => {
  bench('validateEmail', () => {
    for (const email of emails) {
      validateEmail(email);
    }
  });

  bench('validateRequired', () => {
    const values = ['hello', '', 'world', 'test', '   '];
    for (const value of values) {
      validateRequired(value);
    }
  });

  bench('validateObject (valid)', () => {
    for (let i = 0; i < 50; i++) {
      validateObject(validLead, validationSchemas.lead);
    }
  });

  bench('validateObject (invalid)', () => {
    for (let i = 0; i < 50; i++) {
      validateObject(invalidLead, validationSchemas.lead);
    }
  });
});

describe('Conflict Resolver Benchmarks', () => {
  const localLead = { id: '1', name: 'Local', status: 'NEW', source: 'MANUAL', phone: '9876543210' };
  const remoteLead = { id: '1', name: 'Remote', status: 'CONTACTED', source: 'IMPORT', phone: '9876543211' };

  const localCall = { id: '1', duration: 100, status: 'UNVERIFIED', verified_duration: 0, direction: 'OUTBOUND' };
  const remoteCall = { id: '1', duration: 120, status: 'VERIFIED', verified_duration: 120, direction: 'INBOUND' };

  bench('resolve (lead)', () => {
    conflictResolver.resolve(localLead, remoteLead, 'UPDATE');
  });

  bench('resolveCallRecord', () => {
    conflictResolver.resolveCallRecord(localCall, remoteCall);
  });

  bench('resolveLead', () => {
    conflictResolver.resolveLead(localLead, remoteLead);
  });
});

describe('Sync Operations Benchmarks', () => {
  // These would test actual sync operations in integration tests
  // Placeholder for when we have the full sync engine wired up
  bench('enqueue sync operation', () => {
    // Mock sync queue enqueue
  });

  bench('process sync batch', () => {
    // Mock batch processing
  });
});

// Run with: npx vitest bench