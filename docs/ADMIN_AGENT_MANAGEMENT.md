# Amaratv Krishi CRM — Admin Agent Management Architecture (Phase 2D)

## 1. Agent Management Architecture
The Amaratv Krishi Field Sales CRM provides an **ADMIN-only** management plane within the single unified Android application:

```
┌────────────────────────────────────────────────────────┐
│                   ONE ANDROID APK                      │
│                                                        │
│  [ADMIN User Authenticated via Supabase Auth]          │
│                       │                                │
│                       ▼                                │
│            [AdminShell Navigation]                     │
│         ┌─────────────┼─────────────┐                  │
│         ▼             ▼             ▼                  │
│     [Overview]     [Agents]     [Settings]             │
│                       │                                │
│       ┌───────────────┴───────────────┐                │
│       ▼                               ▼                │
│  [List Agents]                 [Provision Agent]       │
│  (Cards, Search, Filter)       (Name, Email, Status)   │
│       │                               │                │
│       ▼                               ▼                │
│  [AgentCard Actions]           [AgentManagementService]│
│  - Edit Profile                - Check actor is ADMIN  │
│  - Activate Account            - Prevent role change   │
│  - Deactivate Account          - Zero password storage │
│                       │                                │
│                       ▼                                │
│          [Append-Only Activity Stream]                 │
│          - AGENT_CREATED                               │
│          - AGENT_UPDATED                               │
│          - AGENT_ACTIVATED                             │
│          - AGENT_DEACTIVATED                           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Admin Permissions vs Agent Permissions

| Capability | ADMIN | AGENT | Enforcement Mechanism |
|---|:---:|:---:|---|
| Access Admin Shell & Console | YES | NO | `useAuth()` & `MainAppRouter` |
| View Sales Representatives List | YES | NO | `AgentManagementService.getAgents()` |
| Provision New Sales Agent | YES | NO | `AgentManagementService.createAgent()` |
| Edit Agent Name / Phone | YES | NO | `AgentManagementService.updateAgent()` |
| Activate / Deactivate Agent | YES | NO | `AgentManagementService.setUserStatus()` |
| Modify User Role (`AGENT` $\rightarrow$ `ADMIN`) | NO | NO | **Strictly Forbidden** (Role Immutability) |
| Change User UUID / Auth ID | NO | NO | **Strictly Forbidden** (ID Immutability) |
| Operate Leads / Make Calls / WhatsApp | YES | YES | Shared Sales CRM Mode |

---

## 3. Authentication Provisioning Architecture

To preserve security and eliminate credential leaks:

1. **No Client-Side Passwords**: Passwords and password hashes are never created, handled, or stored inside the client CRM database.
2. **Supabase Auth as Identity Authority**: When an admin provisions an agent:
   - The local application `User` profile is created with `role = 'AGENT'`, `status = 'ACTIVE'`, and `createdBy = admin.id`.
   - In cloud-connected environments, the creation triggers an invitation or user creation in Supabase Auth via a secure backend boundary (Supabase Edge Function).
   - The agent receives their login setup and authenticates using their designated email.
3. **No Automatic Account Creation**: Unknown or unprovisioned external users who attempt to log in are immediately rejected and signed out.

---

## 4. Privileged-Operation Boundary & Service-Role Key Rule

- **Strict Security Rule**: The Supabase `service_role` key is **NEVER** embedded into the Android APK, `VITE_` client variables, or local storage.
- Client-side Android applications only have access to the public `anon` key.
- Calling privileged Supabase Admin Auth APIs (such as `supabase.auth.admin.createUser`) directly from a mobile APK is architecturally prohibited.
- When central cloud synchronization is enabled in later milestones, privileged operations are executed via serverless Supabase Edge Functions with JWT bearer verification.

---

## 5. Offline Behaviour & State Integrity

- **Offline Viewing**: An administrator who is already authenticated can view cached sales agent profiles from local IndexedDB storage.
- **Offline Guardrail**: If the administrator is offline, the client does not fake remote cloud provisioning.
- **Deactivation While Offline**: Local status updates are queued for synchronization (`isSynced = 0`) and recorded in the append-only activity log.
- **Data Preservation**: Deactivating an agent never deletes any historical leads, calls, remarks, or follow-ups created by that representative.

---

## 6. Immutable Audit Activity Model

Every administrative operation produces an append-only `Activity` record:

```typescript
export type ActivityType =
  | 'AGENT_CREATED'
  | 'AGENT_UPDATED'
  | 'AGENT_ACTIVATED'
  | 'AGENT_DEACTIVATED';
```

- **Actor Attribution**: The `userId` on the audit log is strictly derived from `currentUser.id` (the authenticated administrator).
- **Device Attribution**: The `deviceId` is captured via `DeviceService.getDeviceId()`.
- **Event Metadata**: Captures target agent ID, target email, and changes made.
- **Append-Only**: Historical audit events cannot be deleted or overwritten.

---

## 7. Free-Tier & Cost Considerations

- Fully compatible with the **Supabase Free Tier**.
- No paid identity providers, SMS gateways, or VPS servers are introduced.
- Standard email + password authentication is used exclusively.

---

## 8. Future PostgreSQL Row Level Security (RLS) Requirements

In Milestone 6 (Central Data Model & PostgreSQL Sync):
- `users` table RLS policies:
  - `SELECT`: Allowed if `auth.uid() = id` OR `auth.jwt() ->> 'role' = 'ADMIN'`.
  - `INSERT` / `UPDATE`: Allowed only if `auth.jwt() ->> 'role' = 'ADMIN'`.
  - `DELETE`: Prohibited (soft deletion only via `deletedAt`).

---

## 9. Current Status & Known Limitations

- **Admin Agent Screen**: `IMPLEMENTED & VERIFIED`
- **Agent Local Creation & Validation**: `IMPLEMENTED & VERIFIED`
- **Agent Activation & Deactivation**: `IMPLEMENTED & VERIFIED`
- **Role Protection & Immutability**: `IMPLEMENTED & VERIFIED`
- **Immutable Audit Logging**: `IMPLEMENTED & VERIFIED`
- **Direct Edge Function Cloud Provisioning**: `ARCHITECTURE PREPARED` (Will be wired when Supabase backend is provisioned in Central Sync milestone).
