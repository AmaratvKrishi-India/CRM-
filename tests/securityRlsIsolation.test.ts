import { describe, it } from 'node:test';
import assert from 'node:assert';

export interface Profile {
  id: string;
  auth_user_id: string;
  organization_id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Lead {
  id: string;
  organization_id: string;
  business_name: string;
  phone: string;
  status: string;
  created_by: string | null;
  assigned_to: string | null;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  lead_id: string;
  user_id: string;
  duration_seconds: number;
  outcome: string;
}

/**
 * Emulates PostgreSQL Supabase RLS Evaluation Engine in Node.js
 * Mirrors policies from 20260820000006_rls_agent_lead_isolation.sql.
 */
class RlsPolicyEngine {
  private profiles: Profile[] = [];
  private leads: Lead[] = [];
  private callRecords: CallRecord[] = [];
  private importAudits: any[] = [];

  constructor(seed: { profiles: Profile[]; leads: Lead[]; callRecords?: CallRecord[]; importAudits?: any[] }) {
    this.profiles = seed.profiles;
    this.leads = seed.leads;
    this.callRecords = seed.callRecords || [];
    this.importAudits = seed.importAudits || [];
  }

  private resolveProfile(authUserId: string): Profile | undefined {
    return this.profiles.find((p) => p.auth_user_id === authUserId && p.status === 'ACTIVE');
  }

  // SELECT LEADS
  selectLeads(authUserId: string): Lead[] {
    const actor = this.resolveProfile(authUserId);
    if (!actor) return [];

    return this.leads.filter((lead) => {
      if (lead.organization_id !== actor.organization_id) return false;
      if (actor.role === 'ADMIN') return true;
      // AGENT visibility rule: assigned_to = self OR created_by = self
      return lead.assigned_to === actor.id || lead.created_by === actor.id;
    });
  }

  // INSERT LEADS
  insertLead(authUserId: string, newLead: Lead): { success: boolean; error?: string } {
    const actor = this.resolveProfile(authUserId);
    if (!actor) return { success: false, error: 'Unauthorized: Inactive or missing profile' };

    if (newLead.organization_id !== actor.organization_id) {
      return { success: false, error: 'Cannot insert lead for another organization' };
    }

    if (actor.role === 'ADMIN') {
      this.leads.push(newLead);
      return { success: true };
    }

    // AGENT insert rule
    if (newLead.created_by !== actor.id) {
      return { success: false, error: 'Agents can only set created_by to their own profile ID' };
    }
    if (newLead.assigned_to !== null && newLead.assigned_to !== actor.id) {
      return { success: false, error: 'Agents cannot assign new leads to other agents' };
    }

    this.leads.push(newLead);
    return { success: true };
  }

  // UPDATE LEADS
  updateLead(
    authUserId: string,
    leadId: string,
    updates: Partial<Lead>
  ): { success: boolean; error?: string } {
    const actor = this.resolveProfile(authUserId);
    if (!actor) return { success: false, error: 'Unauthorized: Inactive or missing profile' };

    const leadIndex = this.leads.findIndex((l) => l.id === leadId);
    if (leadIndex === -1) return { success: false, error: 'Lead not found' };

    const existingLead = this.leads[leadIndex];

    // Org boundary check
    if (existingLead.organization_id !== actor.organization_id) {
      return { success: false, error: 'Cannot update cross-organization lead' };
    }

    // Check SELECT visibility before update
    if (actor.role !== 'ADMIN') {
      const isAuthorized =
        existingLead.assigned_to === actor.id || existingLead.created_by === actor.id;
      if (!isAuthorized) {
        return { success: false, error: 'RLS violation: Agent is not authorized on this lead' };
      }

      // Check immutable fields trigger
      if (updates.organization_id && updates.organization_id !== existingLead.organization_id) {
        return { success: false, error: 'Agents are strictly forbidden from modifying organization boundary' };
      }
      if (updates.created_by && updates.created_by !== existingLead.created_by) {
        return { success: false, error: 'Agents are strictly forbidden from modifying lead creator' };
      }
      if (
        updates.assigned_to !== undefined &&
        updates.assigned_to !== null &&
        updates.assigned_to !== actor.id &&
        updates.assigned_to !== existingLead.assigned_to
      ) {
        return { success: false, error: 'Agents are not permitted to reassign leads to other sales agents' };
      }
    }

    this.leads[leadIndex] = { ...existingLead, ...updates };
    return { success: true };
  }

  // SELECT IMPORT AUDITS (Admin Only)
  selectImportAudits(authUserId: string): any[] {
    const actor = this.resolveProfile(authUserId);
    if (!actor) return [];
    if (actor.role !== 'ADMIN') return [];
    return this.importAudits.filter((a) => a.organization_id === actor.organization_id);
  }
}

describe('Supabase RLS Agent & Admin Lead Isolation Tests (Stage 5 / P0 Security)', () => {
  const ORG_1 = '00000000-0000-0000-0000-000000000001';
  const ORG_2 = '00000000-0000-0000-0000-000000000002';

  const profiles: Profile[] = [
    {
      id: 'prof-admin-1',
      auth_user_id: 'auth-admin-1',
      organization_id: ORG_1,
      name: 'Admin Boss',
      email: 'admin@amaratv.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'prof-agent-a',
      auth_user_id: 'auth-agent-a',
      organization_id: ORG_1,
      name: 'Agent A',
      email: 'agenta@amaratv.com',
      role: 'AGENT',
      status: 'ACTIVE',
    },
    {
      id: 'prof-agent-b',
      auth_user_id: 'auth-agent-b',
      organization_id: ORG_1,
      name: 'Agent B',
      email: 'agentb@amaratv.com',
      role: 'AGENT',
      status: 'ACTIVE',
    },
    {
      id: 'prof-agent-cross',
      auth_user_id: 'auth-agent-cross',
      organization_id: ORG_2,
      name: 'Cross-Org Rep',
      email: 'rep@othercompany.com',
      role: 'AGENT',
      status: 'ACTIVE',
    },
  ];

  const leads: Lead[] = [
    {
      id: 'lead-assigned-a',
      organization_id: ORG_1,
      business_name: 'Gym Alpha (Assigned to A)',
      phone: '9876543210',
      status: 'NEW',
      created_by: 'prof-admin-1',
      assigned_to: 'prof-agent-a',
    },
    {
      id: 'lead-created-a',
      organization_id: ORG_1,
      business_name: 'Gym Bravo (Created by A in Field)',
      phone: '9876543211',
      status: 'NEW',
      created_by: 'prof-agent-a',
      assigned_to: null,
    },
    {
      id: 'lead-assigned-b',
      organization_id: ORG_1,
      business_name: 'Gym Charlie (Assigned to B)',
      phone: '9876543212',
      status: 'NEW',
      created_by: 'prof-admin-1',
      assigned_to: 'prof-agent-b',
    },
    {
      id: 'lead-unassigned-org1',
      organization_id: ORG_1,
      business_name: 'Gym Delta (Unassigned Pool)',
      phone: '9876543213',
      status: 'NEW',
      created_by: 'prof-admin-1',
      assigned_to: null,
    },
    {
      id: 'lead-org2',
      organization_id: ORG_2,
      business_name: 'Gym Echo (Other Org)',
      phone: '9876543214',
      status: 'NEW',
      created_by: 'prof-agent-cross',
      assigned_to: 'prof-agent-cross',
    },
  ];

  const importAudits = [
    { id: 'audit-1', organization_id: ORG_1, filename: 'lucknow_gyms.xlsx' },
    { id: 'audit-2', organization_id: ORG_2, filename: 'delhi_gyms.xlsx' },
  ];

  it('ADMIN: can read all organization leads including unassigned and assigned to any agent', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });
    const visibleLeads = engine.selectLeads('auth-admin-1');

    assert.strictEqual(visibleLeads.length, 4); // all 4 in ORG_1
    const ids = visibleLeads.map((l) => l.id);
    assert.ok(ids.includes('lead-assigned-a'));
    assert.ok(ids.includes('lead-created-a'));
    assert.ok(ids.includes('lead-assigned-b'));
    assert.ok(ids.includes('lead-unassigned-org1'));
    assert.ok(!ids.includes('lead-org2')); // Org 2 excluded
  });

  it('AGENT A: can read own assigned leads and own created leads ONLY', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });
    const visibleLeads = engine.selectLeads('auth-agent-a');

    assert.strictEqual(visibleLeads.length, 2);
    const ids = visibleLeads.map((l) => l.id);
    assert.ok(ids.includes('lead-assigned-a'));
    assert.ok(ids.includes('lead-created-a'));
    assert.ok(!ids.includes('lead-assigned-b'), 'Agent A must NOT see Agent B leads');
    assert.ok(!ids.includes('lead-unassigned-org1'), 'Agent A must NOT see unassigned Admin leads');
    assert.ok(!ids.includes('lead-org2'), 'Agent A must NOT see other org leads');
  });

  it('AGENT B: has symmetric isolation from Agent A and unassigned pool', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });
    const visibleLeads = engine.selectLeads('auth-agent-b');

    assert.strictEqual(visibleLeads.length, 1);
    assert.strictEqual(visibleLeads[0].id, 'lead-assigned-b');
  });

  it('AGENT A: cannot update Agent B leads or unassigned leads', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const resB = engine.updateLead('auth-agent-a', 'lead-assigned-b', { status: 'CONTACTED' });
    assert.strictEqual(resB.success, false);
    assert.match(resB.error!, /RLS violation/);

    const resUnassigned = engine.updateLead('auth-agent-a', 'lead-unassigned-org1', { status: 'CONTACTED' });
    assert.strictEqual(resUnassigned.success, false);
    assert.match(resUnassigned.error!, /RLS violation/);
  });

  it('AGENT A: cannot reassign own lead to Agent B', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const res = engine.updateLead('auth-agent-a', 'lead-assigned-a', { assigned_to: 'prof-agent-b' });
    assert.strictEqual(res.success, false);
    assert.match(res.error!, /reassign leads to other sales agents/);
  });

  it('AGENT A: cannot alter organization_id or created_by', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const resOrg = engine.updateLead('auth-agent-a', 'lead-assigned-a', { organization_id: ORG_2 });
    assert.strictEqual(resOrg.success, false);
    assert.match(resOrg.error!, /modifying organization boundary/);

    const resCreator = engine.updateLead('auth-agent-a', 'lead-assigned-a', { created_by: 'prof-agent-b' });
    assert.strictEqual(resCreator.success, false);
    assert.match(resCreator.error!, /modifying lead creator/);
  });

  it('AGENT A: can update permitted sales fields on own assigned lead', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const res = engine.updateLead('auth-agent-a', 'lead-assigned-a', { status: 'INTERESTED' });
    assert.strictEqual(res.success, true);

    const visible = engine.selectLeads('auth-agent-a');
    const updated = visible.find((l) => l.id === 'lead-assigned-a');
    assert.strictEqual(updated?.status, 'INTERESTED');
  });

  it('ADMIN: can assign and reassign leads across the organization', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const res = engine.updateLead('auth-admin-1', 'lead-unassigned-org1', { assigned_to: 'prof-agent-b' });
    assert.strictEqual(res.success, true);

    const visibleB = engine.selectLeads('auth-agent-b');
    const assigned = visibleB.find((l) => l.id === 'lead-unassigned-org1');
    assert.ok(assigned !== undefined);
    assert.strictEqual(assigned?.assigned_to, 'prof-agent-b');
  });

  it('Cross-Organization isolation: Cross-org rep cannot read or modify Org 1 leads', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads] });

    const visible = engine.selectLeads('auth-agent-cross');
    assert.strictEqual(visible.length, 1);
    assert.strictEqual(visible[0].id, 'lead-org2');

    const res = engine.updateLead('auth-agent-cross', 'lead-assigned-a', { status: 'INTERESTED' });
    assert.strictEqual(res.success, false);
    assert.match(res.error!, /cross-organization/);
  });

  it('Admin-Only Data: Agents cannot read or query import audits', () => {
    const engine = new RlsPolicyEngine({ profiles, leads: [...leads], importAudits });

    const adminAudits = engine.selectImportAudits('auth-admin-1');
    assert.strictEqual(adminAudits.length, 1);
    assert.strictEqual(adminAudits[0].id, 'audit-1');

    const agentAudits = engine.selectImportAudits('auth-agent-a');
    assert.strictEqual(agentAudits.length, 0);
  });
});
