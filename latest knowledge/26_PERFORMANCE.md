# 26 - PERFORMANCE

## Document Metadata
- **DOCUMENT_STATUS:** CURRENT
- **LAST_VERIFIED:** 2026-08-25
- **SOURCE_OF_TRUTH:** `vite.config.ts`, `package.json`, build outputs, `scripts/verify.ts`, `tests/`, Lighthouse manual runs
- **SCOPE:** Performance benchmarks and optimization status
- **RELATED_DOCUMENTS:** 11_FRONTEND_ARCHITECTURE.md, 17_OFFLINE_FIRST.md, 18_SYNC_ENGINE.md, 23_QA_TEST_MATRIX.md

---

## Performance Overview

| Metric | Target | Current | Status | Notes |
|--------|--------|---------|--------|-------|
| **Build Time** | < 60s | ~45s | ✅ | Vite + esbuild |
| **Bundle Size (gz)** | < 500KB | ~380KB | ✅ | Code splitting |
| **First Contentful Paint** | < 1.5s | ~1.2s | ✅ | Manual Lighthouse |
| **Time to Interactive** | < 3s | ~2.5s | ✅ | Manual Lighthouse |
| **Lighthouse Performance** | > 90 | 92 | ✅ | Manual |
| **Lighthouse Accessibility** | > 90 | 88 | ⚠️ | Minor gaps |
| **Sync Duration (typical)** | < 500ms | ~300ms | ✅ | Local + network |
| **DB Query (local)** | < 10ms | ~3ms | ✅ | Dexie compound indexes |
| **APK Size** | < 15MB | 7.3MB | ✅ | Capacitor v2 signing |

---

## Build Performance

### Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-dexie': ['dexie'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
          'admin': [/src[\\/]components[\\/]admin/],
        },
      },
    },
  },
});
```

### Bundle Analysis (Production Build)
| Chunk | Size (gz) | Contents |
|-------|-----------|----------|
| `vendor-react` | ~45KB | React 19 + React DOM |
| `vendor-supabase` | ~35KB | Supabase JS SDK |
| `vendor-dexie` | ~25KB | Dexie 4.4 |
| `vendor-ui` | ~20KB | Lucide, clsx, tailwind-merge |
| `admin` | ~60KB | Admin components (lazy) |
| `main` | ~120KB | Agent app + shared |
| **Total** | **~380KB** | |

### Build Time Breakdown
| Stage | Time | Notes |
|-------|------|-------|
| TypeScript Check | ~15s | `tsc --noEmit` |
| Vite Build | ~25s | esbuild minification |
| CSS Processing | ~3s | Tailwind v4 |
| Asset Optimization | ~2s | Images, fonts |
| **Total** | **~45s** | |

---

## Runtime Performance

### Database (Dexie IndexedDB)
| Operation | Typical Time | Optimization |
|-----------|--------------|--------------|
| Lead list (50 items) | 3ms | Compound indexes |
| Lead search | 5ms | `[status+deletedAt]`, `[assignedTo+deletedAt]` |
| Lead detail load | 8ms | Single `get()` + related queries |
| Call record insert | 2ms | Auto-index + outbox |
| Sync pull (100 records) | 50ms | Batched upsert |
| Sync push (50 items) | 80ms | Batched by entityType |

### Index Strategy (Dexie v5)
```typescript
// Compound indexes for mobile filtering
leads: '[status+deletedAt], [assignedTo+deletedAt], [locality+deletedAt], [isSynced+deletedAt]'
callRecords: '[leadId+deletedAt], [userId+startedAt]'
activities: '[leadId+deletedAt], [userId+createdAt]'
followUps: '[status+scheduledAt], [leadId+deletedAt]'
```

### Sync Performance
| Metric | Value | Conditions |
|--------|-------|------------|
| Push (10 items) | 120ms | Batched upsert |
| Pull (50 items) | 200ms | Cursor-based |
| Full sync (100 items) | 350ms | Push + pull |
| Conflict resolution | 5ms/record | 4-rule resolver |
| Background sync trigger | <10ms | Event listeners |

### Network
| Metric | Value | Notes |
|--------|-------|-------|
| Supabase RTT (India) | ~120ms | Regional |
| Realtime event latency | <100ms | WebSocket |
| Offline detection | Instant | `navigator.onLine` |
| Reconnect backoff | 1s→32s | Exponential |

---

## Mobile Performance (Android)

### APK Metrics
| Metric | Value | Target |
|--------|-------|--------|
| APK Size | 7.3MB | < 15MB |
| Install Time | ~3s | < 5s |
| Cold Start | ~1.8s | < 3s |
| Warm Start | ~0.8s | < 1s |
| Memory (idle) | ~45MB | < 100MB |
| Memory (active) | ~85MB | < 150MB |

### Capacitor Overhead
- **Bridge latency:** ~2ms per native call
- **Plugin overhead:** Local Notifications ~5ms
- **WebView:** Chrome WebView (system)

### Android Vitals (Play Console)
| Metric | Status | Notes |
|--------|--------|-------|
| ANR Rate | 0% | No ANRs in testing |
| Crash Rate | 0% | No crashes in testing |
| Slow Rendering | 0% | 60fps maintained |
| Stuck Partial Wake Locks | 0% | No wake locks |

---

## Web Vitals (Manual Lighthouse)

### Desktop (Chrome 120)
| Metric | Score | Value | Target |
|--------|-------|-------|--------|
| Performance | 92 | - | > 90 |
| Accessibility | 88 | - | > 90 |
| Best Practices | 95 | - | > 90 |
| SEO | 90 | - | > 90 |
| **FCP** | - | 1.2s | < 1.5s |
| **LCP** | - | 2.1s | < 2.5s |
| **TBT** | - | 80ms | < 200ms |
| **CLS** | - | 0.02 | < 0.1 |

### Mobile (Emulated Pixel 5)
| Metric | Score | Value | Target |
|--------|-------|-------|--------|
| Performance | 85 | - | > 90 |
| Accessibility | 86 | - | > 90 |
| Best Practices | 92 | - | > 90 |
| SEO | 88 | - | > 90 |
| **FCP** | - | 1.8s | < 1.5s |
| **LCP** | - | 3.2s | < 2.5s |
| **TBT** | - | 220ms | < 200ms |
| **CLS** | - | 0.05 | < 0.1 |

---

## Optimization Opportunities

### High Impact
| Optimization | Effort | Expected Gain |
|--------------|--------|---------------|
| LCP optimization (preload fonts) | Low | LCP -0.5s |
| Reduce main bundle (tree-shake lucide) | Medium | Bundle -30KB |
| Service Worker for PWA | Medium | Offline web |
| Image optimization (WebP/AVIF) | Low | LCP -0.3s |

### Medium Impact
| Optimization | Effort | Expected Gain |
|--------------|--------|---------------|
| Virtualized lead lists | Medium | Memory -50% |
| Prefetch admin routes | Low | Admin TTI -0.5s |
| Compress sync payloads | Low | Sync -20% |

### Low Impact
| Optimization | Effort | Expected Gain |
|--------------|--------|---------------|
| Brotli compression | Low | Bundle -5% |
| HTTP/3 (Supabase) | None | Platform |
| DNS prefetch | Low | RTT -10ms |

---

## Monitoring

### Current Instrumentation
| Metric | Source | Alerting |
|--------|--------|----------|
| Build size | `scripts/verify.ts` | CI gate |
| Bundle analysis | `vite build --mode analyze` | Manual |
| Lighthouse | Manual | Manual |
| Android Vitals | Play Console | Email |
| Sync duration | `SyncEngine` + badge | Manual |
| Error rate | Console + toast | Manual |

### Planned Monitoring
| Metric | Tool | Timeline |
|--------|------|----------|
| Real User Monitoring (RUM) | Vercel Analytics | Q3 2026 |
| Custom events (sync, errors) | Vercel Analytics | Q3 2026 |
| Core Web Vitals (field) | web-vitals library | Q4 2026 |
| Android Vitals automation | Play Console API | Q4 2026 |

---

## Performance Testing

### Automated
| Test | Command | Gate |
|-------|---------|------|
| Build size check | `npm run verify` (stage 8) | CI |
| TypeScript compile time | `tsc --noEmit` | CI |
| Lint time | `npm run lint` | CI |

### Manual
| Test | Frequency | Tool |
|------|-----------|------|
| Lighthouse (desktop) | Per release | Chrome DevTools |
| Lighthouse (mobile) | Per release | Chrome DevTools (emulation) |
| Android APK size | Per release | `scripts/prod_smoke.ps1` |
| Android install time | Per release | ADB |
| Sync benchmark | Per release | `multiDeviceSync.test.ts` |
| Memory profiling | Quarterly | Chrome DevTools / Android Studio |

---

## Known Performance Issues

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Mobile LCP > 2.5s | MEDIUM | User perception | Not addressed |
| Mobile TBT > 200ms | MEDIUM | Interactivity | Not addressed |
| No Service Worker | LOW | Offline web limited | Accepted |
| No virtualization for large lists | LOW | Memory on 1000+ leads | Accepted (<200 leads) |
| No performance budgets in CI | LOW | Regression risk | Planned |

---

## Performance Budget (Proposed)

| Metric | Budget | Current | Enforcement |
|--------|--------|---------|-------------|
| Total JS (gz) | 400KB | 380KB | CI gate |
| Total CSS (gz) | 50KB | 42KB | CI gate |
| FCP (mobile) | 1.5s | 1.8s | Lighthouse CI |
| LCP (mobile) | 2.5s | 3.2s | Lighthouse CI |
| TBT (mobile) | 200ms | 220ms | Lighthouse CI |
| APK Size | 15MB | 7.3MB | CI gate |
| Sync Duration | 500ms | 300ms | Test gate |