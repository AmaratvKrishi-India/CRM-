# 14 - DATABASE RELATIONSHIPS

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `supabase/migrations/`, `src/db/types.ts`, `src/db/database.ts`
- **SCOPE:** Entity relationship diagram and foreign key relationships
- **RELATED_DOCUMENTS:** 13_DATABASE_SCHEMA.md, 15_MIGRATIONS.md, 16_RLS_SECURITY.md

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│  organizations  │       │    profiles     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ organization_id │
│ name            │       │ id (PK)         │
│ created_at      │       │ auth_user_id    │
│ created_by      │       │ role            │
│ updated_at      │       │ status          │
└─────────────────┘       └────────┬────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     leads       │       │  call_records   │       │   activities    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ organization_id │       │ organization_id │       │ organization_id │
│ created_by ─────┼───────►│ user_id ────────┼───────►│ user_id ────────┤
│ assigned_to ────┼───────►│ lead_id ────────┼───────►│ lead_id (NULL)  │
│ ...             │       │ ...             │       │ activity_type   │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │         ┌───────────────┼───────────────┐         │
         │         │               │               │         │
         ▼         ▼               ▼               ▼         ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   remarks       │ │  follow_ups     │ │ message_history │ │import_audits    │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ id (PK)         │ │ id (PK)         │ │ id (PK)         │ │ id (PK)         │
│ organization_id │ │ organization_id │ │ organization_id │ │ organization_id │
│ lead_id ────────┤ │ lead_id ────────┤ │ lead_id ────────┤ │ uploaded_by ────┤
│ user_id ────────►│ user_id ─────────►│ user_id ────────►│ ...             │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────────────┐
│ bulk_assignment_audits  │
├─────────────────────────┤
│ id (PK)                 │
│ organization_id         │
│ performed_by ───────────┤
│ target_agent_id ────────┤
└─────────────────────────┘
```

---

## Relationship Details

### 1. organizations ↔ profiles (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `profiles.organization_id` → `organizations.id` |
| **On Delete** | `RESTRICT` (cannot delete org with users) |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 organization : N profiles |
| **RLS** | Users see only own org profiles |

### 2. profiles ↔ leads (Created By) (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `leads.created_by` → `profiles.id` |
| **On Delete** | `SET NULL` (lead remains, creator reference cleared) |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 profile : N created leads |
| **RLS** | Agent sees leads they created |

### 3. profiles ↔ leads (Assigned To) (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `leads.assigned_to` → `profiles.id` |
| **On Delete** | `SET NULL` (lead becomes unassigned) |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 profile : N assigned leads |
| **RLS** | **Agent isolation** - agent sees only assigned_to=self |

### 4. profiles ↔ leads (Updated By) (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `leads.updated_by` → `profiles.id` |
| **On Delete** | `SET NULL` |
| **On Update** | `CASCADE` |

### 5. leads ↔ call_records (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `call_records.lead_id` → `leads.id` |
| **On Delete** | `CASCADE` (Migration 7 - was RESTRICT) |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 lead : N call records |
| **RLS** | Agent sees call_records for assigned leads |

### 6. profiles ↔ call_records (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `call_records.user_id` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 profile : N call records |

### 7. leads ↔ activities (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `activities.lead_id` → `leads.id` |
| **On Delete** | `SET NULL` (audit trail preserved) |
| **On Update** | `CASCADE` |
| **Cardinality** | 1 lead : N activities |
| **Note** | `lead_id` nullable for admin/system events |

### 8. profiles ↔ activities (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `activities.user_id` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

### 9. leads ↔ remarks (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `remarks.lead_id` → `leads.id` |
| **On Delete** | `CASCADE` (Migration 7) |
| **On Update** | `CASCADE` |

### 10. profiles ↔ remarks (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `remarks.user_id` → `profiles.id` (via `author` text field) |
| **Note** | `author` is text, not FK - legacy design |

### 11. leads ↔ follow_ups (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `follow_ups.lead_id` → `leads.id` |
| **On Delete** | `CASCADE` (Migration 7) |
| **On Update** | `CASCADE` |

### 12. profiles ↔ follow_ups (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `follow_ups.user_id` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

### 13. leads ↔ message_history (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `message_history.lead_id` → `leads.id` |
| **On Delete** | `CASCADE` (Migration 7) |
| **On Update** | `CASCADE` |

### 14. profiles ↔ message_history (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `message_history.user_id` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

### 15. profiles ↔ import_audits (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `import_audits.uploaded_by` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

### 16. profiles ↔ bulk_assignment_audits (Performed By) (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `bulk_assignment_audits.performed_by` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

### 17. profiles ↔ bulk_assignment_audits (Target Agent) (1:N)
| Aspect | Detail |
|--------|--------|
| **FK** | `bulk_assignment_audits.target_agent_id` → `profiles.id` |
| **On Delete** | `RESTRICT` |
| **On Update** | `CASCADE` |

---

## Ownership Hierarchy

```
Organization (Root)
├── Profiles (Users)
│   ├── Created Leads
│   ├── Assigned Leads
│   ├── Call Records (as user)
│   ├── Activities (as actor)
│   ├── Remarks (as author)
│   ├── Follow-ups (as scheduler)
│   ├── Message History (as sender)
│   ├── Import Audits (as uploader)
│   └── Bulk Assignment Audits (performer/target)
└── Leads
    ├── Call Records
    ├── Activities (nullable)
    ├── Remarks
    ├── Follow-ups
    └── Message History
```

---

## Cascade Behavior Summary

| Parent Table | Child Table | On Delete | On Update | Rationale |
|--------------|-------------|-----------|-----------|-----------|
| organizations | profiles | RESTRICT | CASCADE | Prevent orphan users |
| profiles | leads (created_by) | SET NULL | CASCADE | Preserve lead |
| profiles | leads (assigned_to) | SET NULL | CASCADE | Unassign, don't delete |
| profiles | leads (updated_by) | SET NULL | CASCADE | Preserve lead |
| leads | call_records | **CASCADE** (M7) | CASCADE | Cloud hard-delete |
| leads | remarks | **CASCADE** (M7) | CASCADE | Cloud hard-delete |
| leads | follow_ups | **CASCADE** (M7) | CASCADE | Cloud hard-delete |
| leads | message_history | **CASCADE** (M7) | CASCADE | Cloud hard-delete |
| leads | activities | SET NULL | CASCADE | Preserve audit trail |
| profiles | call_records | RESTRICT | CASCADE | Preserve call record |
| profiles | activities | RESTRICT | CASCADE | Preserve activity |
| profiles | remarks | RESTRICT* | CASCADE | Text author field |
| profiles | follow_ups | RESTRICT | CASCADE | Preserve follow-up |
| profiles | message_history | RESTRICT | CASCADE | Preserve message |
| profiles | import_audits | RESTRICT | CASCADE | Preserve audit |
| profiles | bulk_assignment_audits (performed) | RESTRICT | CASCADE | Preserve audit |
| profiles | bulk_assignment_audits (target) | RESTRICT | CASCADE | Preserve audit |

* `remarks.author` is text, not FK

---

## Organization Boundaries

### Hard Isolation (Database-Enforced)
- **Zero cross-org visibility:** RLS policies filter by `current_user_org_id()`
- **All 10 tables** have `organization_id` column
- **All queries** implicitly scoped to user's organization
- **No shared data** between organizations

### Agent Lead Isolation (Migration 6)
```
ADMIN: Sees ALL leads in organization
AGENT: Sees ONLY leads WHERE
  assigned_to = current_profile_id() OR
  created_by = current_profile_id()
```

### Audit Tables (Admin-Only)
| Table | Visibility |
|-------|------------|
| `import_audits` | ADMIN only |
| `bulk_assignment_audits` | ADMIN only |

---

## Soft Delete Pattern

### All Entity Tables Have:
```sql
deleted_at TIMESTAMPTZ NULL DEFAULT NULL
```

### Behavior
| Operation | Implementation |
|-----------|----------------|
| **Delete** | `UPDATE SET deleted_at = NOW()` (not DELETE) |
| **Query** | `WHERE deleted_at IS NULL` (default) |
| **Sync** | `deleted_at` synced to propagate deletion |
| **Restore** | `UPDATE SET deleted_at = NULL` |
| **Index** | Compound indexes include `deleted_at` |

### Tables with Soft Delete
All 10 application tables + `outbox` + `sync_state` (Dexie)

---

## Versioning (Optimistic Concurrency)

### Tables with `version` Column
| Table | Purpose |
|-------|---------|
| `profiles` | Prevent concurrent profile updates |
| `leads` | Prevent concurrent lead edits |
| `call_records` | Prevent concurrent call updates |
| `activities` | Prevent concurrent activity writes |
| `bulk_assignment_audits` | Prevent concurrent audit updates |

### Implementation
```sql
-- On UPDATE:
UPDATE table SET ..., version = version + 1
WHERE id = $1 AND version = $2  -- Fails if version changed
```

---

## Dexie IndexedDB Relationships (Client-Side)

### Store Definitions (Version 5)
```typescript
// Key relationships maintained in indexes
leads: '... [assignedTo+deletedAt], [createdBy+deletedAt] ...'
callRecords: '... [leadId+deletedAt], [userId+startedAt] ...'
activities: '... [leadId+deletedAt], [userId+createdAt] ...'
remarks: '... [leadId+deletedAt] ...'
followUps: '... [leadId+deletedAt], [status+scheduledAt] ...'
messageHistory: '... [leadId+deletedAt] ...'
```

### Client-Side FK Enforcement
- **No hard FKs** in IndexedDB (Dexie limitation)
- **Logical relationships** via `leadId`, `userId` fields
- **Sync** validates FKs on cloud (PostgreSQL FKs)
- **Orphan handling:** Pull sync reconciles, push sync validates

---

## Sync Payload Relationships

### Push Order (Dependency-Aware)
```
1. profiles (no deps)
2. leads (depends on profiles for created_by/assigned_to)
3. call_records (depends on leads, profiles)
4. activities (depends on leads, profiles)
5. remarks (depends on leads, profiles)
6. follow_ups (depends on leads, profiles)
7. message_history (depends on leads, profiles)
8. import_audits (depends on profiles)
9. bulk_assignment_audits (depends on profiles)
```

### Pull Order (Same)
- Cursor-based incremental pull per table
- `updated_at > lastPullCursor` per table
- Parent tables pulled before children (implicit via cursor)

---

## Migration Impact on Relationships

| Migration | Relationship Change |
|-----------|---------------------|
| 1 | Created all base tables + FKs |
| 2 | Added RLS policies (no FK changes) |
| 3 | Added call analytics indexes |
| 4 | Added Realtime publication |
| 5 | Added `bulk_assignment_audits` + FKs |
| 6 | **Agent Lead Isolation** - RLS policies changed, `current_profile_id()` |
| 7 | **FK Changes:** call_records/remarks/follow_ups/message_history `lead_id` RESTRICT → CASCADE; activities stays SET NULL; `leads_delete_policy` |

---

## Query Patterns for Relationships

### Common Joins (via Supabase/PostgREST)
```typescript
// Lead with assigned agent
supabase.from('leads')
  .select(`
    *,
    assigned_agent:profiles!assigned_to (id, name, email),
    created_by_agent:profiles!created_by (id, name)
  `)

// Call record with lead + user
supabase.from('call_records')
  .select(`
    *,
    lead:leads (business_name, status),
    user:profiles (name, role)
  `)

// Activity with lead + actor
supabase.from('activities')
  .select(`
    *,
    lead:leads (business_name),
    actor:profiles (name, role)
  `)
```

### Local Queries (Dexie)
```typescript
// Lead with call records
const lead = await db.leads.get(id);
const calls = await db.callRecords.where('leadId').equals(id).toArray();

// User's assigned leads
const leads = await db.leads.where('assignedTo').equals(userId).toArray();
```

---

## Data Integrity Rules

### Enforced by Database
1. **FK Constraints** - All relationships have FKs
2. **RLS Policies** - Org/agent isolation
3. **Immutability Triggers** - `protect_profile_immutable_fields()`, `protect_lead_immutable_fields()`
4. **Check Constraints** - `role IN ('ADMIN','AGENT')`, `status IN ('ACTIVE','INACTIVE')`, etc.
5. **Unique Constraints** - `profiles.auth_user_id`, `profiles.organization_id + email`

### Enforced by Application
1. **Atomic Write + Outbox** - Dexie transaction (BUG-4 fix)
2. **Idempotency Keys** - `dialAttemptId` for call records
3. **Version Checking** - Optimistic concurrency on updates
4. **Sync Conflict Resolution** - 4 rules (LWW, VERIFIED wins, etc.)

---

## Known Relationship Issues

| Issue | Severity | Status |
|-------|----------|--------|
| `remarks.author` is text, not FK to profiles | LOW | Accepted (legacy) |
| No FK from `message_history.template_id` to `message_templates` | LOW | Template optional |
| `activities.lead_id` nullable for admin events - no FK to admin table | LOW | By design |
| `import_audits.source_file` not linked to storage bucket | LOW | No storage used |