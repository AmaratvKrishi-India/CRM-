# Test Matrix: Amaratv Krishi Sales CRM - 20 Testing Criteria

**Generated:** Phase 3 of 13-Phase Test Plan  
**Stack:** React 19, TypeScript, Vite, Capacitor v8, Supabase, Dexie (IndexedDB), Tailwind CSS v4  
**Constraint:** NO Playwright, NO axe-core/playwright, NO @lhci/cli, NO existing tools

---

## Decision Matrix

| # | Criterion | Primary Tool | Secondary Tool | Rationale |
|---|-----------|--------------|----------------|-----------|
| **1** | **Unit Test Runner (React 19 + TS + Vite)** | **Vitest 4.x** (12.8k★) | Bun Test Runner (70k★) | Vitest: Vite-native, React 19 ready, Jest-compatible, built-in type testing (expect-type), excellent DX. Bun: 3.2x faster for local dev iteration. |
| **2** | **React 19 Component Testing** | **@testing-library/react 16.x** + **@testing-library/dom 10.x** | — | Official React 19 support (Dec 2024), works with Vitest, accessible queries, no implementation details. |
| **3** | **TypeScript Type Testing** | **expect-type** (built into Vitest) | **TSTyche** (full runner, multi-TS version) | expect-type: fluent API, zero config, integrated. TSTyche: dedicated type test runner for complex type assertions, multiple TS versions. |
| **4** | **Dexie/IndexedDB Unit Testing** | **Dexie Module Mocking Pattern** (Dexie.dependencies override) | **fake-indexeddb** (82.8% WPT) | Mocking pattern: fast, isolated, no browser. fake-indexeddb: comprehensive WPT coverage for integration tests needing real IndexedDB behavior. |
| **5** | **Supabase Integration Testing** | **supabase-test** (constructive-io) | **Supabase CLI Local Dev** + **pgTAP** | supabase-test: instant isolated Postgres DBs, auto-rollbacks, RLS context switching, pgpm seeding, Vitest compatible. CLI: real local Supabase stack, `supabase test db` runs pgTAP. |
| **6** | **Auth Flow Testing** | **supabase-test** (auth context switching) | **@asghonim/playwright-supabase** (if E2E needed) | supabase-test handles RLS/user contexts natively. Playwright-Supabase provides API mocking for auth/database/storage. |
| **7** | **Dexie→Supabase Sync Testing** | **supabase-test** + **Vitest** (custom sync test harness) | **mandarini/demo-testing-supabase** (real local, no mocks) | Custom harness using supabase-test for isolated DB per test, testing sync queue, conflict resolver, outbox pattern. Real local Supabase validates end-to-end. |
| **8** | **Background Sync & Conflict Resolution** | **Vitest** (custom test utilities) + **supabase-test** | — | Test BackgroundSyncManager, SyncQueue, ConflictResolver services directly with isolated DBs per test. |
| **9** | **Realtime Subscription Testing** | **supabase-test** (realtime + pgTAP) | **Supabase CLI Local** | Local Supabase provides real Realtime server. pgTAP tests for subscription logic. |
| **10** | **E2E Testing (Capacitor v8 + React 19)** | **Maestro** (10.8k★) | **Drizz** (Vision AI) / **Repeato** (CV) | Maestro: YAML declarative, Capacitor first-class, Maestro Studio, CI-native, cross-platform. Drizz/Repeato: AI/self-healing alternatives for flaky scenarios. |
| **11** | **Mobile Visual Regression** | **Lost Pixel** (Storybook/Ladle/Pages) | **Argus** (React Native Storybook, iOS Simulator) | Lost Pixel: open-source Percy alternative, custom shots via Playwright, responsive tests, parallel, masking. Argus: mobile-native, Pixelmatch/SSIM, self-hosted dashboard. |
| **12** | **Bundle Analysis** | **rollup-plugin-visualizer** (3.5k★) | **vite-bundle-analyzer** (500★) | rollup-plugin-visualizer: de-facto standard, treemap/sunburst/network graphs, gzip/brotli sizes. vite-bundle-analyzer: Vite-specific, simpler config. |
| **13** | **Runtime Performance (Core Web Vitals, FPS)** | **web-vitals** (15k★) + **unlighthouse** (3.5k★) | **mitata** (2k★) / **tinybench** (1.5k★) | web-vitals: official Google library, production-ready. unlighthouse: Lighthouse CI alternative, parallel, fast, CI-native. mitata/tinybench: micro-benchmarks for sync operations. |
| **14** | **Load Testing (Sync Throughput)** | **autocannon** (8k★) | **artillery** (5k★) | autocannon: Node HTTP benchmark, used by React core, extremely fast. artillery: Playwright engine, scriptable scenarios for complex sync flows. |
| **15** | **Memory Leak Detection** | **memlab** (5k★) | **V8 Heap Snapshots** (built-in) | memlab: automated leak detection, headless, CI-integrable, scenario-based. V8 snapshots: manual deep-dive. |
| **16** | **Sync Benchmark & Regression Tracking** | **vitest bench** + **@codspeed** | — | vitest bench: native, zero-config. @codspeed: CI regression tracking, historical trends, PR comments. |
| **17** | **Accessibility (WCAG 2.1 AA)** | **eslint-plugin-react-a11y** (ofri-peretz) + **@accesslint/core** | **a11y-guard** (region-aware) / **a11y-check** (static AST) | eslint-plugin-react-a11y: React 19 compatible, auto-fixes, WCAG presets. @accesslint/core: zero browser deps, happy-dom/jsdom, fiber source mapping. a11y-guard: regional compliance (ADA/EAA/Section508), SARIF. a11y-check: pre-commit/CI, no browser. |
| **18** | **Visual Regression (Component Snapshots)** | **Lost Pixel** | **BackstopJS** / **pixelguard** | Lost Pixel: Storybook integration, responsive, parallel, masking, flaky retries. BackstopJS: free CLI, battle-tested. pixelguard: Rust CLI, zero-config, git-friendly, approval workflow. |
| **19** | **Security & Compliance** | **OSV-Scanner** (Google) + **OWASP dep-scan** | **auditfix** (reachability + auto-fix) / **supply-chain-guard** (malware campaigns) | OSV-Scanner: 19+ ecosystems, guided remediation, SBOM, SLSA 3. OWASP dep-scan: reachability analysis, SBOM (CycloneDX), CSAF VEX. auditfix: production reachability, EPSS+CISA KEV, safe auto-fix. supply-chain-guard: 350+ threat indicators, SLSA provenance. |
| **20** | **CI/CD Pipeline & Quality Gates** | **GitHub Actions Matrix Sharding** + **Mergify CI Insights** | **@lastest/runner** (CI trigger) | Matrix: parallel sharding, fail-fast:false, blob reporters, merge-reports. Playwright/Vitest sharding: --shard=N/M. Mergify: 5x scheduled runs, flaky detection dashboard. Dynamic shard calculation, timing-based splitting. |

---

## Tool Categories Summary

| Category | Primary | Secondary | Notes |
|----------|---------|-----------|-------|
| **Unit/Component/Type** | Vitest 4.x, @testing-library/react 16.x, expect-type | Bun, TSTyche | Vite-native ecosystem |
| **IndexedDB/Supabase** | supabase-test, Dexie mocking | fake-indexeddb, Supabase CLI/pgTAP | Isolated DBs per test |
| **E2E/Mobile** | Maestro | Drizz, Repeato | Capacitor-first |
| **Visual Regression** | Lost Pixel | BackstopJS, pixelguard | Open source, CI-native |
| **Performance/Load** | web-vitals, unlighthouse, autocannon | mitata, artillery, memlab | Production-grade |
| **Accessibility** | eslint-plugin-react-a11y, @accesslint/core | a11y-guard, a11y-check | Zero-browser + regional |
| **Security** | OSV-Scanner, OWASP dep-scan | auditfix, supply-chain-guard | Reachability + malware |
| **CI/CD** | GitHub Actions Matrix + Mergify | @lastest/runner | Sharding + flaky detection |

---

## Excluded Tools (Per Plan Constraint)

| Tool | Reason |
|------|--------|
| Playwright v1.62.1 | Explicitly excluded |
| @axe-core/playwright | Explicitly excluded |
| @lhci/cli | Explicitly excluded |
| Chromatic/Percy | Explicitly excluded |
| npm audit | Superseded by OSV-Scanner/OWASP dep-scan/auditfix |
| k6/JMeter | Superseded by autocannon/artillery |
| webpack-bundle-analyzer | Superseded by rollup-plugin-visualizer |

---

## Next Steps

- **Phase 4:** Finalize tool selections with version pinning
- **Phase 5:** Scaffold package.json, configs, CI workflow, test utilities