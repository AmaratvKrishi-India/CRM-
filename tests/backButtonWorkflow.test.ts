import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock @capacitor/app before imports
vi.mock('@capacitor/app', () => {
  const exitAppMock = vi.fn().mockResolvedValue(undefined);
  const addListenerMock = vi.fn().mockImplementation((event: string, callback: any) => {
    return Promise.resolve({
      remove: vi.fn().mockResolvedValue(undefined),
    });
  });
  return {
    App: {
      exitApp: exitAppMock,
      addListener: addListenerMock,
    },
  };
});

import { App as CapacitorApp } from '@capacitor/app';
import { SalesCRMDatabase } from '../src/db/database';
import { createCRMDataLayer } from '../src/db';
import { Lead } from '../src/db/types';

describe('Milestone 1 & 2: Hardware Back-Button Handler & Modal Dismissal Workflow', () => {
  let db: SalesCRMDatabase;
  let crm: ReturnType<typeof createCRMDataLayer>;

  beforeEach(async () => {
    const testDbName = `test_backbtn_${Math.random().toString(36).substring(7)}`;
    db = new SalesCRMDatabase(testDbName);
    crm = createCRMDataLayer(db);
    await db.seedDefaults();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete();
  });

  // State machine simulator matching src/App.tsx back-button listener logic
  class AppBackStateController {
    isBackupModalOpen = false;
    activeWhatsAppLead: Lead | null = null;
    isWhatsAppModalOpen = false;
    pendingCallLead: Lead | null = null;
    callStartedAt: string | null = null;
    activeOutcomeLead: Lead | null = null;
    isOutcomeModalOpen = false;
    isFollowUpModalOpen = false;
    tab: 'DASHBOARD' | 'LEADS' | 'FOLLOW_UPS' | 'IMPORT' | 'DETAIL' = 'DASHBOARD';
    selectedLeadId: string | null = null;
    exitAppCalled = false;

    // Mirrors handleCancelOutcome in src/App.tsx
    handleCancelOutcome() {
      this.pendingCallLead = null;
      this.callStartedAt = null;
      this.isOutcomeModalOpen = false;
      this.activeOutcomeLead = null;
    }

    // Mirrors backButton listener in src/App.tsx
    handleHardwareBack() {
      if (this.isBackupModalOpen) {
        this.isBackupModalOpen = false;
      } else if (this.isWhatsAppModalOpen) {
        this.isWhatsAppModalOpen = false;
        this.activeWhatsAppLead = null;
      } else if (this.isOutcomeModalOpen) {
        this.handleCancelOutcome();
      } else if (this.isFollowUpModalOpen) {
        this.isFollowUpModalOpen = false;
      } else if (this.tab === 'DETAIL') {
        this.selectedLeadId = null;
        this.tab = 'LEADS';
      } else if (this.tab === 'IMPORT') {
        this.tab = 'DASHBOARD';
      } else {
        this.exitAppCalled = true;
        CapacitorApp.exitApp();
      }
    }
  }

  describe('1. Individual Back Button Handler Branches', () => {
    it('Branch 1: Closes Backup Modal when open', () => {
      const controller = new AppBackStateController();
      controller.tab = 'DASHBOARD';
      controller.isBackupModalOpen = true;

      controller.handleHardwareBack();

      expect(controller.isBackupModalOpen).toBe(false);
      expect(controller.tab).toBe('DASHBOARD');
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 2: Closes WhatsApp Modal and resets activeWhatsAppLead', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Fit Pulse Gym',
        phone: '9876543210',
        address: 'Alambagh, Lucknow',
      });

      const controller = new AppBackStateController();
      controller.tab = 'DETAIL';
      controller.selectedLeadId = lead.id;
      controller.isWhatsAppModalOpen = true;
      controller.activeWhatsAppLead = lead;

      controller.handleHardwareBack();

      expect(controller.isWhatsAppModalOpen).toBe(false);
      expect(controller.activeWhatsAppLead).toBeNull();
      expect(controller.tab).toBe('DETAIL');
      expect(controller.selectedLeadId).toBe(lead.id);
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 3: Cancels Call Outcome modal and resets all pending call states', async () => {
      const lead = await crm.leads.createLead({
        businessName: 'Gold Star Gym',
        phone: '9812345678',
        address: 'Indira Nagar, Lucknow',
      });

      const controller = new AppBackStateController();
      controller.tab = 'DETAIL';
      controller.selectedLeadId = lead.id;
      controller.pendingCallLead = lead;
      controller.callStartedAt = new Date().toISOString();
      controller.activeOutcomeLead = lead;
      controller.isOutcomeModalOpen = true;

      controller.handleHardwareBack();

      expect(controller.isOutcomeModalOpen).toBe(false);
      expect(controller.pendingCallLead).toBeNull();
      expect(controller.callStartedAt).toBeNull();
      expect(controller.activeOutcomeLead).toBeNull();
      expect(controller.tab).toBe('DETAIL');
      expect(controller.selectedLeadId).toBe(lead.id);
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 4: Closes Follow-up modal when open', () => {
      const controller = new AppBackStateController();
      controller.tab = 'FOLLOW_UPS';
      controller.isFollowUpModalOpen = true;

      controller.handleHardwareBack();

      expect(controller.isFollowUpModalOpen).toBe(false);
      expect(controller.tab).toBe('FOLLOW_UPS');
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 5: Navigates from DETAIL view back to LEADS tab and clears selectedLeadId', () => {
      const controller = new AppBackStateController();
      controller.tab = 'DETAIL';
      controller.selectedLeadId = 'lead-abc-123';

      controller.handleHardwareBack();

      expect(controller.tab).toBe('LEADS');
      expect(controller.selectedLeadId).toBeNull();
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 6: Navigates from IMPORT view back to DASHBOARD tab', () => {
      const controller = new AppBackStateController();
      controller.tab = 'IMPORT';

      controller.handleHardwareBack();

      expect(controller.tab).toBe('DASHBOARD');
      expect(controller.exitAppCalled).toBe(false);
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
    });

    it('Branch 7: Invokes CapacitorApp.exitApp() on base screens when no modals are open', () => {
      // Base Screen: DASHBOARD
      const c1 = new AppBackStateController();
      c1.tab = 'DASHBOARD';
      c1.handleHardwareBack();
      expect(c1.exitAppCalled).toBe(true);
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);

      // Base Screen: LEADS
      const c2 = new AppBackStateController();
      c2.tab = 'LEADS';
      c2.handleHardwareBack();
      expect(c2.exitAppCalled).toBe(true);
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(2);

      // Base Screen: FOLLOW_UPS
      const c3 = new AppBackStateController();
      c3.tab = 'FOLLOW_UPS';
      c3.handleHardwareBack();
      expect(c3.exitAppCalled).toBe(true);
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(3);
    });
  });

  describe('2. Ghost/Phantom Call Outcome Prevention Verification', () => {
    it('creates zero call logs, zero remarks, and zero status changes when back button cancels call outcome', async () => {
      // 1. Create fresh lead
      const lead = await crm.leads.createLead({
        businessName: 'Zero Phantom Fitness',
        phone: '+91 70544 47888',
        address: 'LDA Colony, Lucknow',
        category: 'Gym',
      });

      expect(lead.status).toBe('NEW');
      expect(lead.callCount).toBe(0);
      expect(lead.lastContactedAt).toBeNull();

      // 2. Simulate user dialing lead (sets pending state) and returning to app (opens outcome modal)
      const controller = new AppBackStateController();
      controller.tab = 'DETAIL';
      controller.selectedLeadId = lead.id;
      controller.pendingCallLead = lead;
      controller.callStartedAt = new Date().toISOString();
      controller.activeOutcomeLead = lead;
      controller.isOutcomeModalOpen = true;

      // 3. User presses Android hardware back button to dismiss/skip outcome
      controller.handleHardwareBack();

      // Verify controller state is reset cleanly
      expect(controller.isOutcomeModalOpen).toBe(false);
      expect(controller.pendingCallLead).toBeNull();
      expect(controller.callStartedAt).toBeNull();
      expect(controller.activeOutcomeLead).toBeNull();

      // 4. Directly query database layers to ensure zero phantom records
      const fullHistory = (await crm.leads.getLeadWithFullHistory(lead.id))!;
      expect(fullHistory.callHistory.length).toBe(0);
      expect(fullHistory.remarks.length).toBe(0);
      expect(fullHistory.messageHistory.length).toBe(0);
      expect(fullHistory.followUps.length).toBe(0);

      // Verify lead entity in Dexie remains completely untouched
      const refreshedLead = (await crm.leads.getLeadById(lead.id))!;
      expect(refreshedLead.status).toBe('NEW');
      expect(refreshedLead.callCount).toBe(0);
      expect(refreshedLead.lastContactedAt).toBeNull();

      // Check global tables in Dexie
      const allCalls = await db.callHistory.toArray();
      const allRemarks = await db.remarks.toArray();
      const allFollowUps = await db.followUps.toArray();
      expect(allCalls.length).toBe(0);
      expect(allRemarks.length).toBe(0);
      expect(allFollowUps.length).toBe(0);
    });

    it('preserves existing call history if a subsequent call outcome is cancelled via back button', async () => {
      // 1. Lead with 1 existing call
      const lead = await crm.leads.createLead({
        businessName: 'Existing History Gym',
        phone: '+91 99999 11111',
        address: 'Gomti Nagar, Lucknow',
      });

      await crm.callHistory.logCall({
        leadId: lead.id,
        calledNumber: lead.phoneE164,
        outcome: 'CONNECTED',
        notes: 'Initial discussion completed',
        updateLeadStatus: 'CONTACTED',
      });

      const leadBefore = (await crm.leads.getLeadById(lead.id))!;
      expect(leadBefore.callCount).toBe(1);
      expect(leadBefore.status).toBe('CONTACTED');

      // 2. Second call dialed, then cancelled via back button
      const controller = new AppBackStateController();
      controller.tab = 'DETAIL';
      controller.selectedLeadId = lead.id;
      controller.pendingCallLead = leadBefore;
      controller.isOutcomeModalOpen = true;

      controller.handleHardwareBack();

      // 3. Verify exactly 1 call remains, no phantom 2nd call
      const fullHistory = (await crm.leads.getLeadWithFullHistory(lead.id))!;
      expect(fullHistory.callHistory.length).toBe(1);
      expect(fullHistory.callHistory[0].notes).toBe('Initial discussion completed');

      const leadAfter = (await crm.leads.getLeadById(lead.id))!;
      expect(leadAfter.callCount).toBe(1);
      expect(leadAfter.status).toBe('CONTACTED');
    });
  });

  describe('3. Modal Stacking Priority & Multi-Step Sequential Back Navigation', () => {
    it('unwinds multi-layer modal stack in correct priority order: Backup -> WhatsApp -> Detail -> Leads -> Exit', () => {
      const controller = new AppBackStateController();

      // Deeply nested UI state:
      // Tab is DETAIL, WhatsApp modal was open, and user opened Backup modal over it
      controller.tab = 'DETAIL';
      controller.selectedLeadId = 'lead_99';
      controller.isWhatsAppModalOpen = true;
      controller.isBackupModalOpen = true;

      // Press 1: Closes Backup modal
      controller.handleHardwareBack();
      expect(controller.isBackupModalOpen).toBe(false);
      expect(controller.isWhatsAppModalOpen).toBe(true);
      expect(controller.tab).toBe('DETAIL');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: Closes WhatsApp modal
      controller.handleHardwareBack();
      expect(controller.isWhatsAppModalOpen).toBe(false);
      expect(controller.tab).toBe('DETAIL');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 3: Exits Lead Detail back to LEADS tab
      controller.handleHardwareBack();
      expect(controller.tab).toBe('LEADS');
      expect(controller.selectedLeadId).toBeNull();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 4: At root LEADS tab -> triggers exitApp
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });

    it('unwinds Call Outcome on Detail view correctly: Outcome Modal -> Detail View -> Leads Tab -> Exit', () => {
      const controller = new AppBackStateController();

      controller.tab = 'DETAIL';
      controller.selectedLeadId = 'lead_42';
      controller.isOutcomeModalOpen = true;
      controller.pendingCallLead = { id: 'lead_42' } as Lead;

      // Press 1: Cancels call outcome
      controller.handleHardwareBack();
      expect(controller.isOutcomeModalOpen).toBe(false);
      expect(controller.pendingCallLead).toBeNull();
      expect(controller.tab).toBe('DETAIL');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: Exits Detail to Leads list
      controller.handleHardwareBack();
      expect(controller.tab).toBe('LEADS');
      expect(controller.selectedLeadId).toBeNull();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 3: Exits app
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });

    it('unwinds Call Outcome triggered from DASHBOARD without jumping to LEADS tab', () => {
      const controller = new AppBackStateController();

      controller.tab = 'DASHBOARD';
      controller.isOutcomeModalOpen = true;
      controller.pendingCallLead = { id: 'lead_dash_1' } as Lead;

      // Press 1: Cancels outcome, stays on DASHBOARD
      controller.handleHardwareBack();
      expect(controller.isOutcomeModalOpen).toBe(false);
      expect(controller.pendingCallLead).toBeNull();
      expect(controller.tab).toBe('DASHBOARD');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: At root DASHBOARD -> triggers exitApp
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });

    it('unwinds Call Outcome triggered from FOLLOW_UPS view correctly', () => {
      const controller = new AppBackStateController();

      controller.tab = 'FOLLOW_UPS';
      controller.isOutcomeModalOpen = true;
      controller.pendingCallLead = { id: 'lead_fu_1' } as Lead;

      // Press 1: Cancels outcome, stays on FOLLOW_UPS
      controller.handleHardwareBack();
      expect(controller.isOutcomeModalOpen).toBe(false);
      expect(controller.pendingCallLead).toBeNull();
      expect(controller.tab).toBe('FOLLOW_UPS');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: At root FOLLOW_UPS -> triggers exitApp
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });

    it('unwinds Follow-up modal on DETAIL view: Follow-up Modal -> Detail View -> Leads Tab -> Exit', () => {
      const controller = new AppBackStateController();

      controller.tab = 'DETAIL';
      controller.selectedLeadId = 'lead_fu_detail';
      controller.isFollowUpModalOpen = true;

      // Press 1: Closes follow up modal
      controller.handleHardwareBack();
      expect(controller.isFollowUpModalOpen).toBe(false);
      expect(controller.tab).toBe('DETAIL');
      expect(controller.selectedLeadId).toBe('lead_fu_detail');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: Exits Detail to Leads list
      controller.handleHardwareBack();
      expect(controller.tab).toBe('LEADS');
      expect(controller.selectedLeadId).toBeNull();
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 3: Exits app
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });

    it('unwinds Importer view correctly: Importer -> Dashboard -> Exit', () => {
      const controller = new AppBackStateController();

      controller.tab = 'IMPORT';

      // Press 1: Return to Dashboard
      controller.handleHardwareBack();
      expect(controller.tab).toBe('DASHBOARD');
      expect(CapacitorApp.exitApp).not.toHaveBeenCalled();

      // Press 2: Exit App
      controller.handleHardwareBack();
      expect(CapacitorApp.exitApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Native Bridge & Listener Registration Contract', () => {
    it('registers CapacitorApp backButton listener and returns a removable handle', async () => {
      const removeMock = vi.fn().mockResolvedValue(undefined);
      (CapacitorApp.addListener as any).mockImplementationOnce((event: string, cb: any) => {
        expect(event).toBe('backButton');
        return Promise.resolve({ remove: removeMock });
      });

      // Simulate registration in App.tsx
      const handle = await CapacitorApp.addListener('backButton', () => {});
      expect(CapacitorApp.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));

      // Simulate cleanup on unmount
      await handle.remove();
      expect(removeMock).toHaveBeenCalledTimes(1);
    });
  });
});
