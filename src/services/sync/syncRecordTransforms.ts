import { remoteSyncRecord, type SyncRecord } from './syncRecords';
import { serverRevision, type SyncEntityType } from './syncTypes';

type GenericRecord = Record<string, unknown>;
type PgBase = GenericRecord & { id: unknown; organization_id: unknown; created_at: unknown; updated_at: unknown; deleted_at: unknown };
type LocalBase = SyncRecord & { createdAt: unknown; updatedAt: unknown; deletedAt: unknown; isSynced: 1; serverRevision: number | undefined };

function firstTruthy<T>(...values: T[]): T {
  for (const value of values) if (value) return value;
  return values[values.length - 1];
}

function firstPresent<T>(...values: T[]): T {
  for (const value of values) if (value !== null && value !== undefined) return value;
  return values[values.length - 1];
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function pgBase(payload: GenericRecord, orgId: string): PgBase {
  return {
    id: payload.id,
    organization_id: orgId,
    created_at: firstTruthy(payload.createdAt, payload.created_at, new Date().toISOString()),
    updated_at: firstTruthy(payload.updatedAt, payload.updated_at, new Date().toISOString()),
    deleted_at: payload.deletedAt !== undefined ? payload.deletedAt : firstTruthy(payload.deleted_at, null),
  };
}

function leadToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return {
    ...base,
    business_name: firstTruthy(p.businessName, p.business_name, ''), category: firstTruthy(p.category, 'Gym'),
    phone: firstTruthy(p.phone, ''), phone_raw: firstTruthy(p.phoneRaw, p.phone_raw, null),
    phone_e164: firstTruthy(p.phoneE164, p.phone_e164, null), phone_type: firstTruthy(p.phoneType, p.phone_type, 'mobile'),
    alternate_phone: firstTruthy(p.alternatePhone, p.alternate_phone, null), contact_person: firstTruthy(p.contactPerson, p.contact_person, null),
    address: firstTruthy(p.address, ''), locality: firstTruthy(p.locality, ''), pincode: firstTruthy(p.pincode, null),
    city: firstTruthy(p.city, 'Lucknow'), state: firstTruthy(p.state, 'Uttar Pradesh'), website: firstTruthy(p.website, null),
    rating: firstPresent(p.rating, null), review_count: firstPresent(p.reviewCount, p.review_count, null),
    source: firstTruthy(p.source, 'Field Sales'), source_file: firstTruthy(p.sourceFile, p.source_file, null),
    source_row: firstPresent(p.sourceRow, p.source_row, null), status: firstTruthy(p.status, 'NEW'),
    custom_notes: firstTruthy(p.customNotes, p.custom_notes, ''), last_contacted_at: firstTruthy(p.lastContactedAt, p.last_contacted_at, null),
    next_follow_up_at: firstTruthy(p.nextFollowUpAt, p.next_follow_up_at, null), call_count: firstPresent(p.callCount, p.call_count, 0),
    created_by: firstTruthy(p.createdBy, p.created_by, null), assigned_to: firstTruthy(p.assignedTo, p.assigned_to, null),
    updated_by: firstTruthy(p.updatedBy, p.updated_by, null),
  };
}

function callRecordToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return {
    ...base,
    lead_id: firstTruthy(p.leadId, p.lead_id), user_id: firstTruthy(p.userId, p.user_id, null), device_id: firstTruthy(p.deviceId, p.device_id, null),
    dial_attempt_id: firstPresent(p.dialAttemptId, p.dial_attempt_id, null), started_at: firstTruthy(p.startedAt, p.started_at),
    answered_at: firstTruthy(p.answeredAt, p.answered_at, null), ended_at: firstTruthy(p.endedAt, p.ended_at, null),
    duration_seconds: firstPresent(p.durationSeconds, p.duration_seconds, 0), reported_duration_seconds: firstPresent(p.reportedDurationSeconds, p.reported_duration_seconds, null),
    outcome: firstTruthy(p.outcome, 'OTHER'), call_status: firstTruthy(p.callStatus, p.call_status, null), remark: firstTruthy(p.remark, null),
    verification_status: firstTruthy(p.verificationStatus, p.verification_status, 'UNVERIFIED'),
  };
}

function activityToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, lead_id: firstTruthy(p.leadId, p.lead_id, null), user_id: firstTruthy(p.userId, p.user_id, null), device_id: firstTruthy(p.deviceId, p.device_id, null), activity_type: firstTruthy(p.activityType, p.activity_type), metadata: firstTruthy(p.metadata, {}) };
}
function remarkToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, lead_id: firstTruthy(p.leadId, p.lead_id), user_id: firstTruthy(p.userId, p.user_id, null), content: firstTruthy(p.content, ''), type: firstTruthy(p.type, 'CUSTOM'), author: firstTruthy(p.author, 'Sales Rep') };
}
function followUpToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, lead_id: firstTruthy(p.leadId, p.lead_id), user_id: firstTruthy(p.userId, p.user_id, null), scheduled_at: firstTruthy(p.scheduledAt, p.scheduled_at), title: firstTruthy(p.title, 'Follow-up'), notes: firstTruthy(p.notes, null), priority: firstTruthy(p.priority, 'MEDIUM'), status: firstTruthy(p.status, 'PENDING'), completed_at: firstTruthy(p.completedAt, p.completed_at, null), outcome_notes: firstTruthy(p.outcomeNotes, p.outcome_notes, null) };
}
function messageHistoryToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, lead_id: firstTruthy(p.leadId, p.lead_id), user_id: firstTruthy(p.userId, p.user_id, null), template_id: firstTruthy(p.templateId, p.template_id, null), channel: firstTruthy(p.channel, 'WHATSAPP'), recipient_phone: firstTruthy(p.recipientPhone, p.recipient_phone), message_content: firstTruthy(p.messageContent, p.message_content), sent_status: firstTruthy(p.sentStatus, p.sent_status, 'SENT'), sent_at: firstTruthy(p.sentAt, p.sent_at, base.created_at) };
}
function importAuditToPg(p: GenericRecord, base: PgBase, orgId: string): GenericRecord {
  return { id: p.id, organization_id: orgId, uploaded_by: firstTruthy(p.uploadedBy, p.uploaded_by, null), device_id: firstTruthy(p.deviceId, p.device_id, null), filename: firstTruthy(p.filename, 'import.xlsx'), source: firstTruthy(p.source, 'Excel Import'), started_at: firstTruthy(p.startedAt, p.started_at), completed_at: firstTruthy(p.completedAt, p.completed_at, null), total_rows: firstPresent(p.totalRows, p.total_rows, 0), imported: firstPresent(p.imported, 0), updated: firstPresent(p.updated, 0), duplicates: firstPresent(p.duplicates, 0), invalid: firstPresent(p.invalid, 0), created_at: base.created_at, updated_at: base.updated_at };
}
function bulkAssignmentAuditToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, performed_by: firstTruthy(p.performedBy, p.performed_by), target_agent_id: firstTruthy(p.targetAgentId, p.target_agent_id), selected_lead_count: firstPresent(p.selectedLeadCount, p.selected_lead_count, 0), successful_count: firstPresent(p.successfulCount, p.successful_count, 0), failed_count: firstPresent(p.failedCount, p.failed_count, 0), started_at: firstTruthy(p.startedAt, p.started_at), completed_at: firstTruthy(p.completedAt, p.completed_at), filter_snapshot: firstTruthy(p.filterSnapshot, p.filter_snapshot, {}), status: firstTruthy(p.status, 'COMPLETED'), error_summary: firstTruthy(p.errorSummary, p.error_summary, null) };
}
function profileToPg(p: GenericRecord, base: PgBase): GenericRecord {
  return { ...base, name: firstTruthy(p.name, ''), email: firstTruthy(p.email, ''), phone: firstPresent(p.phone, ''), role: firstTruthy(p.role, 'AGENT'), status: firstTruthy(p.status, 'ACTIVE'), created_by: firstTruthy(p.createdBy, p.created_by, null), last_login_at: firstTruthy(p.lastLoginAt, p.last_login_at, null), version: firstPresent(p.version, 1) };
}

const TO_PG: Record<SyncEntityType, (p: GenericRecord, base: PgBase, orgId: string) => GenericRecord> = {
  leads: leadToPg,
  call_records: callRecordToPg,
  activities: activityToPg,
  remarks: remarkToPg,
  follow_ups: followUpToPg,
  message_history: messageHistoryToPg,
  import_audits: importAuditToPg,
  bulk_assignment_audits: bulkAssignmentAuditToPg,
  profiles: profileToPg,
};

export function transformToPgRecord(entityType: SyncEntityType, payload: GenericRecord, expectedOrgId: string | null = null): GenericRecord {
  const payloadOrgId = firstTruthy(payload.organizationId, payload.organization_id, null);
  if (payloadOrgId && expectedOrgId && payloadOrgId !== expectedOrgId) throw new Error('Mutation payload organization does not match its outbox context.');
  const orgId = firstTruthy(payloadOrgId, expectedOrgId);
  if (typeof orgId !== 'string' || !orgId) throw new Error('Mutation is missing an organization context.');
  const base = pgBase(payload, orgId);
  return TO_PG[entityType](payload, base, orgId);
}

function localBase(row: GenericRecord): LocalBase {
  return { id: String(row.id), createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(), updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(), deletedAt: firstTruthy(row.deleted_at, null), isSynced: 1, serverRevision: serverRevision(row) };
}
function leadFromPg(r: GenericRecord, b: LocalBase): SyncRecord {
  return { ...b, organizationId: firstTruthy(r.organization_id, null), businessName: firstTruthy(r.business_name, ''), category: firstTruthy(r.category, 'Gym'), phone: firstTruthy(r.phone, ''), phoneRaw: firstTruthy(r.phone_raw, r.phone), phoneE164: firstTruthy(r.phone_e164, r.phone), phoneType: firstTruthy(r.phone_type, 'mobile'), alternatePhone: firstTruthy(r.alternate_phone, null), contactPerson: firstTruthy(r.contact_person, null), address: firstTruthy(r.address, ''), locality: firstTruthy(r.locality, ''), pincode: firstTruthy(r.pincode, null), city: firstTruthy(r.city, 'Lucknow'), state: firstTruthy(r.state, 'Uttar Pradesh'), website: firstTruthy(r.website, null), rating: numberOrNull(r.rating), reviewCount: numberOrNull(r.review_count), source: firstTruthy(r.source, 'Field Sales'), sourceFile: firstTruthy(r.source_file, null), sourceRow: numberOrNull(r.source_row), status: firstTruthy(r.status, 'NEW'), customNotes: firstTruthy(r.custom_notes, ''), lastContactedAt: firstTruthy(r.last_contacted_at, null), nextFollowUpAt: firstTruthy(r.next_follow_up_at, null), callCount: Number(firstTruthy(r.call_count, 0)), createdBy: firstTruthy(r.created_by, null), assignedTo: firstTruthy(r.assigned_to, null), updatedBy: firstTruthy(r.updated_by, null) };
}
function callRecordFromPg(r: GenericRecord, b: LocalBase): SyncRecord {
  return { ...b, leadId: r.lead_id, userId: firstTruthy(r.user_id, null), deviceId: firstTruthy(r.device_id, null), dialAttemptId: firstPresent(r.dial_attempt_id, null), startedAt: r.started_at, answeredAt: firstTruthy(r.answered_at, null), endedAt: firstTruthy(r.ended_at, null), durationSeconds: Number(firstTruthy(r.duration_seconds, 0)), reportedDurationSeconds: numberOrNull(r.reported_duration_seconds), outcome: firstTruthy(r.outcome, 'OTHER'), callStatus: firstTruthy(r.call_status, undefined), remark: firstTruthy(r.remark, null), verificationStatus: firstTruthy(r.verification_status, 'UNVERIFIED') };
}
function activityFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { ...b, leadId: firstTruthy(r.lead_id, null), userId: firstTruthy(r.user_id, null), deviceId: firstTruthy(r.device_id, null), activityType: r.activity_type, metadata: firstTruthy(r.metadata, {}) }; }
function remarkFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { ...b, leadId: r.lead_id, userId: firstTruthy(r.user_id, null), content: firstTruthy(r.content, ''), type: firstTruthy(r.type, 'CUSTOM'), author: firstTruthy(r.author, 'Sales Rep') }; }
function followUpFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { ...b, leadId: r.lead_id, userId: firstTruthy(r.user_id, null), scheduledAt: r.scheduled_at, title: firstTruthy(r.title, 'Follow-up'), notes: firstTruthy(r.notes, null), priority: firstTruthy(r.priority, 'MEDIUM'), status: firstTruthy(r.status, 'PENDING'), completedAt: firstTruthy(r.completed_at, null), outcomeNotes: firstTruthy(r.outcome_notes, null) }; }
function messageHistoryFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { ...b, leadId: r.lead_id, userId: firstTruthy(r.user_id, null), templateId: firstTruthy(r.template_id, null), channel: firstTruthy(r.channel, 'WHATSAPP'), recipientPhone: r.recipient_phone, messageContent: r.message_content, sentStatus: firstTruthy(r.sent_status, 'SENT'), sentAt: firstTruthy(r.sent_at, b.createdAt) }; }
function importAuditFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { id: String(r.id), uploadedBy: firstTruthy(r.uploaded_by, null), deviceId: firstTruthy(r.device_id, null), filename: firstTruthy(r.filename, 'import.xlsx'), source: firstTruthy(r.source, 'Excel Import'), startedAt: r.started_at, completedAt: firstTruthy(r.completed_at, null), totalRows: Number(firstTruthy(r.total_rows, 0)), imported: Number(firstTruthy(r.imported, 0)), updated: Number(firstTruthy(r.updated, 0)), duplicates: Number(firstTruthy(r.duplicates, 0)), invalid: Number(firstTruthy(r.invalid, 0)), createdAt: b.createdAt, updatedAt: b.updatedAt, isSynced: 1, serverRevision: b.serverRevision }; }
function profileFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { ...b, organizationId: firstTruthy(r.organization_id, null), name: firstTruthy(r.name, ''), email: firstTruthy(r.email, ''), phone: firstTruthy(r.phone, ''), role: firstTruthy(r.role, 'AGENT'), status: firstTruthy(r.status, 'ACTIVE'), createdBy: firstTruthy(r.created_by, null), lastLoginAt: firstTruthy(r.last_login_at, null) }; }
function bulkAssignmentAuditFromPg(r: GenericRecord, b: LocalBase): SyncRecord { return { id: String(r.id), organizationId: firstTruthy(r.organization_id, null), performedBy: r.performed_by, targetAgentId: r.target_agent_id, selectedLeadCount: Number(firstTruthy(r.selected_lead_count, 0)), successfulCount: Number(firstTruthy(r.successful_count, 0)), failedCount: Number(firstTruthy(r.failed_count, 0)), startedAt: r.started_at, completedAt: r.completed_at, filterSnapshot: firstTruthy(r.filter_snapshot, {}), status: firstTruthy(r.status, 'COMPLETED'), errorSummary: firstTruthy(r.error_summary, null), createdAt: b.createdAt, updatedAt: b.updatedAt, isSynced: 1, serverRevision: b.serverRevision }; }

const FROM_PG: Record<SyncEntityType, (r: GenericRecord, b: LocalBase) => SyncRecord> = {
  leads: leadFromPg,
  call_records: callRecordFromPg,
  activities: activityFromPg,
  remarks: remarkFromPg,
  follow_ups: followUpFromPg,
  message_history: messageHistoryFromPg,
  import_audits: importAuditFromPg,
  profiles: profileFromPg,
  bulk_assignment_audits: bulkAssignmentAuditFromPg,
};

export function transformFromPgRecord(entityType: SyncEntityType, input: GenericRecord): SyncRecord {
  const row = remoteSyncRecord(input);
  const base = localBase(row);
  return FROM_PG[entityType](row, base);
}
