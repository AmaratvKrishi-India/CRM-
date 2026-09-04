# 29 - RELEASE READINESS

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `GATES.md`, `scripts/verify.ts`, `BUGFIX_RESULTS.md`, release artifacts
- **SCOPE:** Living release gate checklist for Amaratv Krishi CRM v2.0.0
- **RELATED_DOCUMENTS:** 22_DEPLOYMENT_RUNBOOK.md, 23_QA_TEST_MATRIX.md, 16_CURRENT_STATE.md

---

## Release Overview

| Property | Value |
|----------|-------|
| **Version** | v2.0.0 |
| **Release Commit** | 759a81c |
| **Release Date** | 2026-08-23 |
| **Status** | FULLY_RELEASED |
| **Android APK** | release/AmaratvKrishi-SalesCRM-v2.0.0.apk |
| **Web URL** | https://crm-blush-omega.vercel.app |
| **Supabase Cloud** | lahvcodvgubplzfshare.supabase.co |

---

## Release Gates

### GATE 1: BUILD ✅ PASS
| Check | Status | Evidence |
|-------|--------|----------|
| TypeScript compile | ✅ | `tsc --noEmit` passes |
| ESLint | ✅ | No errors |
| Vite production build | ✅ | `dist/` generated |
| Bundle size < 500KB | ✅ | 380KB gzipped |
| Android build | ✅ | APK generated |

### GATE 2: UNIT TESTS ✅ PASS
| Suite | Tests | Status |
|-------|-------|--------|
| Unit/Integration | 119 | ✅ PASS |
| Coverage | >80% | ✅ |

### GATE 3: E2E TESTS ✅ PASS
| Project | Tests | Status |
|---------|-------|--------|
| Desktop (Chrome) | 32 | ✅ PASS |
| Mobile (Pixel 5) | 32 | ✅ PASS |

### GATE 4: INTEGRATION TESTS ✅ PASS
| Test | Status | Notes |
|------|--------|-------|
| Real Supabase (Docker) | ✅ | 15 tests |
| Multi-device sync (3 AVDs) | ✅ | 13 tests, 3 consecutive runs |

### GATE 5: SECURITY ✅ PASS
| Check | Status | Evidence |
|-------|--------|----------|
| Secret scan | ✅ | Stage 12/14 |
| RLS isolation | ✅ | 10 tests |
| Dependency audit | ✅ | `npm audit` clean |

### GATE 6: DATABASE ✅ PASS
| Check | Status | Evidence |
|-------|--------|----------|
| Migrations 1-6 applied | ✅ | Local + Cloud |
| Migration 7 (local) | ✅ | `supabase_migrations.schema_migrations` |
| RLS policies active | ✅ | 10 tables |
| Realtime publication | ✅ | 8 tables |

### GATE 7: RLS ✅ PASS
| Policy | Status |
|--------|--------|
| Organization isolation | ✅ |
| Agent lead isolation | ✅ |
| Admin supremacy | ✅ |
| Immutability triggers | ✅ |
| Cross-org zero visibility | ✅ |

### GATE 8: SYNC ✅ PASS
| Component | Status |
|-----------|--------|
| Outbox atomicity | ✅ |
| Push/Pull | ✅ |
| Conflict resolution | ✅ |
| Background sync | ✅ |
| Exponential backoff | ✅ |

### GATE 9: REALTIME ✅ PASS
| Component | Status |
|-----------|--------|
| 8 table subscriptions | ✅ |
| Connection state machine | ✅ |
| Reconnect logic | ✅ |
| Realtime → Sync integration | ✅ |

### GATE 10: ANDROID ✅ PASS
| Check | Status |
|-------|--------|
| APK builds | ✅ |
| AVD tests (3) | ✅ |
| APK install | ✅ |
| `allowBackup=false` | ✅ |
| Permissions minimal | ✅ |
| APK Signature v2 | ✅ |

### GATE 11: ACCESSIBILITY ⚠️ PARTIAL
| Check | Status | Gap |
|-------|--------|-----|
| Semantic HTML | ✅ | |
| Keyboard navigation | ✅ | |
| Focus management | ✅ | |
| ARIA labels | ✅ | |
| Color contrast (AA) | ⚠️ | Brand gold on white |
| Reduced motion | ✅ | |
| Skip links | ❌ | Not implemented |

### GATE 12: PERFORMANCE ⚠️ PARTIAL
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Bundle size | < 500KB | 380KB | ✅ |
| FCP (mobile) | < 1.5s | 1.8s | ⚠️ |
| LCP (mobile) | < 2.5s | 3.2s | ⚠️ |
| TBT (mobile) | < 200ms | 220ms | ⚠️ |
| APK size | < 15MB | 7.3MB | ✅ |

### GATE 13: BACKUP ✅ PASS
| Feature | Status |
|---------|--------|
| Full JSON backup | ✅ |
| LWW restore | ✅ |
| Conflict resolution | ✅ |
| Sync integration | ✅ |

### GATE 14: PRODUCTION SMOKE ✅ PASS
| Check | Status |
|-------|--------|
| Web app loads | ✅ |
| Login works | ✅ |
| Supabase connected | ✅ |
| Realtime active | ✅ |

### GATE 15: DOCUMENTATION ⚠️ PARTIAL
| Document | Status |
|----------|--------|
| README.md | ✅ |
| GATES.md | ✅ |
| Project knowledge (23 docs) | ✅ |
| New MASTER docs (30) | 🔄 In Progress |
| CHANGELOG.md | ❌ Missing |
| RELEASE_NOTES.md | ✅ (release/) |

---

## Release Artifacts

### Android
| Artifact | Path | SHA-256 |
|----------|------|---------|
| Signed APK | `release/AmaratvKrishi-SalesCRM-v2.0.0.apk` | A7DD97F61718A7735BE3D0EBD0023F201BEC6B995AA4DD93A3A4E832CD30E0B9 |
| Version | 2.0.0 (versionCode 2) | |
| Min SDK | 24 | |
| Target SDK | 36 | |

### Web
| Artifact | Value |
|----------|-------|
| Vercel Project | `crm` |
| Vercel Scope | `amaratv-krishi` |
| Production URL | https://crm-blush-omega.vercel.app |
| Auto-deploy | `main` branch |

### Database
| Environment | Migrations | Status |
|-------------|------------|--------|
| Local Docker | 1-7 | ✅ |
| Cloud (Production) | 1-6 | ✅ |
| Cloud (Pending) | 7 | ⏳ Release step |

---

## Pre-Release Checklist

### Code Freeze
- [x] All features merged to `main`
- [x] No open critical bugs
- [x] All tests passing
- [x] Security scan clean

### Database
- [x] Migration 7 ready for cloud
- [x] Migration 7 tested locally
- [x] Rollback plan documented

### Android
- [x] Release keystore accessible
- [x] APK signed with v2 scheme
- [x] APK uploaded to `release/`
- [x] SHA-256 documented

### Web
- [x] Vercel production env vars set
- [x] Custom domain configured
- [x] SSL certificate valid

### Documentation
- [x] README.md updated
- [x] RELEASE_NOTES.md created
- [x] GATES.md reflects current state
- [ ] CHANGELOG.md created
- [ ] Project knowledge docs complete

---

## Rollback Plan

### Web (Vercel)
```bash
# Instant rollback to previous deployment
vercel rollback crm-blush-omega.vercel.app
```

### Android
```bash
# Previous APK in release/
# Manual re-upload to Play Store / distribution
```

### Database (Supabase)
```bash
# Migration 7 rollback (if needed)
# 1. Backup production DB
# 2. Run down migration: supabase db reset --linked
# 3. Apply migrations 1-6 only
# 4. Verify RLS policies
```

---

## Post-Release Monitoring

| Metric | Tool | Threshold |
|--------|------|-----------|
| Web uptime | Vercel Analytics | > 99.9% |
| Android crash rate | Play Console | < 0.1% |
| Sync success rate | SyncEngine logs | > 99% |
| Realtime connectivity | Supabase Dashboard | > 99% |
| Auth success rate | Supabase Auth | > 99% |
| Error rate | Console + Sentry | < 1% |

---

## Sign-Off

| Role | Name | Status | Date |
|------|------|--------|------|
| Tech Lead | - | ✅ | 2026-08-23 |
| QA Lead | - | ✅ | 2026-08-23 |
| Security | - | ✅ | 2026-08-23 |
| Product Owner | - | ✅ | 2026-08-23 |

---

## Release Notes Summary

See `release/RELEASE_NOTES.md` for full changelog.

**Highlights:**
- v2.0.0 - FULLY_RELEASED
- Agent Lead Isolation (RLS Migration 6)
- Call duration verification (BUG-1)
- Cloud hard-delete support (BUG-8, Migration 7)
- Multi-device sync verified (3 AVDs)
- All 11 audit bugs fixed