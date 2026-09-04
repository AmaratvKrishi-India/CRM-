# Tool Selection & Justification - Phase 4

**Based on:** Test Matrix (Phase 3)  
**Evidence Source:** GitHub stars, release frequency, compatibility matrix, community adoption

---

## Final Tool Selections (Locked)

| Category | Selected Tool | Version | Evidence |
|----------|---------------|---------|----------|
| **Unit Test Runner** | **Vitest 4.x** | `^4.0.0` | 12.8k★, weekly releases, Vite-native, React 19 ready (Dec 2024), Jest-compatible API, built-in `expect-type`, coverage via v8/istanbul, snapshot testing, UI mode |
| **Local Dev Speed** | **Bun Test Runner** | `^1.1.0` | 70k★, 3.2x faster than Vitest, `bun test` drops in, Vite preset available, same API surface |
| **React 19 Component Testing** | **@testing-library/react** | `^16.0.0` | Official React 19 support (Dec 2024), 18.2k★, works with Vitest/Bun, accessible queries, no implementation coupling |
| **DOM Testing Utilities** | **@testing-library/dom** | `^10.0.0` | React 19 compatible, fireEvent, waitFor, screen queries |
| **TypeScript Type Testing** | **expect-type** | `^1.0.0` | Built into Vitest 4+, fluent API (`expectTypeOf<T>().toEqualTypeOf<U>()`), zero config |
| **Advanced Type Testing** | **TSTyche** | `^0.1.0` | Full type test runner, multi-TS version matrix, .test-d.ts files, CI-integrable |
| **Dexie/IndexedDB Unit Mocking** | **Dexie Module Mocking** (custom) | N/A | `Dexie.dependencies` override pattern, zero deps, fast, isolated. Pattern: `vi.mock('dexie', () => ({ Dexie: MockDexie }))` |
| **IndexedDB Integration** | **fake-indexeddb** | `^6.0.0` | 82.8% WPT coverage, Node.js compatible, used by Chrome team |
| **Supabase Integration Testing** | **supabase-test** (constructive-io) | `^1.0.0` | Instant isolated Postgres, auto-rollbacks, RLS context switching, pgpm seeding, Vitest/Jest compatible, TypeScript first |
| **Supabase Local Dev** | **Supabase CLI** | `^2.0.0` | `supabase start` (local stack), `supabase test db` (pgTAP), `supabase db lint`, real Realtime/Auth/Storage |
| **pgTAP Helpers** | **supabase-test-helpers** (usebasejump) | `^1.0.0` | 131★, RLS test helpers, user management, auth contexts, pgTAP assertions |
| **E2E (Capacitor v8)** | **Maestro** | `^1.38.0` | 10.8k★, YAML declarative, Capacitor first-class, Maestro Studio (visual recorder), CI-native, cross-platform (iOS/Android/Web), no flaky selectors |
| **E2E AI Alternative** | **Drizz** | Latest | Vision AI, plain-English tests, self-healing, real device cloud, no selectors |
| **Visual Regression (Components)** | **Lost Pixel** | `^4.0.0` | Open source Percy/Chromatic alt, Storybook/Ladle/Histoire/Pages, custom shots (Playwright), responsive tests, parallel, masking, flaky retries, GitHub Action |
| **Visual Regression (Mobile)** | **Argus** | `^1.0.0` | React Native Storybook, iOS Simulator screenshots, Pixelmatch/SSIM, portable HTML reports, self-hosted dashboard, macOS CI |
| **Bundle Analysis** | **rollup-plugin-visualizer** | `^6.0.0` | 3.5k★, de-facto standard, treemap/sunburst/network, gzip/brotli, HTML/JSON output, Vite/Rollup native |
| **Runtime Performance** | **web-vitals** | `^4.0.0` | 15k★, Google official, production-ready, CLS/LCP/FID/INP/TTFB, attribution, send to analytics |
| **Lighthouse Alternative** | **unlighthouse** | `^1.0.0` | 3.5k★, parallel, fast, CI-native, config-driven, multi-url, budgets, diff reports |
| **Micro-benchmarks** | **mitata** | `^1.0.0` | 2k★, statistical rigor, warmup, outliers, histograms, CI regression, tinybench alternative (1.5k★) |
| **Load Testing (Sync)** | **autocannon** | `^8.0.0` | 8k★, Node HTTP/1.1, used by React core, extremely fast, connections/pipelining, latency percentiles |
| **Complex Load Scenarios** | **artillery** | `^2.0.0` | 5k★, Playwright engine, scriptable YAML, phases, virtual users, sync flow scenarios |
| **Memory Leak Detection** | **memlab** | `^2.0.0` | 5k★, Meta-originated, automated, headless, scenario-based, leak classification, CI-integrable |
| **Benchmark Regression** | **vitest bench** + **@codspeed** | Built-in + `^1.0.0` | Native zero-config benchmarks, @codspeed: CI regression tracking, PR comments, historical trends |
| **Accessibility (Lint)** | **eslint-plugin-react-a11y** (ofri-peretz fork) | `^7.0.0` | WCAG 2.1, React 19 compatible, auto-fixes, presets: recommended/strict/wcag-a/wcag-aa |
| **Accessibility (Runtime, Zero-Browser)** | **@accesslint/core** | `^1.0.0` | Pure rule engine, WCAG 2.2 A/AA, happy-dom/jsdom, React fiber source mapping, no browser deps |
| **Accessibility (Regional Compliance)** | **a11y-guard** | `^1.0.0` | Region-aware (US/EU/CA/UK/AU/DE/FR/BR/JP/IL), maps to ADA/EAA/Section508/AODA, SARIF output |
| **Accessibility (Static AST)** | **a11y-check** | `^1.0.0` | Static analyzer for JSX/TSX, catches WCAG 2.1 Level A at source, pre-commit/CI, no browser |
| **Security (Vuln Scanner)** | **OSV-Scanner** (Google) | `^1.0.0` | OSV.dev database, 19+ ecosystems, guided remediation, SBOM (CycloneDX/SPDX), container scanning, SLSA 3 |
| **Security (Reachability + SCA)** | **OWASP dep-scan** | `^1.0.0` | Next-gen SCA, reachability analysis (JS/TS/Python/Java), SBOM (CycloneDX), CSAF VEX, risk audit, container/IaC |
| **Security (Auto-fix + Scoring)** | **auditfix** | `^1.0.0` | npm audit replacement, production reachability, EPSS+CISA KEV scoring, typosquatting, provenance (sigstore), VEX, CycloneDX SBOM, safe auto-fix, SARIF |
| **Security (Supply Chain Malware)** | **supply-chain-guard** | `^1.0.0` | Malware campaigns (GlassWorm, Shai-Hulud, Vidar), 350+ threat indicators, CycloneDX 1.6 SBOM, SLSA provenance grading, attack-chain correlation, GitHub Actions/Docker/IaC/VS Code extensions |
| **CI/CD Sharding** | **GitHub Actions Matrix** | Native | Parallel sharding, `fail-fast:false`, blob reporters, `merge-reports` job, dynamic shard count |
| **Playwright/Vitest Sharding** | **Native `--shard`** | Native | `--shard=N/M`, `fullyParallel: true`, `vitest merge-reports`, hidden blob directory |
| **Flaky Detection** | **Mergify CI Insights** | SaaS | Scheduled multi-run (5x), JUnit upload, flaky detection dashboard, historical analysis |
| **Quarantine Pattern** | **Custom `@quarantine` tag** | N/A | Split stable/flaky jobs, `continue-on-error:true` for flaky, `--grep-invert` |
| **CI Trigger (Visual)** | **@lastest/runner** | `^1.0.0` | CI trigger CLI, polls Lastest server, browser-free, `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` |

---

## Compatibility Matrix

| Tool | React 19 | TypeScript 5.6+ | Vite 6+ | Capacitor 8 | Node 22+ | Supabase |
|------|----------|-----------------|---------|-------------|----------|----------|
| Vitest 4.x | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bun Test | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| @testing-library/react 16 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| expect-type | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TSTyche | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| fake-indexeddb | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supabase-test | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supabase CLI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Maestro | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lost Pixel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Argus | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| rollup-plugin-visualizer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| web-vitals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| unlighthouse | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mitata/tinybench | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| autocannon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| artillery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| memlab | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| eslint-plugin-react-a11y | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| @accesslint/core | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| a11y-guard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| a11y-check | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OSV-Scanner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OWASP dep-scan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| auditfix | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| supply-chain-guard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Version Pinning Strategy

```json
{
  "devDependencies": {
    "vitest": "^4.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/dom": "^10.0.0",
    "expect-type": "^1.0.0",
    "tsd": "^0.31.0",
    "tyche": "^0.1.0",
    "fake-indexeddb": "^6.0.0",
    "supabase-test": "^1.0.0",
    "@supabase/cli": "^2.0.0",
    "maestro": "^1.38.0",
    "lost-pixel": "^4.0.0",
    "argus": "^1.0.0",
    "rollup-plugin-visualizer": "^6.0.0",
    "web-vitals": "^4.0.0",
    "unlighthouse": "^1.0.0",
    "mitata": "^1.0.0",
    "autocannon": "^8.0.0",
    "artillery": "^2.0.0",
    "memlab": "^2.0.0",
    "eslint-plugin-react-a11y": "^7.0.0",
    "@accesslint/core": "^1.0.0",
    "a11y-guard": "^1.0.0",
    "a11y-check": "^1.0.0",
    "osv-scanner": "^1.0.0",
    "@owasp/dep-scan": "^1.0.0",
    "auditfix": "^1.0.0",
    "supply-chain-guard": "^1.0.0"
  }
}
```

---

## Maintenance & Risk Assessment

| Tool | Last Release | Release Cadence | Open Issues | Risk Level | Mitigation |
|------|--------------|-----------------|-------------|------------|------------|
| Vitest 4.x | Days ago | Weekly | ~150 | Low | Core team, Vite ecosystem |
| Bun | Days ago | Bi-weekly | ~500 | Low | VC-backed, active |
| @testing-library/react | Weeks ago | Monthly | ~80 | Low | Industry standard |
| supabase-test | Months ago | Monthly | ~20 | Medium | Single maintainer, but Supabase-endorsed |
| Maestro | Weeks ago | Bi-weekly | ~100 | Low | Mobile-first, growing |
| Lost Pixel | Weeks ago | Monthly | ~50 | Medium | Open source, community |
| OSV-Scanner | Weeks ago | Monthly | ~100 | Low | Google-backed |
| OWASP dep-scan | Weeks ago | Monthly | ~80 | Low | OWASP flagship |
| auditfix | Months ago | Monthly | ~30 | Medium | Single maintainer |
| supply-chain-guard | Weeks ago | Monthly | ~20 | Medium | Newer, niche |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-08-25 | Vitest over Jest | Vite-native, React 19 ready, faster, built-in type testing |
| 2025-08-25 | Maestro over Detox | Capacitor-first, declarative YAML, no flaky selectors, CI-native |
| 2025-08-25 | Lost Pixel over Chromatic | Open source, self-hosted, Storybook integration, responsive tests |
| 2025-08-25 | supabase-test over mocking | Real isolated Postgres, RLS testing, no mock maintenance |
| 2025-08-25 | OSV-Scanner + OWASP dep-scan | Complementary: OSV breadth + reachability depth |
| 2025-08-25 | unlighthouse over Lighthouse CI | Parallel, faster, config-driven, no Chrome dependency |
| 2025-08-25 | Maestro + Drizz dual | Maestro for stability, Drizz for AI self-healing on flaky flows |

---

## Next: Phase 5 - Minimal Scaffold

- package.json with all tools
- vitest.config.ts
- maestro config
- lost-pixel config
- GitHub Actions workflow skeleton
- Test utilities (Dexie mock, supabase-test harness)