# Amaratv Krishi CRM — Authentication & Session Architecture (Phase 2C)

## 1. Supabase Auth Architecture
The Amaratv Krishi Field Sales CRM employs **Supabase Auth** strictly as an external identity provider to verify credentials without taking on password management, encryption, or security vulnerabilities in the mobile application.

```
┌────────────────────────────────────────────────────────┐
│                   ONE ANDROID APK                      │
│                                                        │
│  [LoginScreen] ──(email + password)──> [AuthService]   │
│                                              │         │
│                                              ▼         │
├─────────────────────────────────────── [SupabaseClient]│
│                                              │         │
│                 INTERNET BOUNDARY            │         │
│                                              ▼         │
│                                    [Supabase Auth Cloud]
│                                              │ (Verify credentials)
│                                              ▼         │
│  [Local User Profile in Dexie] <── (JWT Session Token) │
│  (Validate status: ACTIVE & Role)                      │
│                                                        │
│         ┌───────────────────┴───────────────────┐      │
│         ▼                                       ▼      │
│   [ADMIN Shell]                           [AGENT Shell]│
│  (Admin Console)                        (Field Sales)  │
└────────────────────────────────────────────────────────┘
```

- **Authentication (Auth)**: Supabase Auth verifies *who the user is* and issues a signed JWT session.
- **Authorization (Roles)**: The CRM database (`User` profile) determines *what the user is permitted to do* (`ADMIN` vs `AGENT`).
- **No Passwords in Client DB**: Passwords are never stored in Dexie, IndexedDB, localStorage, or state stores.

---

## 2. Client Authentication Flow

1. **User submits Login form**: Enters Email and Password on [`LoginScreen`](file:///c:/Users/PC/Desktop/calling%20app/src/components/auth/LoginScreen.tsx).
2. **AuthService Delegation**: [`AuthService.signIn(email, password)`](file:///c:/Users/PC/Desktop/calling%20app/src/services/authService.ts) passes sanitized credentials to `supabase.auth.signInWithPassword`.
3. **Session Receipt**: Supabase Auth returns a valid `Session` containing `access_token`, `refresh_token`, and `user.id`.
4. **Profile Resolution**: `AuthService.resolveUserProfile(authUser)` queries the local/central `UserRepository` by matching `auth.user.id` or `auth.user.email`.
5. **Provisioning & Status Validation**:
   - If profile does **not exist**: Sign out immediately and abort with `"Your account has not been provisioned by an administrator."`
   - If profile `status !== 'ACTIVE'`: Sign out immediately and abort with `"Your account is inactive. Please contact your administrator."`
6. **Session Commitment**: Updates `lastLoginAt` timestamp on the profile and commits the active session into `AuthContext`.
7. **Role Routing**: The application shell loads based on `currentUser.role`:
   - `ADMIN` $\rightarrow$ `AdminShellPlaceholder` (with capability to operate leads directly).
   - `AGENT` $\rightarrow$ Phase 1 `SalesAppContent` (Dashboard, Leads, Calls, WhatsApp, Follow-ups).

---

## 3. Session Lifecycle

```
[App Cold Start]
       │
       ▼
[AuthContext.initAuth()]
       │
       ├─► Supabase Config Missing? ──► [Show Config Alert on LoginScreen]
       │
       ▼
[AuthService.getCurrentSession()]
       │
       ├─► No Session? ───────────────► [Render LoginScreen]
       │
       ▼ (Session Exists)
[AuthService.resolveUserProfile()]
       │
       ├─► Unprovisioned or Inactive? ► [Sign Out & Render LoginScreen]
       │
       ▼ (Valid & Active)
[AuthContext.setCurrentUser(user)]
       │
       ▼
[Render ADMIN or AGENT Shell]
```

- **Persistence**: Supabase client automatically persists the refresh token in local storage (`amaratv_crm_supabase_auth_session`).
- **Token Refresh**: Active tokens are automatically refreshed in the background by the Supabase JS SDK when connected to the internet.
- **Explicit Sign Out**: `AuthService.signOut()` clears the remote and local session tokens, resets in-memory React state, and returns the user to `LoginScreen`.

---

## 4. User Profile Mapping

| Supabase Auth Field | CRM `User` Profile Field | Storage Location | Notes |
|---|---|---|---|
| `auth.users.id` | `User.id` (UUID v4) | Supabase Auth & Dexie `users` | Primary cross-reference key |
| `auth.users.email` | `User.email` (string) | Supabase Auth & Dexie `users` | Unique login identifier |
| - | `User.name` (string) | Dexie `users` (and central DB) | Sales rep display name |
| - | `User.phone` (string) | Dexie `users` (and central DB) | Representative contact number |
| - | `User.role` (`ADMIN` \| `AGENT`) | Dexie `users` (and central DB) | Determines UI capabilities |
| - | `User.status` (`ACTIVE` \| `INACTIVE`) | Dexie `users` (and central DB) | Account activation gatekeeper |
| - | `User.createdBy` (UUID \| null) | Dexie `users` (and central DB) | Admin provisioning audit |
| `auth.users.last_sign_in_at` | `User.lastLoginAt` (ISO 8601) | Supabase Auth & Dexie `users` | Timestamp of last session |

---

## 5. ADMIN vs AGENT Role Resolution

- The application is a **single unified APK**.
- Role resolution is performed dynamically based on the verified `currentUser.role`:
  - **ADMIN**:
    - Directed to the administrative shell.
    - Can provision/manage agents (Phase 2D).
    - Can monitor team activities and call metrics (Phase 2K/2L).
    - Can switch into Field Sales Rep mode to directly call, WhatsApp, and manage leads.
  - **AGENT**:
    - Directed directly to the high-performance Field Sales CRM.
    - Restricted from administrative views, user creation, and team reassignments.

---

## 6. Inactive-User Handling
- If an employee leaves the company or is temporarily suspended, an Admin marks `status = 'INACTIVE'`.
- Upon any login attempt, even if Supabase Auth credentials are valid, the client intercepts the status check:
  - Aborts CRM entry.
  - Immediately invokes `supabase.auth.signOut()`.
  - Displays user alert: `"Your account is inactive. Please contact your administrator."`
- On app resume/restart, existing sessions for deactivated accounts are invalidated upon profile reload.

---

## 7. Unprovisioned-User Handling
- Because there is **no public registration**, an external user who somehow obtains a Supabase Auth account cannot access company CRM data:
  - Intercepted during `AuthService.resolveUserProfile()`.
  - Aborts CRM entry.
  - Invokes `supabase.auth.signOut()`.
  - Displays user alert: `"Your account has not been provisioned by an administrator."`
- No default accounts or fallback roles are created automatically.

---

## 8. Offline Authentication Behaviour

The application is strictly offline-first:

1. **Active Session + Offline**:
   - If a sales rep is already logged in and drives into a Lucknow locality with zero cellular coverage, the persisted session remains valid.
   - The app reads the cached `User` profile from Dexie.
   - The sales rep can search leads, make calls, send WhatsApp messages, and schedule follow-ups completely offline.
2. **Cold Start + Offline**:
   - If the app is launched offline with an existing unexpired session, the Supabase client restores the session from local storage.
   - Local Dexie `User` profile is loaded, and the sales rep enters the CRM seamlessly.
3. **Logged Out + Offline**:
   - If a rep is logged out and has no internet connection, login requires network connectivity to verify credentials against Supabase Auth.
   - The UI presents a clear error: `"Network error. Please check your internet connection and try again."`
   - No insecure offline password backdoors are permitted.

---

## 9. Security Decisions

1. **No Service-Role Key on Client**: The Supabase service-role key is strictly prohibited in frontend code or client bundles. Only the public `anon` key is used.
2. **Client-Side Role Tampering Prevention**: Modifying local IndexedDB `role` from `AGENT` to `ADMIN` will be rejected by backend Row Level Security (RLS) policies once cloud sync is active.
3. **Data Preservation on Logout**: `AuthService.signOut()` only destroys the authenticated session. Local lead records, call logs, remarks, follow-ups, and templates are never deleted during logout.
4. **No Password Storage**: Passwords are never hashed, encrypted, or persisted inside the client database.

---

## 10. Environment Configuration

The application uses standard Vite environment variables:

```env
# Supabase Cloud Project Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If these environment variables are missing (such as in local development or before cloud setup), the application gracefully informs the user via an informative setup banner rather than crashing.

---

## 11. Testing Strategy

All authentication workflows are verified using unit and integration tests with a mockable Supabase client factory:
- `tests/authWorkflow.test.ts`:
  1. Configuration status detection.
  2. Valid Admin sign in and profile resolution.
  3. Valid Agent sign in and role resolution.
  4. Invalid credentials rejection.
  5. Inactive user interception and sign out.
  6. Unprovisioned user interception and sign out.
  7. Session persistence and startup restoration.
  8. Expired/null session handling.
  9. Logout CRM data preservation.
  10. Security: zero password leakage in local storage.

---

## 12. Future Admin Provisioning Requirements (Phase 2D Preview)

When the Admin creates an agent in Phase 2D:
1. Admin opens `ADMIN` $\rightarrow$ `Team Management` $\rightarrow$ `Add Agent`.
2. Admin enters Agent Name, Email, Temporary Password, and Phone.
3. Backend Edge Function or Admin API provisions the Supabase Auth user and creates the corresponding central `User` profile with `createdBy: admin.id`.
4. Agent logs in on their Android device using the credentials.
