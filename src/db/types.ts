/**
 * Amaratv Krishi Sales CRM - Data Layer Type Definitions
 * Offline-first schema with future cloud-sync and soft-deletion support.
 */

/** Optional for pre-upgrade cache/backup records; only populated from server responses. */
export interface ServerSyncMetadata { serverRevision?: number; }

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'SAMPLE_REQUESTED'
  | 'FOLLOW_UP'
  | 'NEGOTIATION'
  | 'CUSTOMER'
  | 'NOT_INTERESTED'
  | 'WRONG_NUMBER'
  | 'DO_NOT_CONTACT';

export type PhoneType = 'mobile' | 'landline' | 'invalid';

export type CallOutcome =
  | 'CONNECTED'
  | 'BUSY'
  | 'NO_ANSWER'
  | 'WRONG_NUMBER'
  | 'CALLBACK_REQUESTED'
  | 'INVALID_NUMBER'
  | 'OTHER';

export type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export type MessageChannel = 'WHATSAPP' | 'SMS';

export type MessageStatus = 'INITIATED' | 'SENT' | 'FAILED';

export type TemplateCategory =
  | 'INTRO'
  | 'SAMPLE_OFFER'
  | 'FOLLOW_UP'
  | 'PRICING'
  | 'RE_ENGAGE';

export type RemarkType = 'PREDEFINED' | 'CUSTOM';

/**
 * Core Lead Entity
 * Contains business information, normalized contact points, location,
 * sales workflow status, and system metadata.
 */
export interface Lead extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  businessName: string; // Normalized business title (e.g. "Skywards Fitness Zone")
  category: string; // Category string (e.g. "Gym", "Fitness center")
  phone: string; // Clean primary phone digits (e.g. "7054447888" or "05224227316")
  phoneRaw: string; // Original raw phone string from Excel (e.g. "+91 70544 47888")
  phoneE164: string; // E.164 standard phone format (e.g. "+917054447888")
  phoneType: PhoneType; // 'mobile' | 'landline' | 'invalid'
  alternatePhone: string | null; // Optional secondary/alternate contact
  contactPerson: string | null; // Name of gym owner/trainer/manager
  address: string; // Full raw address string
  locality: string; // Lucknow locality (e.g. "LDA Colony", "Alambagh")
  pincode: string; // 6-digit postal PIN code (e.g. "226012")
  city: string; // Default: "Lucknow"
  state: string; // Default: "Uttar Pradesh"
  website: string | null; // Website URL if available
  rating: number | null; // Google rating if available (e.g. 4.5)
  reviewCount: number | null; // Review count if available
  source: string; // Data origin (e.g. "Excel Seed: 2026-08-19", "Manual Entry")
  sourceFile: string | null; // Original Excel file reference
  sourceRow: number | null; // Row index in original spreadsheet
  status: LeadStatus; // Current pipeline state
  customNotes: string; // General rep notes
  lastContactedAt: string | null; // ISO DateTime string of last call/message
  nextFollowUpAt: string | null; // ISO DateTime / Date string of scheduled follow-up
  callCount: number; // Cumulative count of completed/logged calls
  createdAt: string; // ISO DateTime of creation
  updatedAt: string; // ISO DateTime of last modification
  isSynced: number; // 0 = un-synced/modified local, 1 = synced with cloud
  syncedAt: string | null; // ISO DateTime of last successful cloud sync
  deletedAt: string | null; // ISO DateTime if archived/soft-deleted, null if active
  // Phase 2 Ownership & Assignment Fields
  createdBy?: string | null; // User ID who created/imported the lead (null for legacy)
  assignedTo?: string | null; // User ID of currently assigned Agent (null if unassigned)
  updatedBy?: string | null; // User ID who last updated the lead
  version?: number; // Optimistic concurrency version
}

/**
 * User Entity (Phase 2B)
 * Supports ADMIN and AGENT roles. No passwords stored.
 */
export type UserRole = 'ADMIN' | 'AGENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  organizationId?: string | null; // Multi-tenant organization UUID
  name: string; // Full representative name
  email: string; // Login identifier / email
  phone: string; // Contact phone
  role: UserRole; // 'ADMIN' | 'AGENT'
  status: UserStatus; // 'ACTIVE' | 'INACTIVE'
  createdAt: string; // ISO DateTime
  createdBy: string | null; // Admin user ID who created this account (null for initial super-admin)
  updatedAt: string; // ISO DateTime
  lastLoginAt: string | null; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null; // Soft-deletion support
  version?: number; // Optimistic concurrency version
}

/**
 * Activity / Event Entity (Phase 2B)
 * Append-only immutable log of all sales actions, status changes, and assignments.
 */
export type ActivityType =
  | 'LEAD_CREATED'
  | 'LEAD_IMPORTED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_REASSIGNED'
  | 'LEAD_UNASSIGNED'
  | 'CALL_STARTED'
  | 'CALL_INITIATED'
  | 'CALL_COMPLETED'
  | 'CALL_CANCELLED'
  | 'CALL_OUTCOME_LOGGED'
  | 'REMARK_ADDED'
  | 'WHATSAPP_INITIATED'
  | 'WHATSAPP_FAILED'
  | 'FOLLOW_UP_CREATED'
  | 'FOLLOW_UP_COMPLETED'
  | 'FOLLOW_UP_CANCELLED'
  | 'FOLLOW_UP_RESCHEDULED'
  | 'STATUS_CHANGED'
  | 'LEAD_UPDATED'
  | 'AGENT_CREATED'
  | 'AGENT_UPDATED'
  | 'AGENT_ACTIVATED'
  | 'AGENT_DEACTIVATED'
  | 'AGENT_DELETED'
  | 'BULK_ASSIGNMENT_EXECUTED';

export interface Activity extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  leadId: string | null; // Foreign Key -> Lead.id (null for admin/system events)
  userId: string; // Foreign Key -> User.id (actor)
  deviceId: string | null; // Stable device ID
  activityType: ActivityType; // Action type
  metadata: Record<string, unknown>; // Arbitrary event context (outcomes, duration, diffs)
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null; // Soft-delete support
  version?: number; // Optimistic concurrency version
}

/**
 * Call Record Entity (Phase 2B & 2J)
 * Foundation for detailed call tracking, lifecycle reconciliation, and verified duration.
 */
export type CallVerificationStatus = 'UNVERIFIED' | 'VERIFIED';
export type CallRecordStatus =
  | 'DIAL_ATTEMPT'
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface CallRecord extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  leadId: string; // Foreign Key -> Lead.id
  userId: string; // Foreign Key -> User.id (rep/admin)
  deviceId: string | null; // Originating device ID
  dialAttemptId?: string | null; // Idempotency identifier for lifecycle attempt
  startedAt: string; // ISO DateTime call initiated
  answeredAt: string | null; // ISO DateTime call answered (when supported)
  endedAt: string | null; // ISO DateTime call ended / returned to app
  durationSeconds: number; // Call duration in seconds (0 if unverified)
  reportedDurationSeconds?: number | null; // Optional user-reported duration (explicitly unverified)
  outcome: CallOutcome; // Outcome status
  callStatus?: CallRecordStatus; // High-level status
  remark: string | null; // Note or outcome remark
  verificationStatus: CallVerificationStatus; // 'UNVERIFIED' | 'VERIFIED'
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null; // Soft-delete support
  version?: number; // Optimistic concurrency version
}

/**
 * Import Audit Entity (Phase 2B)
 * Tracks batch lead imports from Excel or CSV files.
 */
export interface ImportAudit extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  uploadedBy: string | null; // User ID who performed import; null when the referenced profile was removed
  deviceId: string | null; // Originating device ID
  filename: string; // File name (e.g. "Lucknow-Gyms.xlsx")
  source: string; // Source tag
  startedAt: string; // ISO DateTime
  completedAt: string | null; // ISO DateTime; nullable for an incomplete/server-retained audit
  totalRows: number; // Total rows in spreadsheet
  imported: number; // Count of newly inserted leads
  updated: number; // Count of updated leads
  duplicates: number; // Count of duplicate rows skipped
  invalid: number; // Count of malformed rows skipped
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  version?: number; // Optimistic concurrency version
}

/**
 * Bulk Assignment Audit Entity (Phase 2K)
 * Tracks batch lead assignment operations executed by administrators.
 */
export interface BulkAssignmentAudit extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  organizationId?: string | null; // Multi-tenant org ID
  performedBy: string; // Admin User ID who executed the bulk assignment
  targetAgentId: string; // Target Agent User ID
  selectedLeadCount: number; // Count of selected leads
  successfulCount: number; // Count of successfully assigned leads
  failedCount: number; // Count of failed assignments
  startedAt: string; // ISO DateTime
  completedAt: string; // ISO DateTime
  filterSnapshot?: Record<string, unknown>; // Search/Filter parameters used at selection
  status: 'PENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  errorSummary?: string | null; // Errors encountered if any
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null;
  version?: number; // Optimistic concurrency version
}


/**
 * Remark / Note Entity
 * Tracks timestamped notes, sample feedback, and sales observations for a lead.
 */
export interface Remark extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  leadId: string; // Foreign Key -> Lead.id
  userId?: string | null; // User ID who authored the remark
  type: RemarkType; // 'PREDEFINED' | 'CUSTOM'
  content: string; // Remark text content
  author: string; // Sales rep identifier / username
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null; // Soft-delete support
  version?: number; // Optimistic concurrency version
}

/**
 * CallHistory Entity
 * Detailed log of every outgoing call attempt and its recorded outcome.
 */
export interface CallHistory {
  id: string; // Primary Key (UUID v4)
  leadId: string; // Foreign Key -> Lead.id
  calledNumber: string; // Phone number dialed
  phoneType: PhoneType; // 'mobile' | 'landline'
  startedAt: string; // ISO DateTime call initiated
  endedAt: string | null; // ISO DateTime call completed/returned
  durationSeconds: number; // Duration in seconds (default: 0)
  outcome: CallOutcome; // Outcome status
  notes: string | null; // Quick notes logged after call
  createdAt: string; // ISO DateTime
  updatedAt: string; // ISO DateTime
  isSynced: number; // 0 = un-synced, 1 = synced
  deletedAt: string | null;
  version?: number; // Optimistic concurrency version
}

/**
 * FollowUp Entity
 * Scheduled follow-up reminders and tasks with priorities.
 */
export interface FollowUp extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  leadId: string; // Foreign Key -> Lead.id
  userId?: string | null; // User ID who scheduled this follow-up
  scheduledAt: string; // ISO DateTime of the follow-up reminder
  title: string; // Short summary (e.g. "Deliver 1kg Amaratv Protein Flour sample")
  notes: string | null; // Detailed instructions
  priority: FollowUpPriority; // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: FollowUpStatus; // 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED'
  completedAt: string | null; // ISO DateTime when marked complete
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  deletedAt: string | null;
  version?: number; // Optimistic concurrency version
}

/**
 * MessageHistory Entity
 * Logs outbound WhatsApp or SMS messages sent to leads.
 */
export interface MessageHistory extends ServerSyncMetadata {
  id: string; // Primary Key (UUID v4)
  leadId: string; // Foreign Key -> Lead.id
  userId?: string | null; // User ID who sent the message
  channel: MessageChannel; // 'WHATSAPP' | 'SMS'
  templateId: string | null; // Foreign Key -> MessageTemplate.id (if used)
  recipientPhone: string; // Destination phone number
  messageContent: string; // Rendered message body
  sentStatus: MessageStatus; // 'INITIATED' | 'SENT' | 'FAILED'
  sentAt: string; // ISO DateTime
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  deletedAt: string | null;
  version?: number; // Optimistic concurrency version
}

/**
 * MessageTemplate Entity
 * Predefined pitch scripts and messages for Amaratv Krishi products.
 */
export interface MessageTemplate {
  id: string; // Primary Key (UUID v4)
  title: string; // Template title (e.g. "Introductory Pitch - Gym Owners")
  category: TemplateCategory; // Template category
  body: string; // Template body with placeholders (e.g. {{businessName}}, {{locality}})
  isDefault: boolean; // Built-in default template flag
  createdAt: string;
  updatedAt: string;
  isSynced: number;
  deletedAt: string | null;
  version?: number; // Optimistic concurrency version
}

/**
 * Search and Filter Parameters for Leads
 */
export interface LeadFilterParams {
  searchTerm?: string; // Substring match on businessName, phone, contactPerson, locality
  status?: LeadStatus | LeadStatus[];
  locality?: string | string[];
  category?: string | string[];
  hasFollowUp?: boolean;
  followUpDueBefore?: string; // ISO Date
  assignedTo?: string | null; // Filter leads assigned to user
  createdBy?: string | null; // Filter leads created by user
  includeDeleted?: boolean; // Default false
  limit?: number;
  offset?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'businessName' | 'nextFollowUpAt' | 'lastContactedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Lead Aggregation Metrics
 */
export interface LeadStats {
  totalLeads: number;
  activeLeads: number;
  statusCounts: Record<LeadStatus, number>;
  totalCallsLogged: number;
  pendingFollowUpsCount: number;
  todayFollowUpsCount: number;
}

export type * from '../services/sync/syncTypes';
