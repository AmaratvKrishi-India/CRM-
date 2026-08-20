# Amaratv Krishi CRM — Secure Admin-Controlled Agent Provisioning (Phase 2H)

## 1. Architecture Overview
Agent provisioning enforces strict administrative access control, zero client-side credential persistence, and server-side privileged user creation via a Supabase Edge Function.

```text
       ┌─────────────────────────────────────────────────────────────┐
       │             ADMIN DEVICE (AUTHENTICATED AS ADMIN)           │
       │                                                             │
       │   [Admin Agents Screen] ──► [Create Agent Modal]            │
       │                                   │                         │
       │                                   │ (Name, Email, Phone,    │
       │                                   │  Initial Password)      │
       │                                   ▼                         │
       │                     [AgentManagementService]                │
       │                                   │                         │
       │                                   │ (Bearer Admin JWT)      │
       └───────────────────────────────────┼─────────────────────────┘
                                           │
                                           ▼ HTTPS
       ┌─────────────────────────────────────────────────────────────┐
       │            SUPABASE EDGE FUNCTION (create-agent)            │
       │                                                             │
       │   1. Authenticates Caller via JWT                           │
       │   2. Verifies Caller Profile: role='ADMIN' & status='ACTIVE'│
       │   3. Extracts caller's organization_id                      │
       │   4. Calls Supabase Auth Admin API (SERVICE ROLE KEY)       │
       │      ──► Creates auth.users Record                          │
       │   5. Inserts into public.profiles:                          │
       │      ──► role = 'AGENT' (Strictly Forced)                   │
       │      ──► organization_id = Admin's organization_id          │
       │      ──► created_by = Admin Profile ID                      │
       │   6. Compensation / Rollback:                               │
       │      If profile creation fails, deletes created auth user   │
       │   7. Inserts Immutable Activity: AGENT_CREATED              │
       │   8. Returns Sanitized Agent Data (Zero Passwords Returned) │
       └─────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
       ┌─────────────────────────────────────────────────────────────┐
       │               AGENT LOGS INTO THE SAME ANDROID APK          │
       │                                                             │
       │   [Login Screen] ──► [Email + Initial Password]             │
       │   - Supabase Auth verifies credentials                      │
       │   - Profile resolved: role='AGENT', status='ACTIVE'         │
       │   - Opens Field Sales CRM Mode                              │
       └─────────────────────────────────────────────────────────────┘
```

---

## 2. Secrets Boundary & Security Invariants

| Invariant | Implementation |
|---|---|
| **Zero Service-Role Key in Client** | Service-role key exists **only** in the Deno Edge Function execution runtime (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`). Client bundle contains only public anon key. |
| **No Public Registration** | Public registration is disabled; only active administrators can invoke `create-agent`. |
| **Zero Local Password Persistence** | Passwords are never stored in Dexie, localStorage, memory caches, activity metadata, or backup files. |
| **Role Immutability** | Created profiles are strictly forced to `role = 'AGENT'`. No client parameter can override this. |
| **Organization Isolation** | New agents inherit the authenticated Admin's `organization_id`. Any client-provided organization ID is rejected/ignored. |
| **Orphan Rollback Compensation** | If Supabase Auth account creation succeeds but `public.profiles` insertion fails, the Edge Function deletes the Auth user immediately. |

---

## 3. Edge Function Specification

- **Name**: `create-agent`
- **Location**: [`supabase/functions/create-agent/index.ts`](file:///c:/Users/PC/Desktop/calling%20app/supabase/functions/create-agent/index.ts)
- **Runtime**: Supabase Edge Functions (Deno)
- **Deployment Command**:
  ```bash
  npx supabase functions deploy create-agent --project-ref lahvcodvgubplzfshare
  ```

---

## 4. Edge Function Verification Matrix

| Security Rule | Enforcement Mechanism |
|---|---|
| Unauthenticated Call | Rejected with `401 Unauthorized`. |
| Non-Admin Caller | Rejected with `403 Forbidden`. |
| Inactive Admin Caller | Rejected with `403 Forbidden`. |
| Invalid Name / Email | Rejected with `400 Bad Request`. |
| Password < 6 chars | Rejected with `400 Bad Request`. |
| Duplicate Email | Rejected with `409 Conflict` ("An account with this email already exists."). |
| Role Escalation | Ignored; role hardcoded to `AGENT`. |
| Audit Logging | Appends `AGENT_CREATED` event to `public.activities` with actor ID and metadata (no passwords). |

---

## 5. Client Integration

- **UI Component**: [`src/components/admin/CreateAgentModal.tsx`](file:///c:/Users/PC/Desktop/calling%20app/src/components/admin/CreateAgentModal.tsx)
  - Fields: Full Name, Email, Phone, Initial Password, Confirm Password, Status.
  - Clear passwords from component state immediately after submission.
- **Service**: [`src/services/agentManagementService.ts`](file:///c:/Users/PC/Desktop/calling%20app/src/services/agentManagementService.ts)
  - Invokes `supabase.functions.invoke('create-agent', { body })`.
  - Creates local Dexie mirror record for offline speed without saving passwords.
