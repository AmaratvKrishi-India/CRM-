import { beforeEach, afterEach, vi } from 'vitest';
import { indexedDB, IDBKeyRange, IDBFactory, IDBDatabase, IDBTransaction, IDBObjectStore, IDBIndex, IDBCursor, IDBRequest, IDBOpenDBRequest } from 'fake-indexeddb';
import { cleanup } from '@testing-library/react';

// ============================================================================
// Global Test Environment Setup
// ============================================================================

// Set up fake-indexeddb globally
// fake-indexeddb v6 exposes a ready-to-use factory as `indexedDB`.
(globalThis as any).indexedDB = indexedDB;
(globalThis as any).IDBFactory = IDBFactory;
(globalThis as any).IDBKeyRange = IDBKeyRange;
(globalThis as any).IDBDatabase = IDBDatabase;
(globalThis as any).IDBTransaction = IDBTransaction;
(globalThis as any).IDBObjectStore = IDBObjectStore;
(globalThis as any).IDBIndex = IDBIndex;
(globalThis as any).IDBCursor = IDBCursor;
(globalThis as any).IDBRequest = IDBRequest;
(globalThis as any).IDBOpenDBRequest = IDBOpenDBRequest;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  }
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: localStorageMock });

// Mock navigator
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      pushManager: {
        subscribe: vi.fn(),
        getSubscription: vi.fn().mockResolvedValue(null)
      }
    }),
    register: vi.fn().mockResolvedValue({
      pushManager: {
        subscribe: vi.fn(),
        getSubscription: vi.fn().mockResolvedValue(null)
      }
    })
  }
});

// ============================================================================
// Test Utilities
// ============================================================================

export const createMockDexie = () => {
  const mockTable = {
    add: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    toArray: vi.fn().mockResolvedValue([]),
    toCollection: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      sortBy: vi.fn().mockResolvedValue([]),
      toArray: vi.fn().mockResolvedValue([])
    }),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnThis(),
      above: vi.fn().mockReturnThis(),
      below: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      startsWith: vi.fn().mockReturnThis(),
      startsWithIgnoreCase: vi.fn().mockReturnThis(),
      anyOf: vi.fn().mockReturnThis(),
      anyOfIgnoreCase: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
      last: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(0),
      modify: vi.fn().mockResolvedValue(0)
    }),
    orderBy: vi.fn().mockReturnThis(),
    reverse: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis()
  };

  return {
    tables: {
      organizations: mockTable,
      profiles: mockTable,
      leads: mockTable,
      activities: mockTable,
      callRecords: mockTable,
      followUps: mockTable,
      messages: mockTable,
      syncQueue: mockTable,
      syncState: mockTable,
      auditLogs: mockTable,
      bulkAssignments: mockTable,
      reminders: mockTable,
      settings: mockTable
    },
    transaction: vi.fn().mockImplementation((mode, tables, callback) => callback()),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isOpen: vi.fn().mockReturnValue(true),
    verno: 5,
    backendDB: () => ({ name: 'test-db' })
  };
};

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockImplementation(() => {});
  localStorageMock.removeItem.mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

// ============================================================================
// Custom Matchers
// ============================================================================

expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`
    };
  },
  toBeISODateString(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid ISO date string`
        : `expected ${received} to be a valid ISO date string`
    };
  },
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range [${min}, ${max}]`
        : `expected ${received} to be within range [${min}, ${max}]`
    };
  }
});

// Type extensions for Vitest matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidUUID(): T;
    toBeISODateString(): T;
    toBeWithinRange(min: number, max: number): T;
  }
  interface AsymmetricMatchersContaining {
    toBeValidUUID(): any;
    toBeISODateString(): any;
    toBeWithinRange(min: number, max: number): any;
  }
}
