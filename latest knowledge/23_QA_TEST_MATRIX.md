# 23 - QA TEST MATRIX

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `tests/`, `e2e/`, `scripts/verify.ts`, test execution logs
- **SCOPE:** Comprehensive QA test matrix for all features × roles × platforms × states
- **RELATED_DOCUMENTS:** 22_TESTING_STRATEGY.md, 12_TESTING_VERIFICATION.md, 16_CURRENT_STATE.md

---

## Test Matrix Overview

This matrix covers: **FEATURE × ROLE × PLATFORM × STATE**

| Dimension | Values |
|-----------|--------|
| **Features** | 22 features (FEAT-001 to FEAT-022) |
| **Roles** | ADMIN, AGENT |
| **Platforms** | Web (Chrome/Firefox), Android (AVD) |
| **States** | 12 states (happy path, invalid input, empty, offline, reconnect, retry, restart, force-stop, stale data, concurrent mutation, permission restriction, sync, realtime, error recovery) |

**Total Combinations:** 22 × 2 × 2 × 12 = **1,056 test scenarios**

---

## Feature × Role Matrix

| Feature | ADMIN | AGENT | Notes |
|---------|-------|-------|-------|
| FEAT-001: Excel Lead Import | ✅ Full | ❌ | Admin-only |
| FEAT-002: Manual Lead Create | ✅ Full | ✅ Self-only | Agent creates for self |
| FEAT-003: Lead Search/Filter | ✅ All org | ✅ Assigned only | RLS enforced |
| FEAT-004: Individual Assignment | ✅ Full | ❌ | Admin-only |
| FEAT-005: Bulk Assignment | ✅ Full | ❌ | Admin-only |
| FEAT-006: Call Lifecycle | ❌ | ✅ Full | Agent primary |
| FEAT-007: Follow-up Schedule | ✅ View | ✅ Full | Admin can view |
| FEAT-008: WhatsApp Compose | ✅ Full | ✅ Full | Both roles |
| FEAT-009: Remark Management | ✅ All | ✅ Assigned | RLS |
| FEAT-010: Activity Timeline | ✅ All | ✅ Assigned | RLS |
| FEAT-011: Admin Dashboard | ✅ Full | ❌ | Admin-only |
| FEAT-012: Agent Management | ✅ Full | ❌ | Admin-only |
| FEAT-013: Reports & CSV | ✅ Full | ❌ | Admin-only |
| FEAT-014: Live Activity Feed | ✅ Full | ❌ | Admin-only |
| FEAT-015: Sync Engine | ⚙️ System | ⚙️ System | Background |
| FEAT-016: Realtime | ⚙️ System | ⚙️ System | Background |
| FEAT-017: Backup/Restore | ✅ Full | ❌ | Admin-only |
| FEAT-018: Theme | ✅ | ✅ | Per-device |
| FEAT-019: Auth | ✅ | ✅ | Both roles |
| FEAT-020: RBAC | ⚙️ Enforced | ⚙️ Enforced | Server + Client |
| FEAT-021: Multi-Device Test | ✅ QA | ✅ QA | Test infra |
| FEAT-022: Secret Scan | ✅ CI | ✅ CI | CI gate |

---

## Platform × State Matrix (Per Feature)

### Web Platform (Chrome/Firefox)

| State | Test Approach | Automation |
|-------|---------------|------------|
| Happy Path | E2E + Unit | Playwright + Unit |
| Invalid Input | Unit + E2E | Unit (form validation) |
| Empty State | E2E | Playwright |
| Offline | Manual + E2E | Chrome DevTools offline |
| Reconnect | Manual + E2E | Network toggle |
| Retry | Unit | Mock fetch failures |
| Restart | Manual | Browser restart |
| Force-Stop | N/A | N/A (web) |
| Stale Data | E2E | Cache manipulation |
| Concurrent Mutation | Multi-tab E2E | Playwright multi-page |
| Permission Restriction | E2E (role switch) | Playwright auth |
| Sync | Unit + Integration | Real Supabase |
| Realtime | E2E | Multi-browser |
| Error Recovery | Unit + E2E | Error boundary tests |

### Android Platform (AVD)

| State | Test Approach | Automation |
|-------|---------------|------------|
| Happy Path | E2E + Unit | Playwright Android |
| Invalid Input | E2E | Playwright Android |
| Empty State | E2E | Playwright Android |
| Offline | AVD airplane mode | Playwright + ADB |
| Reconnect | AVD network toggle | Playwright + ADB |
| Retry | Unit + E2E | Mock + Playwright |
| Restart | ADB force-stop | Playwright + ADB |
| Force-Stop | ADB force-stop | Playwright + ADB |
| Stale Data | E2E | Cache manipulation |
| Concurrent Mutation | Multi-device E2E | 3 AVDs |
| Permission Restriction | E2E | Playwright auth |
| Sync | Unit + Integration | Real Supabase |
| Realtime | E2E | Multi-device |
| Error Recovery | E2E | Playwright |

---

## Detailed Test Scenarios (High Priority)

### FEAT-001: Excel Lead Import (ADMIN)

| Test ID | Scenario | Role | Platform | State | Expected | Automation |
|---------|----------|------|----------|-------|----------|------------|
| T001 | Valid XLSX with all columns | ADMIN | Web | Happy | Leads imported, audit created | E2E |
| T002 | XLSX with missing required cols | ADMIN | Web | Invalid | Column mapping required | E2E |
| T003 | Duplicate phone numbers | ADMIN | Web | Invalid | Duplicate modal, skip/update | E2E |
| T004 | Phone normalization (+91/STD) | ADMIN | Web | Happy | All phones → E.164 | Unit |
| T005 | Empty file | ADMIN | Web | Empty | Error message | E2E |
| T006 | Large file (1000 rows) | ADMIN | Web | Happy | All imported, progress shown | E2E |
| T007 | Import offline | ADMIN | Web | Offline | Queued, syncs on reconnect | Manual |
| T008 | Import during sync | ADMIN | Web | Sync | Queued, processes after | Manual |
| T009 | Cancel import mid-way | ADMIN | Web | Error | Partial import rolled back | E2E |
| T010 | Corrupt XLSX | ADMIN | Web | Error | Graceful error message | E2E |

### FEAT-006: Call Lifecycle (AGENT)

| Test ID | Scenario | Role | Platform | State | Expected | Automation |
|---------|----------|------|----------|-------|----------|------------|
| T011 | Dial → Connected → Log outcome | AGENT | Android | Happy | Call record VERIFIED | E2E |
| T012 | Dial → Busy → Log outcome | AGENT | Android | Happy | Call record UNVERIFIED | E2E |
| T013 | Dial → No Answer → Log | AGENT | Android | Happy | Call record UNVERIFIED | E2E |
| T014 | Dial → Wrong Number → Log | AGENT | Android | Happy | Call record UNVERIFIED | E2E |
| T015 | Dial → Cancel before connect | AGENT | Android | Happy | No call record | E2E |
| T016 | Force stop during call | AGENT | Android | Force-stop | State recovered on restart | E2E |
| T017 | App background during call | AGENT | Android | Offline | Duration tracked | E2E |
| T018 | Concurrent call on same lead | AGENT | Android | Concurrent | Both recorded, idempotency | Multi-device |
| T019 | Network loss during call | AGENT | Android | Reconnect | Local record, syncs later | E2E |
| T020 | Call duration verification | AGENT | Android | Happy | VERIFIED > UNVERIFIED | Conflict test |

### FEAT-015: Sync Engine (SYSTEM)

| Test ID | Scenario | Role | Platform | State | Expected | Automation |
|---------|----------|------|----------|-------|----------|------------|
| T021 | Local create → push → pull | SYSTEM | Android | Happy | Cloud has record | Integration |
| T022 | Local update → conflict | SYSTEM | Android | Concurrent | LWW wins | Conflict test |
| T023 | Call record VERIFIED conflict | SYSTEM | Android | Conflict | VERIFIED wins | Conflict test |
| T024 | Offline writes → reconnect | SYSTEM | Android | Offline+Reconnect | All synced | Multi-device |
| T025 | Delete → hard delete (M7) | SYSTEM | Android | Happy | Children CASCADE | Integration |
| T026 | Max retries → dead letter | SYSTEM | Android | Error | DEAD_LETTER status | Integration |
| T027 | Exponential backoff | SYSTEM | Android | Retry | 1s,2s,4s,8s,16s,32s | Unit |
| T028 | Single-flight mutex | SYSTEM | Android | Concurrent | No parallel syncs | Unit |
| T029 | Cursor incremental pull | SYSTEM | Android | Stale data | Only new records | Integration |
| T030 | Large dataset pull | SYSTEM | Android | Happy | Pagination works | Integration |

### FEAT-020: RBAC (SYSTEM)

| Test ID | Scenario | Role | Platform | State | Expected | Automation |
|---------|----------|------|----------|-------|----------|------------|
| T031 | Agent sees only assigned | AGENT | Web/Android | Permission | 0 other leads | RLS test |
| T032 | Admin sees all org leads | ADMIN | Web/Android | Permission | All org leads | RLS test |
| T033 | Cross-org access | AGENT | Web/Android | Permission | 0 rows | RLS test |
| T034 | Agent cannot reassign | AGENT | Web/Android | Permission | Update blocked | RLS test |
| T035 | Admin can reassign | ADMIN | Web/Android | Permission | Update allowed | RLS test |
| T036 | Profile immutability | AGENT | Web/Android | Error | Role/org_id blocked | Trigger test |
| T037 | Lead immutability | AGENT | Web/Android | Error | org_id/created_by blocked | Trigger test |
| T038 | Service role key in client | CI | - | Security | Scan fails | Secret scan |

---

## Test Execution Commands

### Unit/Integration Tests
```bash
# All unit tests (119 tests)
npm test

# Specific test file
npm test -- tests/syncConflictResolver.test.ts

# With coverage
npm test -- --coverage
```

### E2E Tests
```bash
# All E2E (32 tests × 2 projects = 64 runs)
npm run test:e2e

# Specific spec
npx playwright test e2e/auth.spec.ts

# Headed mode for debugging
npx playwright test e2e/crm-navigation.spec.ts --headed
```

### Multi-Device Tests (3 AVDs)
```bash
# Requires 3 running emulators
npm run test:multidevice

# Or manually:
npx tsx --test tests/multiDeviceSync.test.ts
```

### Verification Pipeline (12 Stages)
```bash
# Full verification (runs all stages)
npm run verify

# Stages:
# 1. TypeScript compile
# 2. Lint
# 3. Unit tests
# 4. E2E tests
# 5. Real Supabase tests
# 6. Multi-device sync
# 7. Security secret scan
# 8. Build
# 9. Android build
# 10. Production smoke
# 11. Schema drift check
# 12. Documentation consistency
```

---

## Test Results Tracking

### Current Status (2026-08-25)

| Suite | Tests | Status | Last Run |
|-------|-------|--------|----------|
| Unit/Integration | 119 | ✅ PASS | 2026-08-25 |
| Playwright E2E | 32 | ✅ PASS | 2026-08-25 |
| Real PostgreSQL | 15 | ✅ PASS | 2026-08-25 |
| Multi-Device (3 AVDs) | 13 | ✅ PASS (3 consecutive) | 2026-08-25 |
| Production Build | - | ✅ PASS | 2026-08-25 |

### Test Coverage by Feature

| Feature | Unit | Integration | E2E | Multi-Device | Total |
|---------|------|-------------|-----|--------------|-------|
| Lead Import | 16 | 3 | 4 | 0 | 23 |
| Lead Management | 10 | 5 | 8 | 0 | 23 |
| Call Lifecycle | 6 | 7 | 4 | 3 | 20 |
| Follow-ups | 5 | 3 | 2 | 0 | 10 |
| WhatsApp | 3 | 2 | 3 | 0 | 8 |
| Sync Engine | 18 | 13 | 0 | 13 | 44 |
| Realtime | 5 | 8 | 4 | 3 | 20 |
| RBAC/Security | 10 | 15 | 4 | 3 | 32 |
| Backup/Restore | 8 | 3 | 2 | 0 | 13 |
| Auth | 4 | 2 | 4 | 0 | 10 |
| **Total** | **85** | **61** | **32** | **13** | **191** |

---

## Automation Gaps

| Gap | Priority | Effort | Plan |
|-----|----------|--------|------|
| Web offline testing | HIGH | Medium | Playwright offline mode |
| Android force-stop automation | HIGH | Medium | ADB + Playwright |
| Concurrent mutation (web) | MEDIUM | High | Multi-tab Playwright |
| Stale data simulation | MEDIUM | Medium | Mock timestamps |
| Permission restriction (web) | MEDIUM | Low | Role switching in E2E |
| Error recovery UI | LOW | Medium | Error boundary tests |
| Performance benchmarks | LOW | High | Lighthouse CI |

---

## Release Gate Test Requirements

| Gate | Required Tests | Status |
|------|----------------|--------|
| BUILD | TypeScript, Lint, Build | ✅ |
| UNIT | All 119 unit tests | ✅ |
| E2E | All 32 E2E tests | ✅ |
| INTEGRATION | Real Supabase (15), Multi-device (13) | ✅ |
| SECURITY | Secret scan, RLS isolation | ✅ |
| PERFORMANCE | Build size, Lighthouse | ⚠️ Manual |
| ACCESSIBILITY | axe-core, keyboard nav | ⚠️ Manual |
| ANDROID | AVD tests (3), APK install | ✅ |
| BACKUP | Restore integrity, LWW merge | ✅ |
| DOCUMENTATION | Consistency check | ⚠️ Manual |

---

## Test Data Management

### Seed Data (Consistent Across Environments)
| Entity | Count | Description |
|--------|-------|-------------|
| Organizations | 1 | Amaratv Krishi Lucknow Central |
| Profiles | 3 | 1 ADMIN, 2 AGENTS |
| Leads | 3 | Sample gyms in Lucknow |
| Call Records | 0 | Clean slate |
| Activities | 0 | Clean slate |
| Templates | 5 | Default WhatsApp templates |

### Test Isolation
- Each test file uses fresh Dexie database (`clearAllData()`)
- Multi-device tests use separate emulator instances
- CI runs tests in parallel with isolated Supabase projects

---

## Known Test Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No physical device testing | Android only on AVD | AVD primary target |
| No iOS testing | Capacitor iOS not built | Not in scope |
| No load testing | Concurrent user limits unknown | Manual verification |
| No chaos engineering | Network partition testing limited | ADB network toggle |
| No visual regression | UI changes not auto-caught | Manual QA |
| No contract testing | API schema drift possible | Schema probe script |