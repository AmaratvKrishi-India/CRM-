# 09 - API & DATA CONTRACTS

This document outlines the core domain types, the Supabase REST API schema, Sync Data Flow, and Realtime Events used within the Amaratv Krishi Field Sales CRM.

## TypeScript Domain Types

The application relies on strong TypeScript typing to ensure consistency across the local Dexie database and the remote Supabase database. The primary types are defined in [`types.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts).

### Enums/Union Types

- **UserRole**: `'ADMIN' | 'AGENT'`
- **UserStatus**: `'ACTIVE' | 'INACTIVE'`
- **LeadStatus**: `'NEW' | 'CONTACTED' | 'INTERESTED' | 'SAMPLE_REQUESTED' | 'FOLLOW_UP' | 'NEGOTIATION' | 'CUSTOMER' | 'NOT_INTERESTED' | 'WRONG_NUMBER' | 'DO_NOT_CONTACT'`
- **PhoneType**: `'mobile' | 'landline' | 'invalid'`
- **CallOutcome**: `'CONNECTED' | 'BUSY' | 'NO_ANSWER' | 'WRONG_NUMBER' | 'CALLBACK_REQUESTED' | 'INVALID_NUMBER' | 'OTHER'`
- **CallVerificationStatus**: `'VERIFIED' | 'UNVERIFIED'`
- **CallRecordStatus**: `'DIAL_ATTEMPT' | 'CONNECTED' | 'NOT_CONNECTED' | 'CANCELLED' | 'UNKNOWN'`
- **FollowUpPriority**: `'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'`
- **FollowUpStatus**: `'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED'`
- **MessageChannel**: `'WHATSAPP' | 'SMS'`
- **MessageStatus**: `'INITIATED' | 'SENT' | 'FAILED'`
- **TemplateCategory**: `'INTRO' | 'SAMPLE_OFFER' | 'FOLLOW_UP' | 'PRICING' | 'RE_ENGAGE'`
- **RemarkType**: `'PREDEFINED' | 'CUSTOM'`
- **ActivityType**: `'LEAD_CREATED' | 'LEAD_IMPORTED' | 'LEAD_ASSIGNED' | 'LEAD_REASSIGNED' | 'LEAD_UNASSIGNED' | 'CALL_STARTED' | 'CALL_INITIATED' | 'CALL_COMPLETED' | 'CALL_CANCELLED' | 'CALL_OUTCOME_LOGGED' | 'REMARK_ADDED' | 'WHATSAPP_INITIATED' | 'WHATSAPP_FAILED' | 'FOLLOW_UP_CREATED' | 'FOLLOW_UP_COMPLETED' | 'FOLLOW_UP_CANCELLED' | 'FOLLOW_UP_RESCHEDULED' | 'STATUS_CHANGED' | 'LEAD_UPDATED' | 'AGENT_CREATED' | 'AGENT_UPDATED' | 'AGENT_ACTIVATED' | 'AGENT_DEACTIVATED' | 'AGENT_DELETED' | 'BULK_ASSIGNMENT_EXECUTED'`
- **SyncEntityType**: `'leads' | 'call_records' | 'activities' | 'remarks' | 'follow_ups' | 'message_history' | 'import_audits' | 'profiles' | 'bulk_assignment_audits'`
- **SyncOperation**: `'CREATE' | 'UPDATE' | 'DELETE'`
- **OutboxStatus**: `'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'`
- **SyncEngineStatus**: `'SYNCED' | 'SYNCING' | 'OFFLINE' | 'PENDING' | 'ERROR' | 'AUTH_REQUIRED'`

### Core Interfaces

#### `Lead`
- `id`: `string`
- `businessName`: `string`
- `category`: `string`
- `phone`: `string`
- `phoneRaw`: `string`
- `phoneE164`: `string`
- `phoneType`: `PhoneType`
- `alternatePhone`: `string | null`
- `contactPerson`: `string | null`
- `address`: `string`
- `locality`: `string`
- `pincode`: `string`
- `city`: `string`
- `state`: `string`
- `website`: `string | null`
- `rating`: `number | null`
- `reviewCount`: `number | null`
- `source`: `string`
- `sourceFile`: `string | null`
- `sourceRow`: `number | null`
- `status`: `LeadStatus`
- `customNotes`: `string`
- `lastContactedAt`: `string | null`
- `nextFollowUpAt`: `string | null`
- `callCount`: `number`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `syncedAt`: `string | null`
- `deletedAt`: `string | null`
- `createdBy`: `string | null | undefined`
- `assignedTo`: `string | null | undefined`
- `updatedBy`: `string | null | undefined`
- `version`: `number | undefined`

#### `User`
- `id`: `string`
- `organizationId`: `string | null | undefined`
- `name`: `string`
- `email`: `string`
- `phone`: `string`
- `role`: `UserRole`
- `status`: `UserStatus`
- `createdAt`: `string`
- `createdBy`: `string | null`
- `updatedAt`: `string`
- `lastLoginAt`: `string | null`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `CallRecord`
- `id`: `string`
- `leadId`: `string`
- `userId`: `string`
- `deviceId`: `string | null`
- `dialAttemptId`: `string | null | undefined`
- `startedAt`: `string`
- `answeredAt`: `string | null`
- `endedAt`: `string | null`
- `durationSeconds`: `number`
- `reportedDurationSeconds`: `number | null | undefined`
- `outcome`: `CallOutcome`
- `callStatus`: `CallRecordStatus | undefined`
- `remark`: `string | null`
- `verificationStatus`: `CallVerificationStatus`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `CallHistory`
- `id`: `string`
- `leadId`: `string`
- `calledNumber`: `string`
- `phoneType`: `PhoneType`
- `startedAt`: `string`
- `endedAt`: `string | null`
- `durationSeconds`: `number`
- `outcome`: `CallOutcome`
- `notes`: `string | null`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `Activity`
- `id`: `string`
- `leadId`: `string | null`
- `userId`: `string`
- `deviceId`: `string | null`
- `activityType`: `ActivityType`
- `metadata`: `Record<string, any>`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `Remark`
- `id`: `string`
- `leadId`: `string`
- `type`: `RemarkType`
- `content`: `string`
- `author`: `string`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `FollowUp`
- `id`: `string`
- `leadId`: `string`
- `userId`: `string | null | undefined`
- `scheduledAt`: `string`
- `title`: `string`
- `notes`: `string | null`
- `priority`: `FollowUpPriority`
- `status`: `FollowUpStatus`
- `completedAt`: `string | null`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `MessageHistory`
- `id`: `string`
- `leadId`: `string`
- `userId`: `string | null | undefined`
- `channel`: `MessageChannel`
- `templateId`: `string | null`
- `recipientPhone`: `string`
- `messageContent`: `string`
- `sentStatus`: `MessageStatus`
- `sentAt`: `string`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `MessageTemplate`
- `id`: `string`
- `title`: `string`
- `category`: `TemplateCategory`
- `body`: `string`
- `isDefault`: `boolean`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `ImportAudit`
- `id`: `string`
- `uploadedBy`: `string`
- `deviceId`: `string | null`
- `filename`: `string`
- `source`: `string`
- `startedAt`: `string`
- `completedAt`: `string`
- `totalRows`: `number`
- `imported`: `number`
- `updated`: `number`
- `duplicates`: `number`
- `invalid`: `number`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `version`: `number | undefined`

#### `BulkAssignmentAudit`
- `id`: `string`
- `organizationId`: `string | null | undefined`
- `performedBy`: `string`
- `targetAgentId`: `string`
- `selectedLeadCount`: `number`
- `successfulCount`: `number`
- `failedCount`: `number`
- `startedAt`: `string`
- `completedAt`: `string`
- `filterSnapshot`: `Record<string, any> | undefined`
- `status`: `'PENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'`
- `errorSummary`: `string | null | undefined`
- `createdAt`: `string`
- `updatedAt`: `string`
- `isSynced`: `number`
- `deletedAt`: `string | null`
- `version`: `number | undefined`

#### `OutboxItem` (from [`syncTypes.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncTypes.ts))
- `id`: `string`
- `organizationId`: `string | null`
- `userId`: `string`
- `deviceId`: `string | null`
- `entityType`: `SyncEntityType`
- `entityId`: `string`
- `operation`: `SyncOperation`
- `payload`: `Record<string, any>`
- `createdAt`: `string`
- `updatedAt`: `string`
- `retryCount`: `number`
- `lastAttemptAt`: `string | null`
- `lastError`: `string | null`
- `status`: `OutboxStatus`

#### `SyncState`
- `id`: `'current'`
- `deviceId`: `string`
- `organizationId`: `string | null`
- `lastSuccessfulSyncAt`: `string | null`
- `lastPullCursor`: `string | null`
- `lastPushAt`: `string | null`
- `lastPullAt`: `string | null`
- `lastSyncError`: `string | null`
- `status`: `SyncEngineStatus`

#### `SyncConflict`
- `id`: `string`
- `entityType`: `SyncEntityType`
- `entityId`: `string`
- `localData`: `Record<string, any>`
- `remoteData`: `Record<string, any>`
- `resolution`: `'LOCAL_WON' | 'REMOTE_WON' | 'MERGED'`
- `resolvedAt`: `string`

#### `SyncResult`
- `pushedCount`: `number`
- `pulledCount`: `number`
- `failedCount`: `number`
- `conflictsCount`: `number`
- `durationMs`: `number`
- `error`: `string | null | undefined`

#### `LeadFilterParams`
- `searchTerm`: `string | undefined`
- `status`: `LeadStatus | LeadStatus[] | undefined`
- `locality`: `string | string[] | undefined`
- `category`: `string | string[] | undefined`
- `hasFollowUp`: `boolean | undefined`
- `followUpDueBefore`: `string | undefined`
- `assignedTo`: `string | null | undefined`
- `createdBy`: `string | null | undefined`
- `includeDeleted`: `boolean | undefined`
- `limit`: `number | undefined`
- `offset`: `number | undefined`
- `sortBy`: `'updatedAt' | 'createdAt' | 'businessName' | 'nextFollowUpAt' | 'lastContactedAt' | undefined`
- `sortOrder`: `'asc' | 'desc' | undefined`

#### `LeadStats`
- `totalLeads`: `number`
- `activeLeads`: `number`
- `statusCounts`: `Record<LeadStatus, number>`
- `totalCallsLogged`: `number`
- `pendingFollowUpsCount`: `number`
- `todayFollowUpsCount`: `number`

## Supabase REST API

- **Base URL**: `VITE_SUPABASE_URL/rest/v1/`
- **Auth**: `apikey` header + `Authorization` bearer token
- **Tables**: `organizations`, `profiles`, `leads`, `call_records`, `activities`, `remarks`, `follow_ups`, `message_history`, `import_audits`, `bulk_assignment_audits`
- **RPC**: `current_profile_id()`

## Sync Data Flow

- **Outbox -> SyncPush**: Triggers a Supabase upsert with a `camelCase` to `snake_case` transform.
- **Supabase -> SyncPull**: Fetches remote changes into Dexie with a `snake_case` to `camelCase` transform.
- **Conflict resolution**: Last-Writer-Wins (LWW) with `VERIFIED` call protection (verified calls cannot be overwritten by unverified data).

## Realtime Events

Handled via definitions in [`realtimeTypes.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeTypes.ts).

- **Channel**: `postgres_changes` on all 8 published tables.
- **Event types**: `INSERT`, `UPDATE`, `DELETE`
- **Payload**: `RealtimePayload` containing `type`, `table`, and `record` data.

---

### Reference Files
- [types.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/types.ts)
- [syncTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/sync/syncTypes.ts)
- [realtimeTypes.ts](file:///c:/Users/PC/Desktop/calling%20app/src/services/realtime/realtimeTypes.ts)
