# Release Notes

## v2.0.0 (2026-08-22)

Production release of the Amaratv Krishi Field Sales CRM.

### Artefact

| Field | Value |
|---|---|
| File | `AmaratvKrishi-SalesCRM-v2.0.0.apk` |
| Size | 7,268,429 bytes (6.93 MB) |
| SHA-256 | `A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9` |
| App ID | `com.amaratvkrishi.salescrm` |
| versionName / versionCode | 2.0.0 / 2 |
| minSdk / targetSdk | 24 / 36 |
| Signing | APK Signature Scheme v2, CN=Amaratv Krishi (Lucknow) |
| Cert SHA-256 | `a131697e3cdf7ade44c5c3df3563e6cbb9fa54969b5a718ce03da49a20dc0ed6` |

### What's included

- Single APK for ADMIN and AGENT roles with role-based routing
- Offline-first sync engine (Dexie outbox, push→pull, LWW conflict resolution)
- Excel lead import with column mapping, phone normalisation and dedup
- Single + bulk lead assignment with audit trails
- Call lifecycle with dialler integration and anti-fabrication invariants
- WhatsApp pitch templates (intent-based), remarks, follow-ups, activities
- Admin analytics, reports, live activity feed, agent management
- Day/Night theme, Inter typography, responsive layouts
- Supabase backend: 6 migrations, org + agent RLS isolation, realtime
- Web admin console on Vercel: https://crm-blush-omega.vercel.app

### Verification

Certified by the final post-bugfix release verification (2026-08-23):
see [docs/FINAL_POST_BUGFIX_RELEASE_VERIFICATION.md](../docs/FINAL_POST_BUGFIX_RELEASE_VERIFICATION.md).

- 115 unit tests, 32 E2E tests, 15 PostgreSQL/RLS tests, 13 multi-device
  emulator acceptance tests — all passing
- 3-emulator acceptance: admin + 2 agents, lead isolation, sync, offline recovery
- Production Supabase verified read-only: 6/6 migrations, RLS active

### Install

```bash
adb install -r release/AmaratvKrishi-SalesCRM-v2.0.0.apk
```

---

## Version history

| Version | Date | Notes |
|---|---|---|
| 2.0.0 | 2026-08-22 | Phase 2/3 complete: multi-tenant RLS, sync engine, agent lifecycle, background sync, Day/Night theme, production release |
| 1.x | 2026-08 | Phase 1: core CRM (leads, calls, remarks) |
