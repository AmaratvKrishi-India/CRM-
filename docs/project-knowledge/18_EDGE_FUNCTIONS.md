# 18 - SUPABASE EDGE FUNCTIONS

The project has ONE edge function for server-side agent provisioning.

## create-agent Edge Function
- **Path**: [supabase/functions/create-agent/index.ts](file:///c:/Users/PC/Desktop/calling%20app/supabase/functions/create-agent/index.ts)
- **Purpose**: Server-side agent provisioning endpoint that creates a new Supabase Auth user and corresponding profile record.
- **Triggered by**: Admin `CreateAgentModal` component via `agentManagementService`.
- **Uses**: `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to client).

### Full Function Signature and HTTP Method
- **HTTP Method**: POST (implicit from Deno standard `serve`)
- **URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/create-agent`
- **CORS Support**: Implemented via an `OPTIONS` request handler that responds with standard headers.

### Request Body Schema
The payload must be a JSON object with the following fields:
- `name` (string): Full name of the agent (Must be at least 2 characters).
- `email` (string): Valid email format.
- `phone` (string, optional): Phone number for the agent.
- `password` (string): Minimum 6 characters in length.

### Response Schema
On success, it responds with a 200 OK containing JSON:
```json
{
  "success": true,
  "message": "Agent created successfully.",
  "agent": {
    "id": "uuid",
    "authUserId": "uuid",
    "organizationId": "uuid",
    "name": "string",
    "email": "string",
    "phone": "string",
    "role": "AGENT",
    "status": "ACTIVE",
    "createdBy": "uuid",
    "createdAt": "ISO-8601 string"
  }
}
```

### Error Handling
The edge function returns specific HTTP status codes and JSON error messages:
- `500`: Server configuration error (missing environment variables) or database error during insert.
- `401`: Unauthorized (Missing Authorization header or invalid/expired session).
- `403`: Forbidden (Caller profile not found, deactivated admin, non-admin role, or no organization).
- `400`: Bad Request (Invalid name, email format, password length, or Auth failure).
- `409`: Conflict (An account with this email already exists in the organization or Supabase Auth).
- Compensation/Rollback: If the `profiles` table insertion fails, it automatically calls `supabaseAdmin.auth.admin.deleteUser(newAuthUserId)` to clean up the Auth user and rollback.

### Security: Validating the Caller
1. **Authentication**: The function extracts the caller's JWT from the `Authorization` header and verifies it via `callerClient.auth.getUser()`.
2. **Authorization (Admin Check)**: Using the `SUPABASE_SERVICE_ROLE_KEY`, the function queries the `profiles` table to fetch the caller's profile.
3. **Role Validation**: It ensures that:
   - The caller's `status` is `'ACTIVE'`.
   - The caller's `role` is `'ADMIN'`.
   - The caller belongs to a valid `organization_id`.

### What it Creates
1. **Auth User**: Creates a new user in the Supabase Auth (`auth.users`) subsystem using `supabaseAdmin.auth.admin.createUser`, marking `email_confirm: true`.
2. **Profile Record**: Inserts a new record into the `public.profiles` table with:
   - `role: 'AGENT'` (strictly forced, client input ignored)
   - `status: 'ACTIVE'`
   - `organization_id`: Inherited from the Admin caller (client input is ignored).
3. **Audit Event**: Records an `AGENT_CREATED` event in the `activities` table noting the provisioning by the admin.

### Relationship to Client Side
The edge function handles privileged actions that the client cannot perform itself. The `agentManagementService` on the client-side sends a POST request to this endpoint with the agent details. Since the client only has the anonymous key (`VITE_SUPABASE_ANON_KEY`), it passes its active JWT session token in the Authorization header. This prevents the client from needing elevated admin privileges (like `SUPABASE_SERVICE_ROLE_KEY`) while securely allowing admins to create agents within their organization.
