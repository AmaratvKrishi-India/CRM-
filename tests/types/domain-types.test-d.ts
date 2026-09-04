/**
 * TypeScript Type Tests
 * Uses TSTyche and expect-type for type-level testing
 */

import { expectTypeOf } from 'expect-type';
import { it } from 'tyche';

// ============================================================================
// Type Tests for Core Domain Types
// ============================================================================

it('Organization type should have required fields', () => {
  type Organization = {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };

  expectTypeOf<Organization>().toHaveProperty('id').toEqualTypeOf<string>();
  expectTypeOf<Organization>().toHaveProperty('name').toEqualTypeOf<string>();
  expectTypeOf<Organization>().toHaveProperty('slug').toEqualTypeOf<string>();
  expectTypeOf<Organization>().toHaveProperty('settings').toEqualTypeOf<Record<string, unknown>>();
  expectTypeOf<Organization>().toHaveProperty('created_at').toEqualTypeOf<string>();
  expectTypeOf<Organization>().toHaveProperty('updated_at').toEqualTypeOf<string>();
});

it('Profile type should enforce role enum', () => {
  type UserRole = 'ADMIN' | 'AGENT';

  type Profile = {
    id: string;
    organization_id: string;
    role: UserRole;
    name: string;
    phone: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
  };

  expectTypeOf<Profile>().toHaveProperty('role').toEqualTypeOf<UserRole>();
  expectTypeOf<Profile>().toHaveProperty('organization_id').toEqualTypeOf<string>();
});

it('Lead type should have correct status enum', () => {
  type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'CLOSED_WON' | 'CLOSED_LOST';

  type Lead = {
    id: string;
    organization_id: string;
    name: string;
    phone: string;
    email?: string;
    status: LeadStatus;
    source: string;
    assigned_agent_id?: string;
    created_at: string;
    updated_at: string;
  };

  expectTypeOf<Lead>().toHaveProperty('status').toEqualTypeOf<LeadStatus>();
  expectTypeOf<Lead>().toHaveProperty('phone').toEqualTypeOf<string>();
});

it('CallRecord type should enforce verified duration logic', () => {
  type CallStatus = 'VERIFIED' | 'UNVERIFIED' | 'FAILED';

  type CallRecord = {
    id: string;
    organization_id: string;
    lead_id: string;
    agent_id: string;
    dial_attempt_id: string;
    reported_duration: number;
    verified_duration: number;
    status: CallStatus;
    direction: 'INBOUND' | 'OUTBOUND';
    started_at: string;
    ended_at?: string;
    created_at: string;
  };

  expectTypeOf<CallRecord>().toHaveProperty('reported_duration').toEqualTypeOf<number>();
  expectTypeOf<CallRecord>().toHaveProperty('verified_duration').toEqualTypeOf<number>();
  expectTypeOf<CallRecord>().toHaveProperty('status').toEqualTypeOf<CallStatus>();
});

it('Activity type should have correct outcome enum', () => {
  type ActivityOutcome = 'INTERESTED' | 'NOT_INTERESTED' | 'CALLBACK' | 'WRONG_NUMBER' | 'DO_NOT_CALL';

  type Activity = {
    id: string;
    organization_id: string;
    lead_id: string;
    agent_id: string;
    type: 'CALL' | 'MEETING' | 'EMAIL' | 'WHATSAPP' | 'NOTE';
    outcome: ActivityOutcome;
    duration: number;
    notes?: string;
    created_at: string;
  };

  expectTypeOf<Activity>().toHaveProperty('outcome').toEqualTypeOf<ActivityOutcome>();
});

// ============================================================================
// Type Tests for Service APIs
// ============================================================================

it('SyncQueue enqueue should accept operation types', () => {
  type SyncOperation =
    | { type: 'CREATE'; table: string; payload: Record<string, unknown>; idempotency_key: string }
    | { type: 'UPDATE'; table: string; payload: Record<string, unknown>; idempotency_key: string }
    | { type: 'DELETE'; table: string; payload: { id: string }; idempotency_key: string };

  type EnqueueFn = (operation: SyncOperation) => Promise<void>;

  expectTypeOf<EnqueueFn>().parameters.toEqualTypeOf<[SyncOperation]>();
  expectTypeOf<EnqueueFn>().returns.toEqualTypeOf<Promise<void>>();
});

it('ConflictResolver resolve should return merged type', () => {
  type Entity<T> = T & { id: string; updated_at: string };

  type ResolveFn = <T extends { id: string }>(
    local: Entity<T>,
    remote: Entity<T>,
    operation: 'CREATE' | 'UPDATE' | 'DELETE'
  ) => Promise<Entity<T>>;

  expectTypeOf<ResolveFn>().typeParameters.toEqualTypeOf<[T]>();
  expectTypeOf<ResolveFn>().returns.toEqualTypeOf<Promise<Entity<any>>>();
});

it('BackgroundSyncManager should have correct state types', () => {
  type SyncState = 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR';

  type SyncManagerAPI = {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    sync: () => Promise<void>;
    isRunning: () => boolean;
    getState: () => SyncState;
    getCursor: () => string;
    setCursor: (cursor: string) => Promise<void>;
    getLastSyncTime: () => Date;
  };

  expectTypeOf<SyncManagerAPI>().toHaveProperty('start').returns.toEqualTypeOf<Promise<void>>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('stop').returns.toEqualTypeOf<Promise<void>>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('sync').returns.toEqualTypeOf<Promise<void>>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('isRunning').returns.toEqualTypeOf<boolean>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('getState').returns.toEqualTypeOf<SyncState>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('getCursor').returns.toEqualTypeOf<string>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('setCursor').parameters.toEqualTypeOf<[string]>();
  expectTypeOf<SyncManagerAPI>().toHaveProperty('getLastSyncTime').returns.toEqualTypeOf<Date>();
});

// ============================================================================
// Type Tests for React Component Props
// ============================================================================

it('Button component props should be correctly typed', () => {
  type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

  type ButtonProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
  };

  expectTypeOf<ButtonProps>().toHaveProperty('variant').toEqualTypeOf<ButtonVariant | undefined>();
  expectTypeOf<ButtonProps>().toHaveProperty('size').toEqualTypeOf<ButtonSize | undefined>();
  expectTypeOf<ButtonProps>().toHaveProperty('disabled').toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ButtonProps>().toHaveProperty('loading').toEqualTypeOf<boolean | undefined>();
  expectTypeOf<ButtonProps>().toHaveProperty('onClick').toEqualTypeOf<
    | ((event: React.MouseEvent<HTMLButtonElement>) => void)
    | undefined
  >();
  expectTypeOf<ButtonProps>().toHaveProperty('children').toEqualTypeOf<React.ReactNode>();
});

it('LeadCard component props should enforce lead type', () => {
  type Lead = {
    id: string;
    name: string;
    phone: string;
    status: string;
    organization_id: string;
  };

  type LeadCardProps = {
    lead: Lead;
    onPress?: (lead: Lead) => void;
    onLongPress?: (lead: Lead) => void;
    showActions?: boolean;
  };

  expectTypeOf<LeadCardProps>().toHaveProperty('lead').toEqualTypeOf<Lead>();
  expectTypeOf<LeadCardProps>().toHaveProperty('onPress').toEqualTypeOf<
    | ((lead: Lead) => void)
    | undefined
  >();
});

it('CallModal component props should enforce call record type', () => {
  type CallRecord = {
    id: string;
    lead_id: string;
    lead_name: string;
    lead_phone: string;
    duration: number;
    status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  };

  type CallModalProps = {
    record?: CallRecord;
    onSave: (record: Omit<CallRecord, 'id'>) => Promise<void>;
    onCancel: () => void;
    isOpen: boolean;
  };

  expectTypeOf<CallModalProps>().toHaveProperty('record').toEqualTypeOf<CallRecord | undefined>();
  expectTypeOf<CallModalProps>().toHaveProperty('onSave').toEqualTypeOf<
    (record: Omit<CallRecord, 'id'>) => Promise<void>
  >();
  expectTypeOf<CallModalProps>().toHaveProperty('onCancel').toEqualTypeOf<() => void>();
  expectTypeOf<CallModalProps>().toHaveProperty('isOpen').toEqualTypeOf<boolean>();
});

// ============================================================================
// Type Tests for Supabase API Types
// ============================================================================

it('Supabase client should be correctly typed', () => {
  type Database = {
    public: {
      Tables: {
        organizations: {
          Row: { id: string; name: string; slug: string; settings: any; created_at: string; updated_at: string };
          Insert: { id?: string; name: string; slug: string; settings?: any; created_at?: string; updated_at?: string };
          Update: { id?: string; name?: string; slug?: string; settings?: any; created_at?: string; updated_at?: string };
        };
        profiles: {
          Row: { id: string; organization_id: string; role: 'ADMIN' | 'AGENT'; name: string; phone: string; avatar_url: string | null; created_at: string; updated_at: string };
          Insert: { id: string; organization_id: string; role: 'ADMIN' | 'AGENT'; name: string; phone: string; avatar_url?: string | null; created_at?: string; updated_at?: string };
          Update: { id?: string; organization_id?: string; role?: 'ADMIN' | 'AGENT'; name?: string; phone?: string; avatar_url?: string | null; created_at?: string; updated_at?: string };
        };
        leads: {
          Row: { id: string; organization_id: string; name: string; phone: string; email: string | null; status: string; source: string; assigned_agent_id: string | null; created_at: string; updated_at: string };
          Insert: { id?: string; organization_id: string; name: string; phone: string; email?: string | null; status?: string; source?: string; assigned_agent_id?: string | null; created_at?: string; updated_at?: string };
          Update: { id?: string; organization_id?: string; name?: string; phone?: string; email?: string | null; status?: string; source?: string; assigned_agent_id?: string | null; created_at?: string; updated_at?: string };
        };
      };
    };
  };

  expectTypeOf<Database['public']['Tables']['organizations']['Row']>().toHaveProperty('id');
  expectTypeOf<Database['public']['Tables']['profiles']['Row']>().toHaveProperty('role').toEqualTypeOf<'ADMIN' | 'AGENT'>();
  expectTypeOf<Database['public']['Tables']['leads']['Insert']>().toHaveProperty('organization_id');
});

// ============================================================================
// Type Tests for Utility Types
// ============================================================================

it('Utility types should work correctly', () => {
  type Lead = { id: string; name: string; phone: string; status: string; email?: string };

  // Pick
  type LeadSummary = Pick<Lead, 'id' | 'name' | 'status'>;
  expectTypeOf<LeadSummary>().toHaveProperty('id').toEqualTypeOf<string>();
  expectTypeOf<LeadSummary>().toHaveProperty('name').toEqualTypeOf<string>();
  expectTypeOf<LeadSummary>().toHaveProperty('status').toEqualTypeOf<string>();
  expectTypeOf<LeadSummary>().not.toHaveProperty('phone');

  // Omit
  type LeadWithoutId = Omit<Lead, 'id'>;
  expectTypeOf<LeadWithoutId>().not.toHaveProperty('id');
  expectTypeOf<LeadWithoutId>().toHaveProperty('name');

  // Partial
  type PartialLead = Partial<Lead>;
  expectTypeOf<PartialLead>().toHaveProperty('id').toEqualTypeOf<string | undefined>();
  expectTypeOf<PartialLead>().toHaveProperty('name').toEqualTypeOf<string | undefined>();

  // Required
  type RequiredLead = Required<PartialLead>;
  expectTypeOf<RequiredLead>().toHaveProperty('id').toEqualTypeOf<string>();

  // Record
  type LeadMap = Record<string, Lead>;
  expectTypeOf<LeadMap>('test-id').toEqualTypeOf<Lead>();

  // Exclude/Extract
  type Status = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';
  type OpenStatus = Exclude<Status, 'CLOSED'>;
  expectTypeOf<OpenStatus>().toEqualTypeOf<'NEW' | 'CONTACTED' | 'QUALIFIED'>();
});

it('Async utility types should work', () => {
  type AsyncResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

  type SyncLeadFn = (lead: { name: string; phone: string }) => Promise<AsyncResult<{ id: string }>>;

  expectTypeOf<SyncLeadFn>().returns.toEqualTypeOf<Promise<AsyncResult<{ id: string }>>>();

  // Awaited
  type AwaitedResult = Awaited<ReturnType<SyncLeadFn>>;
  expectTypeOf<AwaitedResult>().toEqualTypeOf<AsyncResult<{ id: string }>>();
});

// ============================================================================
// Type Tests for Error Handling
// ============================================================================

it('Result type should handle errors correctly', () => {
  type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

  function divide(a: number, b: number): Result<number, string> {
    if (b === 0) return { ok: false, error: 'Division by zero' };
    return { ok: true, value: a / b };
  }

  type DivideResult = ReturnType<typeof divide>;
  expectTypeOf<DivideResult>().toEqualTypeOf<Result<number, string>>();

  // Type narrowing
  type SuccessCase = DivideResult extends { ok: true; value: infer T } ? T : never;
  expectTypeOf<SuccessCase>().toEqualTypeOf<number>();

  type ErrorCase = DivideResult extends { ok: false; error: infer E } ? E : never;
  expectTypeOf<ErrorCase>().toEqualTypeOf<string>();
});