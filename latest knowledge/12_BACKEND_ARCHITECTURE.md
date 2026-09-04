# 12 - BACKEND ARCHITECTURE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `supabase/` directory, `src/services/supabaseClient.ts`, Edge Functions
- **SCOPE:** Complete backend architecture (Supabase PostgreSQL, Auth, Realtime, Edge Functions)
- **RELATED_DOCUMENTS:** 09_ARCHITECTURE.md, 11_FRONTEND_ARCHITECTURE.md, 13_DATABASE_SCHEMA.md, 16_RLS_SECURITY.md

---

## Backend Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Platform                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │    Auth     │  │  Realtime   │              │
│  │  (Database) │  │  (Auth)     │  │  (Changes)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                        │
│  ┌─────────────────────────────────────┐                         │
│  │         Edge Functions              │                         │
│  │  (create-agent, future functions)   │                         │
│  └─────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supabase Configuration

### Project Details
| Property | Value |
|----------|-------|
| **Cloud Project** | `lahvcodvgubplzfshare.supabase.co` |
| **Local Stack** | Docker (npx supabase start) |
| **Local URL** | `127.0.0.1:15432` |
| **Database** | PostgreSQL 15+ |
| **PostgREST** | Auto-generated REST API |

### Client Configuration (`src/services/supabaseClient.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
```

**Key Settings:**
- **Session Persistence:** localStorage (web), AsyncStorage (native via Capacitor)
- **Auto Refresh:** Enabled (JWT expiry handling)
- **Realtime Throttle:** 10 events/second per client

---

## Database Layer

### PostgreSQL Schema
**Source of Truth:** `supabase/migrations/` (7 migrations)
- **Tables:** 10 application tables
- **Extensions:** `uuid-ossp`
- **RLS:** Enabled on ALL tables
- **Realtime:** 8 tables published

See **13_DATABASE_SCHEMA.md** for complete schema.
See **14_DATABASE_RELATIONSHIPS.md** for ER diagram.
See **15_MIGRATIONS.md** for migration history.
See **16_RLS_SECURITY.md** for security policies.

---

## Authentication

### Supabase Auth
| Feature | Implementation |
|---------|----------------|
| **Provider** | Email/Password (no OAuth yet) |
| **Session** | JWT (access token + refresh token) |
| **Storage** | localStorage (web), Capacitor Preferences (Android) |
| **Auto Refresh** | Enabled (60min access, 24hr refresh) |
| **Email Verification** | Not enforced (internal tool) |
| **MFA** | Not implemented |

### User Flow
```
1. LoginScreen.tsx → supabase.auth.signInWithPassword()
2. onAuthStateChange → fetch profile from profiles table
3. AuthContext.currentUser = { id, email, role, organizationId, ... }
4. RealtimeService.init(currentUser) → subscribe to org tables
```

### Profile Table (`profiles`)
| Column | Purpose |
|--------|---------|
| `id` | UUID, links to `auth.users.id` |
| `auth_user_id` | Reference to auth.users |
| `organization_id` | Multi-tenant isolation |
| `role` | ADMIN | AGENT |
| `status` | ACTIVE | INACTIVE |

---

## Row Level Security (RLS)

### Security Model
**Core Principle:** Server-enforced data isolation at database level.

| Boundary | Enforcement |
|----------|-------------|
| Organization | `current_user_org_id()` on every policy |
| Agent Lead Isolation | `current_profile_id()` vs `assigned_to`/`created_by` |
| Admin Supremacy | `is_org_admin()` bypasses agent restrictions |
| Cross-Org | Zero rows visible (0 results) |

### Helper Functions (5 total)
```sql
-- All SECURITY DEFINER, STABLE, SET search_path = public
1. current_user_org_id() → UUID
2. current_user_role() → TEXT
3. is_org_admin() → BOOLEAN
4. is_active_org_user() → BOOLEAN
5. current_profile_id() → UUID (Migration 6)
```

### Policy Pattern (per table)
```sql
-- SELECT: Org match AND (admin OR assigned_to=self OR created_by=self)
-- INSERT: Org match AND (admin OR creating for self)
-- UPDATE: Same as SELECT
-- DELETE: Admin only (or agent for own created leads - migration 7)
```

See **16_RLS_SECURITY.md** for complete policy documentation.

---

## Realtime

### Publication Configuration
```sql
-- Migration 4 & 5
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;
-- ... 6 more tables

ALTER PUBLICATION supabase_realtime ADD TABLE
  profiles, leads, call_records, activities,
  remarks, follow_ups, message_history, import_audits,
  bulk_assignment_audits;  -- Added in migration 5
```

### Client Subscription (`src/services/realtime/realtimeService.ts`)
| Table | Events | UI Usage |
|-------|--------|----------|
| `profiles` | INSERT, UPDATE, DELETE | Agent list updates |
| `leads` | INSERT, UPDATE, DELETE | Lead list, dashboard KPIs |
| `call_records` | INSERT, UPDATE, DELETE | Call history, analytics |
| `activities` | INSERT, UPDATE, DELETE | Live activity feed |
| `remarks` | INSERT, UPDATE, DELETE | Lead timeline |
| `follow_ups` | INSERT, UPDATE, DELETE | Follow-up list, badges |
| `message_history` | INSERT, UPDATE, DELETE | WhatsApp history |
| `import_audits` | INSERT, UPDATE, DELETE | Import status |

### Connection State Machine
```
DISCONNECTED → CONNECTING → SUBSCRIBING → SUBSCRIBED
                    ↓                    ↓
               RECONNECTING ←─────── ERROR
```

### Realtime → Sync Integration
```typescript
// RealtimeService.onNotification() → triggers background sync
// RealtimeService.onEntityChange() → hydrates local Dexie immediately
// Pull sync remains eventual-consistency fallback
```

---

## Edge Functions

### create-agent (`supabase/functions/create-agent/index.ts` - 9,761 bytes)
**Purpose:** Secure agent provisioning (only ADMIN can invoke via service role)

**Invocation:** `supabase.functions.invoke('create-agent', { body: { email, password, name, phone, role } })`

**Security:**
- Service role key ONLY in Edge Function (never in client)
- Validates caller is ADMIN via JWT
- Creates auth user + profile in single transaction
- Sends invite email (if configured)

**Request/Response:**
```typescript
// Request
interface CreateAgentRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'AGENT'; // Only AGENT allowed
}

// Response
interface CreateAgentResponse {
  success: boolean;
  agent?: { id: string; email: string };
  error?: string;
}
```

### Future Edge Functions (Planned)
| Function | Purpose | Priority |
|----------|---------|----------|
| `send-notification` | FCM push notifications | MEDIUM |
| `bulk-import-process` | Server-side Excel processing | LOW |
| `report-generation` | Scheduled PDF/CSV reports | LOW |
| `data-export` | GDPR/compliance exports | LOW |

---

## Storage

### Current Usage
- **No Supabase Storage buckets used** - All data in PostgreSQL
- **Files:** Excel imports processed client-side, not stored
- **Images:** App icons/logo in `public/`, not Supabase Storage

### Future Storage Needs
| Bucket | Purpose | Policy |
|--------|---------|--------|
| `lead-attachments` | Photos, documents per lead | Org-scoped RLS |
| `import-files` | Excel file archive | Admin-only |
| `backup-files` | JSON backup archive | Admin-only |

---

## API Layer (PostgREST)

### Auto-Generated Endpoints
| Table | REST Endpoints |
|-------|----------------|
| `leads` | GET/POST `/rest/v1/leads`, PATCH/DELETE `/rest/v1/leads?id=eq.xxx` |
| `call_records` | Same pattern |
| ... | All 10 tables |

### Client Usage
```typescript
// Direct Supabase client (bypasses repository for simple reads)
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('organization_id', orgId)
  .eq('assigned_to', userId);

// Repository pattern preferred for writes (sync integration)
await crmData.leads.create(lead); // Auto-enqueues to outbox
```

### Query Patterns
| Pattern | Example |
|---------|---------|
| Filter | `.eq('status', 'NEW')` |
| Range | `.gte('created_at', '2026-01-01')` |
| Order | `.order('updated_at', { ascending: false })` |
| Limit | `.limit(50)` |
| Select | `.select('id, business_name, status')` |

---

## Supabase Local Development

### Configuration (`supabase/config.toml`)
```toml
[db]
port = 15432

[api]
port = 15431

[studio]
port = 15433

[auth]
enabled = true
jwt_expiry = 3600
refresh_token_rotation_enabled = true

[realtime]
enabled = true
```

### Local Commands
```bash
npx supabase start        # Start Docker stack
npx supabase stop         # Stop stack
npx supabase db reset     # Reset + run all migrations
npx supabase migration new name  # Create new migration
npx supabase db push      # Push local migrations to cloud
npx supabase functions deploy create-agent  # Deploy Edge Function
```

---

## Environment Variables

### Required (All Environments)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Project URL (e.g., `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** - Edge Functions, CI |

### Environment Files
| File | Purpose |
|------|---------|
| `.env.example` | Template for new developers |
| `.env.local` | Local Docker stack |
| `.env.development` | Dev environment (local) |
| `.env.staging` | Staging (shared cloud) |
| `.env.production` | Production (live cloud) |

---

## Security Architecture

### Defense in Depth
| Layer | Implementation |
|-------|----------------|
| **Network** | Supabase managed (DDoS, WAF) |
| **Transport** | TLS 1.3 enforced |
| **Auth** | Supabase Auth (JWT, refresh rotation) |
| **Authorization** | RLS on ALL tables (server-enforced) |
| **Data** | Org-scoped + Agent-scoped policies |
| **Secrets** | Service role key ONLY in Edge Functions |
| **Client** | No service role key, anon key only |
| **Android** | `allowBackup=false`, no debuggable |

### Secret Scanning
- **Test:** `securitySecretScan.test.ts` (3 tests)
- **Patterns:** Service role key, keystore passwords, JWT secrets
- **CI Gate:** `npm run verify` stage 12/14

---

## Monitoring & Observability

### Current
| Metric | Source |
|--------|--------|
| Sync Status | `SyncEngineStatus` + `SyncStatusBadge` |
| Realtime Connection | `RealtimeService` connection state |
| Auth State | `AuthContext` loading/user state |
| Errors | Console + Toast notifications |

### Production (Vercel + Supabase)
| Tool | Purpose |
|------|---------|
| Vercel Analytics | Web vitals, page views |
| Supabase Dashboard | Database metrics, auth logs, realtime |
| Supabase Logs | Edge Function logs, Postgres logs |

---

## Backup & Disaster Recovery

### Database Backup
| Method | Frequency | Retention |
|--------|-----------|-----------|
| Supabase Point-in-Time Recovery | Continuous | 7 days (free), 30 days (pro) |
| Manual `pg_dump` | On-demand | Manual |

### Application Backup
- **Client-side:** JSON backup via `BackupRestoreModal` (all 13 entities)
- **Sync:** Restore queues changes to outbox for cloud sync

---

## Known Backend Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No custom PostgreSQL functions beyond RLS helpers | Complex logic in client | Acceptable for current scope |
| Single Supabase project (no multi-region) | Latency for non-India users | Target market is Lucknow, UP |
| No read replicas | Write-heavy workloads | Current load < 100 concurrent |
| Edge Function cold starts | ~500ms first call | Acceptable for admin-only |
| No scheduled jobs (pg_cron) | Automated cleanup | Manual via scripts |
| No Supabase Storage | File attachments not supported | Client-side only currently |