# 25 - SECURITY

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `supabase/migrations/`, `src/services/`, `tests/securityRlsIsolation.test.ts`, `tests/securitySecretScan.test.ts`, `scripts/verify.ts`
- **SCOPE:** Complete security architecture and implementation
- **RELATED_DOCUMENTS:** 16_RLS_SECURITY.md, 12_BACKEND_ARCHITECTURE.md, 14_DATABASE_RELATIONSHIPS.md

---

## Security Architecture

### Defense in Depth

| Layer | Implementation | Verification |
|-------|----------------|--------------|
| **Network** | Supabase managed (DDoS, WAF, TLS 1.3) | Supabase SLA |
| **Transport** | HTTPS only, HSTS, CSP | Browser devtools |
| **Authentication** | Supabase Auth (JWT, refresh rotation) | Auth tests |
| **Authorization** | RLS on ALL tables (server-enforced) | RLS tests (10) |
| **Data** | Org-scoped + Agent-scoped policies | RLS tests |
| **Secrets** | Service role key ONLY in Edge Functions | Secret scan test |
| **Client** | Anon key only, no service role | Secret scan test |
| **Android** | `allowBackup=false`, non-debuggable | AndroidManifest |

---

## Authentication Security

### Supabase Auth Configuration
```typescript
// Client config (src/services/supabaseClient.ts)
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  // PKCE enabled by default
}
```

### Session Security
| Property | Value | Rationale |
|----------|-------|-----------|
| Access Token Expiry | 1 hour (3600s) | Short-lived |
| Refresh Token Rotation | Enabled | Prevents replay |
| Refresh Token Reuse Interval | 10 seconds | Grace period |
| Session Persistence | localStorage (web), Preferences (Android) | Cross-tab |
| MFA | Not enforced | Internal tool |

### Password Policy
- Minimum 8 characters (Supabase default)
- No complexity requirements enforced
- No password history
- No account lockout (internal tool)

---

## Authorization (RLS)

### Core Principle
**Server-enforced data isolation at database level.** Client-side routing only hides UI; RLS is true enforcement.

### Security Boundaries

| Boundary | Enforcement | Test Coverage |
|----------|-------------|---------------|
| **Organization** | `current_user_org_id()` on every policy | RLS tests |
| **Agent Lead Isolation** | `current_profile_id()` vs `assigned_to`/`created_by` | RLS tests (10) |
| **Admin Supremacy** | `is_org_admin()` bypasses agent restrictions | RLS tests |
| **Cross-Org** | Zero rows visible (0 results) | RLS tests |
| **Audit Tables** | Admin-only (SELECT/INSERT) | RLS tests |

### Helper Functions (5 Total)
```sql
-- All: SECURITY DEFINER, STABLE, SET search_path = public
1. current_user_org_id() → UUID
2. current_user_role() → TEXT
3. is_org_admin() → BOOLEAN
4. is_active_org_user() → BOOLEAN
5. current_profile_id() → UUID (Migration 6)
```

### Immutability Triggers (2)
```sql
-- Prevents privilege escalation
1. protect_profile_immutable_fields()
   -- Blocks non-admin: role, organization_id, status, auth_user_id

2. protect_lead_immutable_fields()
   -- Blocks non-admin: organization_id, created_by
   -- Blocks non-admin: reassignment to other agents
```

---

## Data Protection

### Encryption
| Layer | Implementation |
|-------|----------------|
| **In Transit** | TLS 1.3 (Supabase managed) |
| **At Rest** | Supabase managed (AES-256) |
| **Application** | None (relies on transport + storage) |

### PII Handling
| Data Type | Classification | Protection |
|-----------|----------------|------------|
| Phone numbers | PII | Stored normalized, encrypted at rest |
| Email addresses | PII | Auth table (Supabase managed) |
| Names | PII | Profiles table (RLS protected) |
| Addresses | PII | Leads table (RLS protected) |
| Call recordings | Not stored | Only metadata |

### Data Retention
| Entity | Retention | Deletion |
|--------|-----------|----------|
| Leads | Indefinite | Soft delete (`deleted_at`) |
| Call records | Indefinite | Soft delete |
| Activities | Indefinite | Soft delete (audit trail) |
| Auth users | Indefinite | Admin deactivation |
| Backups | Manual | User-controlled |

---

## Secrets Management

### Secret Classification
| Secret | Location | Rotation |
|--------|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Manual |
| `VITE_SUPABASE_ANON_KEY` | Client bundle (public) | N/A |
| `VITE_SUPABASE_URL` | Client bundle (public) | N/A |
| Android keystore | `android/app/release.keystore` | Manual |
| Keystore passwords | CI secrets (not in repo) | Manual |

### Secret Scanning
```typescript
// tests/securitySecretScan.test.ts (3 tests)
Patterns scanned:
- Service role key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Keystore passwords in gradle.properties
- JWT secrets
- API keys
```

**CI Gate:** `npm run verify` stage 12/14 fails on detection.

### Client-Side Guarantees
- **Zero service role key** in client bundle
- **Anon key only** in `VITE_SUPABASE_ANON_KEY`
- **Verified by:** `securitySecretScan.test.ts` (static analysis)

---

## Edge Function Security

### create-agent (`supabase/functions/create-agent/`)
```typescript
// Only ADMIN can invoke (verified via JWT)
const { data: { user } } = await supabaseClient.auth.getUser();
const profile = await fetchProfile(user.id);
if (profile.role !== 'ADMIN') {
  return { error: 'Forbidden', status: 403 };
}

// Creates auth user + profile in single transaction
// Service role key used HERE only (never in client)
```

### Security Properties
| Property | Implementation |
|----------|----------------|
| Authentication | Supabase Auth (JWT verification) |
| Authorization | Role check (ADMIN only) |
| Rate Limiting | Supabase default (configurable) |
| Input Validation | Zod schema validation |
| Audit Logging | `bulk_assignment_audits` table |

---

## Android Security

### Manifest Hardening (`android/app/src/main/AndroidManifest.xml`)
```xml
<application
    android:allowBackup="false"
    android:debuggable="false"
    android:usesCleartextTraffic="false"
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
```

### Network Security Config (`android/app/src/main/res/xml/network_security_config.xml`)
```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains=true>supabase.co</domain>
        <domain includeSubdomains=true>vercel.app</domain>
    </domain-config>
</network-security-config>
```

### Permissions (Minimal)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<!-- No: CAMERA, LOCATION, CONTACTS, STORAGE, etc. -->
```

### APK Signing
- **Scheme:** APK Signature Scheme v2
- **Keystore:** External (not in repo)
- **Play Integrity:** Not configured (internal distribution)

---

## Vulnerability Mitigations

### SQL Injection
- **Supabase Client:** Parameterized queries only
- **Edge Functions:** Parameterized queries
- **RLS Policies:** No dynamic SQL

### XSS Prevention
- **React:** Auto-escapes by default
- **No `dangerouslySetInnerHTML`** used
- **User input:** Sanitized in templates

### CSRF Protection
- **Supabase Auth:** SameSite=Lax cookies
- **No custom forms** without CSRF tokens needed

### Clickjacking
- **CSP:** `frame-ancestors 'none'` (Vercel/Supabase defaults)

---

## Compliance

### Data Residency
- **Supabase Region:** Configured per project (likely US/EU)
- **Local Docker:** Developer machine only

### Audit Logging
| Event | Logged | Retention |
|-------|--------|-----------|
| Auth login/logout | Supabase Auth logs | 30 days |
| RLS policy violations | Postgres logs | 7 days |
| Edge Function invocations | Supabase Function logs | 7 days |
| Admin actions | `activities` table | Indefinite |
| Bulk assignments | `bulk_assignment_audits` | Indefinite |
| Imports | `import_audits` | Indefinite |

---

## Security Testing

### Automated Tests
| Test File | Coverage |
|-----------|----------|
| `securityRlsIsolation.test.ts` (10 tests) | Agent/admin isolation, cross-org, mutations |
| `securitySecretScan.test.ts` (3 tests) | Service role key, keystore, JWT patterns |

### CI Gates
```bash
# Stage 12: Security secret scan
npm test -- tests/securitySecretScan.test.ts

# Stage 5: RLS isolation
npm test -- tests/securityRlsIsolation.test.ts
```

### Manual Security Review (Per Release)
- [ ] Dependency audit (`npm audit`)
- [ ] Secret scan pass
- [ ] RLS policy review
- [ ] Edge Function audit
- [ ] Android manifest review
- [ ] APK signature verification

---

## Incident Response

### Breach Detection
| Signal | Detection |
|--------|-----------|
| Unusual auth patterns | Supabase Auth monitoring |
| RLS policy violations | Postgres log alerts |
| Edge Function errors | Supabase Function monitoring |
| Data exfiltration | Supabase database metrics |

### Response Playbook
1. **Contain:** Revoke compromised keys, disable affected users
2. **Assess:** Query audit tables (`activities`, `import_audits`, `bulk_assignment_audits`)
3. **Notify:** Stakeholders per severity
4. **Remediate:** Rotate keys, patch vulnerabilities
5. **Document:** Post-incident report

---

## Known Security Gaps

| Gap | Severity | Status | Mitigation |
|-----|----------|--------|------------|
| No MFA | MEDIUM | Accepted | Internal tool, low risk |
| No password complexity | LOW | Accepted | Internal tool |
| No account lockout | LOW | Accepted | Internal tool |
| No session timeout config | LOW | Accepted | 1hr JWT expiry |
| No audit log export | LOW | Planned | Future feature |
| No SIEM integration | LOW | Not planned | Manual review |
| No penetration testing | MEDIUM | Not scheduled | Depend on Supabase |