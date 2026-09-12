# 18 — Supabase Edge Functions

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** `supabase/functions/create-agent/index.ts`, `src/services/agentManagementService.ts`, Migration 9, and focused tests

The project currently has one Edge Function: `create-agent`. It is the privileged boundary for provisioning a Supabase Auth user plus the matching CRM profile without exposing service-role credentials to the client.

## Endpoint

- Path: `supabase/functions/create-agent/index.ts`
- Route: `https://<PROJECT_REF>.supabase.co/functions/v1/create-agent`
- Allowed application method: `POST`
- `OPTIONS`: CORS preflight returns `200`
- Other methods: `405 Method Not Allowed`
- Caller authentication: bearer session in `Authorization`

## Required request body

```json
{
  "name": "Agent Name",
  "email": "agent@example.com",
  "phone": "+91...",
  "password": "temporary-password",
  "idempotencyKey": "uuid"
}
```

`name` must be at least 2 characters, `email` must pass the function's email-format check, `password` must be at least 6 characters, `phone` is optional, and **`idempotencyKey` is required and must be a UUID**.
## Authorization and scope

The function:

1. verifies the incoming session with the anon/public client;
2. fetches the caller profile with the server-only service-role client;
3. requires an ACTIVE `ADMIN` profile with a valid `organization_id`;
4. inherits that organization server-side and ignores any attempt to choose another organization;
5. forces the new account role to `AGENT` and initial status to `ACTIVE`.

`SUPABASE_SERVICE_ROLE_KEY` is read only inside the Edge Function environment. It must never be present in Vite/client environment files or client bundles.

## Durable idempotency and abuse controls

Migration 9 adds `profiles.provisioning_key` plus server-side provisioning policy/rate-limit state. Before creating anything, the function checks whether the same organization already has a profile for the supplied idempotency key.

- Same key + same non-secret identity fields: return the existing agent with `replayed: true`.
- Same key + different identity fields: `409`.
- Existing AGENT with the same email in the organization: return it as a replayed success.
- Existing non-agent/profile or conflicting Auth identity: `409`.
- `reserve_agent_provisioning` serializes capacity/rate decisions per organization/admin; denied requests return `429` with `Retry-After`.

Passwords are deliberately never persisted for idempotency comparison.
## Success response

A successful response is sanitized and contains the agent profile, including `id`, `authUserId`, `organizationId`, `name`, `email`, `phone`, `role`, `status`, `createdBy`, `createdAt`, `updatedAt`, and `serverRevision` when available. Replayed successes also include `replayed: true`.

No password or server secret is returned.

## Error status summary

- `400` — invalid JSON/body fields or non-conflict Auth creation failure.
- `401` — missing, invalid, or expired caller authentication.
- `403` — caller profile missing/not allowed, inactive, non-admin, or without organization scope.
- `405` — non-POST/non-OPTIONS request.
- `409` — idempotency key reused for different data or conflicting account identity.
- `429` — provisioning policy/rate limit denied; includes `Retry-After`.
- `500` — server configuration/database/compensation failure or an unsafe ambiguous audit outcome requiring reconciliation.
- `503` — temporary failure while checking idempotency/provisioning reservation.

## Compensation and audit behavior

After Auth creation, the function inserts the CRM profile and an `AGENT_CREATED` activity. If profile insertion fails it attempts to remove both partial profile state and the new Auth user. If audit insertion fails, it first resolves whether the audit row may actually have committed before deciding whether compensation is safe. Ambiguous post-audit state is retained for manual reconciliation instead of deleting an agent that may already have a durable audit event.

## Client relationship

`AgentManagementService.createAgent` is online-only. It supplies a fresh UUID idempotency key, validates the returned organization/role/email/status, caches the server-created profile locally only after success, and records a local append-only audit entry without storing the password.
