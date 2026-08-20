# Amaratv Krishi CRM — Central Database & Row Level Security Architecture (Phase 2E)

## 1. Central Schema Overview
The central database is hosted on **Supabase PostgreSQL** and serves as the single source of truth for synchronization across all authorized Android client devices while preserving complete **offline-first local autonomy** via Dexie IndexedDB.

```text
                                  SUPABASE CLOUD
                             [auth.users (Supabase Auth)]
                                          │
                                          ▼
                             [public.organizations]
                                          │
                                          ▼
                               [public.profiles]
                                          │
       ┌──────────────────┬───────────────┴──────────────┬──────────────────┐
       ▼                  ▼                              ▼                  ▼
 [public.leads] ──► [public.remarks]          [public.follow_ups] ──► [public.message_history]
       │                  │                              │
       ├──────────────────┴───────────────┬──────────────┘
       ▼                                  ▼
[public.call_records]             [public.activities] (Append-Only)
       │
       ▼
[public.import_audits]
```

---

## 2. Table Relationships & Multi-Tenant Model

| Central Table | Primary Key | Parent Foreign Keys | Description |
|---|---|---|---|
| `organizations` | `id` (UUID) | - | Tenant boundary (Amaratv Krishi Org) |
| `profiles` | `id` (UUID) | `organization_id`, `auth_user_id` | User profile linked to Auth |
| `leads` | `id` (UUID) | `organization_id`, `created_by`, `assigned_to` | Shared gym & wellness leads |
| `call_records` | `id` (UUID) | `organization_id`, `lead_id`, `user_id` | Call logs & verified durations |
| `activities` | `id` (UUID) | `organization_id`, `lead_id`, `user_id` | Append-only event audit trail |
| `remarks` | `id` (UUID) | `organization_id`, `lead_id`, `user_id` | Field sales remarks & notes |
| `follow_ups` | `id` (UUID) | `organization_id`, `lead_id`, `user_id` | Scheduled sales reminders |
| `message_history` | `id` (UUID) | `organization_id`, `lead_id`, `user_id` | WhatsApp pitch logs |
| `import_audits` | `id` (UUID) | `organization_id`, `uploaded_by` | Excel/CSV batch import logs |

---

## 3. Organization Boundary (`organizations`)
- Every record across all child tables is constrained by `organization_id UUID NOT NULL REFERENCES public.organizations(id)`.
- Prevents cross-company data leakage and establishes a strict multi-tenant boundary.

---

## 4. User Profile Model (`profiles`)
- Linked 1-to-1 with Supabase Auth via `auth_user_id UUID UNIQUE REFERENCES auth.users(id)`.
- Stores `name`, `email`, `phone`, `role` (`ADMIN` | `AGENT`), and `status` (`ACTIVE` | `INACTIVE`).
- **No Password Storage**: Passwords remain exclusively managed within Supabase Auth.

---

## 5. Role Security & Immutability Model
- Only two roles exist: `ADMIN` and `AGENT`.
- A database trigger (`protect_profile_immutable_fields`) strictly rejects any attempt by non-admins to modify `role`, `organization_id`, `status`, or `auth_user_id`.

---

## 6. Lead Model (`leads`)
- Compatible with local Dexie `Lead` entity.
- Supports ownership attribution (`createdBy`, `assignedTo`, `updatedBy`).
- All 141 pre-bundled Lucknow leads map 1-to-1 with this schema without column loss.

---

## 7. Call Records Model (`call_records`)
- Supports `verification_status` (`UNVERIFIED` vs `VERIFIED`).
- `duration_seconds INT NOT NULL DEFAULT 0`.
- Duration fabrication is strictly prevented.

---

## 8. Append-Only Activities Model (`activities`)
- Captures sales milestones (`LEAD_CREATED`, `CALL_COMPLETED`, `AGENT_CREATED`, etc.).
- **Security Rule**: RLS allows `SELECT` and `INSERT`. `UPDATE` and `DELETE` policies are intentionally omitted to guarantee an immutable audit log.

---

## 9. Remarks & Follow-Ups Models (`remarks`, `follow_ups`)
- Link to parent `lead_id` and acting `user_id`.
- `follow_ups` include `scheduled_at`, `priority`, and `status` (`PENDING` | `COMPLETED` | `CANCELLED`).

---

## 10. Message History (`message_history`)
- Tracks outbound WhatsApp messages, template IDs, recipient phones, and timestamps.

---

## 11. Import Audit (`import_audits`)
- Audits batch Excel lead imports with row metrics (`total_rows`, `imported`, `duplicates`, `invalid`).

---

## 12. Indexing Strategy
- Multi-column composite indexes on `(organization_id, role, status)`, `(organization_id, assigned_to, deleted_at)`, and `(organization_id, lead_id)` ensure high query performance.

---

## 13. Foreign Key Integrity & Non-Destructive Deletions
- Foreign keys use `ON DELETE RESTRICT` for primary entity hierarchies and `ON DELETE SET NULL` for user attributions.
- **Strict Rule**: No `ON DELETE CASCADE` is used. Deactivating a user never deletes historical leads or calls.

---

## 14. Row Level Security (RLS) Policies
- All 9 CRM tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
- Safe STABLE helper functions prevent recursion:
  - `current_user_org_id()`
  - `current_user_role()`
  - `is_org_admin()`
  - `is_active_org_user()`
- Organization isolation: all policies verify `organization_id = current_user_org_id()`.

---

## 15. Local vs Central Responsibility
- **Local Dexie**: Serves all UI reads, writes, and real-time offline sales operations with zero latency.
- **Central PostgreSQL**: Serves as the authoritative backup, multi-device sync hub, and team aggregation store.

---

## 16. Local ↔ Central ID Alignment Strategy
- Both Local Dexie and Central PostgreSQL use identical **UUID v4** primary keys.
- A lead created locally preserves its ID when synced to the central database, eliminating dual-ID translation layers.

---

## 17. Migration Strategy
- Migrations are versioned SQL scripts in `supabase/migrations/`:
  - `20260820000001_phase2e_central_schema.sql`
  - `20260820000002_phase2e_rls_policies.sql`
- Zero automatic data uploads occur during migration creation.

---

## 18. Security Guardrails
- Public CRM table access is completely blocked.
- Service-role key is never included in the Android application bundle.
- Frontend role tampering cannot bypass PostgreSQL RLS.

---

## 19. Free-Tier Cost Guardrails
- Standard Supabase free tier (PostgreSQL + Auth) accommodates the initial Lucknow sales deployment.
- No external paid APIs or custom VPS servers.

---

## 20. Future Sync Requirements (Phase 2F/2G Preview)
- Bidirectional delta sync worker using `updated_at` and `version` timestamps with Last-Write-Wins (LWW) resolution.

---

## 21. Known Limitations
- Real RLS enforcement occurs once the Supabase project is provisioned in the cloud; local database remains autonomous.
