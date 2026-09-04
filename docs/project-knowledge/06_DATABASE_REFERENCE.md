# 06 - DATABASE REFERENCE

## PostgreSQL Tables (10 tables)

> FK delete behaviour for `leads` children (migration 7, local-only pending release):
> `call_records`, `remarks`, `follow_ups`, `message_history` → ON DELETE CASCADE;
> `activities` → ON DELETE SET NULL (audit trail preserved).

### 1. `organizations`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOW() |
| `created_by` | UUID | nullable |
| `updated_at` | TIMESTAMPTZ | NOW() |

### 2. `profiles`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `auth_user_id` | UUID | UNIQUE, REF `auth.users` ON DELETE SET NULL |
| `organization_id` | UUID | NOT NULL, REF `organizations` ON DELETE RESTRICT |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL, DEFAULT `''` |
| `role` | TEXT | NOT NULL, CHECK IN `ADMIN`/`AGENT` |
| `status` | TEXT | NOT NULL, DEFAULT `ACTIVE`, CHECK IN `ACTIVE`/`INACTIVE` |
| `created_at` | TIMESTAMPTZ |  |
| `created_by` | UUID | REF `profiles` ON DELETE SET NULL |
| `updated_at` | TIMESTAMPTZ |  |
| `last_login_at` | TIMESTAMPTZ | nullable |
| `version` | INT | DEFAULT `1` |
| `deleted_at` | TIMESTAMPTZ | nullable |

### 3. `leads`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `business_name` | TEXT | |
| `category` | TEXT | DEFAULT `'Gym'` |
| `phone` | TEXT | |
| `phone_raw` | TEXT | |
| `phone_e164` | TEXT | |
| `phone_type` | TEXT | DEFAULT `'mobile'` |
| `alternate_phone` | TEXT | |
| `contact_person` | TEXT | |
| `address` | TEXT | |
| `locality` | TEXT | |
| `pincode` | TEXT | |
| `city` | TEXT | DEFAULT `'Lucknow'` |
| `state` | TEXT | DEFAULT `'Uttar Pradesh'` |
| `website` | TEXT | |
| `rating` | NUMERIC(3,2) | |
| `review_count` | INT | |
| `source` | TEXT | DEFAULT `'Field Sales'` |
| `source_file` | TEXT | |
| `source_row` | INT | |
| `status` | TEXT | DEFAULT `'NEW'` |
| `custom_notes` | TEXT | |
| `last_contacted_at` | TIMESTAMPTZ | |
| `next_follow_up_at` | TIMESTAMPTZ | |
| `call_count` | INT | DEFAULT `0` |
| `created_by` | UUID | REF `profiles` |
| `assigned_to` | UUID | REF `profiles` |
| `updated_by` | UUID | REF `profiles` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `version` | INT | DEFAULT `1` |
| `deleted_at` | TIMESTAMPTZ | |

### 4. `call_records`

> Migration 7 (2026-08-23, local-only pending release): adds `dial_attempt_id`,
> `reported_duration_seconds`, `call_status` (CHECK-constrained), and changes the
> `lead_id` FK from RESTRICT to ON DELETE CASCADE.

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `lead_id` | UUID | REF `leads` ON DELETE CASCADE (migration 7; was RESTRICT) |
| `user_id` | UUID | REF `profiles` |
| `device_id` | TEXT | |
| `dial_attempt_id` | UUID | NULL (migration 7) |
| `started_at` | TIMESTAMPTZ | |
| `answered_at` | TIMESTAMPTZ | |
| `ended_at` | TIMESTAMPTZ | |
| `duration_seconds` | INT | DEFAULT `0` |
| `reported_duration_seconds` | INT | NULL (migration 7) — device-reported, distinct from verified duration |
| `outcome` | TEXT | |
| `call_status` | TEXT | NULL (migration 7), CHECK-constrained |
| `remark` | TEXT | |
| `verification_status` | TEXT | DEFAULT `'UNVERIFIED'`, CHECK IN `UNVERIFIED`/`VERIFIED` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `version` | INT | |
| `deleted_at` | TIMESTAMPTZ | |

### 5. `activities`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `lead_id` | UUID | REF `leads` ON DELETE SET NULL |
| `user_id` | UUID | REF `profiles` |
| `device_id` | TEXT | |
| `activity_type` | TEXT | |
| `metadata` | JSONB | DEFAULT `'{}`' |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `version` | INT | |
| `deleted_at` | TIMESTAMPTZ | |

### 6. `remarks`

> Migration 7 (local-only pending release): `lead_id` FK is ON DELETE CASCADE (was RESTRICT).

| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `lead_id` | UUID | REF `leads` ON DELETE CASCADE (migration 7; was RESTRICT) |
| `user_id` | UUID | REF `profiles` |
| `content` | TEXT | |
| `type` | TEXT | DEFAULT `'CUSTOM'` |
| `author` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

### 7. `follow_ups`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `lead_id` | UUID | |
| `user_id` | UUID | |
| `scheduled_at` | TIMESTAMPTZ | |
| `title` | TEXT | |
| `notes` | TEXT | |
| `priority` | TEXT | DEFAULT `'MEDIUM'` |
| `status` | TEXT | DEFAULT `'PENDING'` |
| `completed_at` | TIMESTAMPTZ | |
| `outcome_notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

### 8. `message_history`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `lead_id` | UUID | |
| `user_id` | UUID | |
| `template_id` | UUID | |
| `channel` | TEXT | DEFAULT `'WHATSAPP'` |
| `recipient_phone` | TEXT | |
| `message_content` | TEXT | |
| `sent_status` | TEXT | DEFAULT `'INITIATED'` |
| `sent_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

### 9. `import_audits`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `uploaded_by` | UUID | REF `profiles` |
| `device_id` | TEXT | |
| `filename` | TEXT | |
| `source` | TEXT | DEFAULT `'Excel Import'` |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `total_rows` | INT | |
| `imported` | INT | |
| `updated` | INT | |
| `duplicates` | INT | |
| `invalid` | INT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### 10. `bulk_assignment_audits`
| Column | Type | Constraints / Default |
|--------|------|-----------------------|
| `id` | UUID | PK |
| `organization_id` | UUID | |
| `performed_by` | UUID | REF `profiles` ON DELETE RESTRICT |
| `target_agent_id` | UUID | REF `profiles` ON DELETE RESTRICT |
| `selected_lead_count` | INT | |
| `successful_count` | INT | |
| `failed_count` | INT | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `filter_snapshot` | JSONB | |
| `status` | VARCHAR(30) | DEFAULT `'COMPLETED'`, CHECK IN `PENDING`/`COMPLETED`/`PARTIAL`/`FAILED` |
| `error_summary` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |
| `version` | INT | |

## Indexes

All indexes defined across the 6 migration files:

```sql
-- From 20260820000001_phase2e_central_schema.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_org_email 
ON public.profiles(organization_id, LOWER(email)) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_org_role_status ON public.profiles(organization_id, role, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_assigned_deleted ON public.leads(organization_id, assigned_to, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_status_deleted ON public.leads(organization_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_locality_deleted ON public.leads(organization_id, locality, deleted_at);
CREATE INDEX IF NOT EXISTS idx_call_records_org_lead ON public.call_records(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_call_records_org_user ON public.call_records(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_lead ON public.activities(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_user ON public.activities(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_remarks_org_lead ON public.remarks(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_org_lead_status ON public.follow_ups(organization_id, lead_id, status);
CREATE INDEX IF NOT EXISTS idx_message_history_org_lead ON public.message_history(organization_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_import_audits_org_user ON public.import_audits(organization_id, uploaded_by);

-- From 20260820000003_phase2j_call_duration_indexes.sql
CREATE INDEX IF NOT EXISTS idx_call_records_org_user_verif_started 
ON public.call_records(organization_id, user_id, verification_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_records_org_lead_started 
ON public.call_records(organization_id, lead_id, started_at DESC);

-- From 20260820000005_phase2k_bulk_assignment.sql
CREATE INDEX IF NOT EXISTS idx_bulk_assign_org_target_started 
  ON public.bulk_assignment_audits(organization_id, target_agent_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_assign_org_performed 
  ON public.bulk_assignment_audits(organization_id, performed_by, started_at DESC);
```

## Dexie IndexedDB Schema (Client-Side)

### Version 5 Store Definitions

```typescript
// Definitions from [database.ts](file:///c:/Users/PC/Desktop/calling%20app/src/db/database.ts)
this.version(5).stores({
  leads: 'id, phone, businessName, category, locality, pincode, status, createdBy, assignedTo, isSynced, deletedAt, nextFollowUpAt, lastContactedAt, createdAt, updatedAt, [status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]',
  remarks: 'id, leadId, type, createdAt, isSynced, deletedAt, [leadId+deletedAt]',
  callHistory: 'id, leadId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt]',
  followUps: 'id, leadId, scheduledAt, status, priority, isSynced, deletedAt, [status+scheduledAt], [leadId+deletedAt]',
  messageHistory: 'id, leadId, channel, sentStatus, sentAt, isSynced, deletedAt, [leadId+deletedAt]',
  messageTemplates: 'id, category, isDefault, isSynced, deletedAt, [category+deletedAt]',
  users: 'id, email, role, status, isSynced, deletedAt, [role+status], [role+deletedAt]',
  activities: 'id, leadId, userId, activityType, createdAt, isSynced, deletedAt, [leadId+deletedAt], [userId+createdAt]',
  callRecords: 'id, leadId, userId, outcome, startedAt, isSynced, deletedAt, [leadId+deletedAt], [userId+startedAt]',
  importAudits: 'id, uploadedBy, createdAt, isSynced, [uploadedBy+createdAt]',
  outbox: 'id, entityType, entityId, operation, status, retryCount, createdAt, updatedAt, [status+createdAt]',
  syncState: 'id', // row also stores and validates organizationId + userId inside the account-partitioned database
  bulkAssignmentAudits: 'id, organizationId, performedBy, targetAgentId, status, startedAt, isSynced, deletedAt, [targetAgentId+startedAt], [performedBy+startedAt]',
});
```

### Automatic Hooks
- **creating hook**: populates `createdAt`, `updatedAt`, `isSynced=0`, and `deletedAt=null`
- **updating hook**: sets `updatedAt`, `isSynced=0`

## Seed Data (`supabase/seed.sql`)

- **3 auth.users**: `admin@amaratvkrishi.com`, `rahul@amaratvkrishi.com`, `pooja@amaratvkrishi.com`
- **1 organization**: Amaratv Krishi Lucknow Central
- **3 profiles**: System Administrator (ADMIN), Rahul Verma (AGENT), Pooja Sharma (AGENT)
- **3 leads**: Gold Gym Hazratganj (assigned Rahul), FitHub Gomti Nagar (assigned Pooja), Iron Paradise Alambagh (unassigned)
