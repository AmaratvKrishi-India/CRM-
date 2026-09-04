import { SalesCRMDatabase } from '../../src/db/database.ts';
import type { AccessScope } from '../../src/db/accessScope.ts';

export const agentScope: AccessScope = {
  organizationId: 'org-vitest-01',
  userId: 'agent-vitest-01',
  role: 'AGENT',
};

export const adminScope: AccessScope = {
  organizationId: 'org-vitest-01',
  userId: 'admin-vitest-01',
  role: 'ADMIN',
};

export function createVitestDatabase(
  label: string,
  scope: AccessScope = agentScope
): SalesCRMDatabase {
  return new SalesCRMDatabase(`Vitest_${label}_${crypto.randomUUID()}`, scope);
}

export async function disposeVitestDatabase(database: SalesCRMDatabase): Promise<void> {
  database.close();
  await database.delete();
}
