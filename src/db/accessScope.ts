import type { Lead, User, UserRole } from './types';

/**
 * The complete local authorization boundary. A scope is created only from an
 * active profile that has just been read from Supabase.
 */
export interface AccessScope {
  organizationId: string;
  userId: string;
  role: UserRole;
}

export const LOCKED_DATABASE_NAME = 'AmaratvSalesCRM__locked';

function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(`Invalid ${label} in access scope.`);
  }
  return normalized;
}

export function accessScopeFromUser(user: User): AccessScope {
  if (user.status !== 'ACTIVE') {
    throw new Error('Inactive users cannot unlock local CRM data.');
  }
  if (!user.organizationId) {
    throw new Error('The signed-in profile is missing an organization assignment.');
  }
  return normalizeAccessScope({
    organizationId: user.organizationId,
    userId: user.id,
    role: user.role,
  });
}

export function normalizeAccessScope(scope: AccessScope): AccessScope {
  if (scope.role !== 'ADMIN' && scope.role !== 'AGENT') {
    throw new Error('Invalid role in access scope.');
  }
  return {
    organizationId: requireIdentifier(scope.organizationId, 'organization ID'),
    userId: requireIdentifier(scope.userId, 'user ID'),
    role: scope.role,
  };
}

export function scopedDatabaseName(scope: AccessScope): string {
  const normalized = normalizeAccessScope(scope);
  return `AmaratvSalesCRM__${normalized.organizationId}__${normalized.userId}`;
}

export function sameAccessScope(left: AccessScope, right: AccessScope): boolean {
  return (
    left.organizationId === right.organizationId &&
    left.userId === right.userId &&
    left.role === right.role
  );
}

/** Server and local repository rule for lead visibility. */
export function canAccessLead(scope: AccessScope, lead: Lead): boolean {
  return (
    scope.role === 'ADMIN' ||
    lead.assignedTo === scope.userId ||
    lead.createdBy === scope.userId
  );
}

