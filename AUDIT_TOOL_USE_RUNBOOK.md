# Audit Tool Use Runbook

This guide turns [the tool inventory](AUDIT_TOOL_INVENTORY.md) into a repeatable, evidence-led workflow for this repository. It is a runbook, not a claim that any tool has been run. The repository's package scripts were inspected to ground the commands below.

## Operating rule

Inventory every named tool, check whether it is present and configured, and run it only when it can exercise a real repository surface or provide independent evidence. Do not install or configure an irrelevant framework just to mark it executed. Libraries and browser engines are exercised through their actual runner; they do not necessarily have their own CLI.

Use these statuses for each inventory row:

| Status | Use when |
| --- | --- |
| `EXECUTED` | A bounded, project-relevant run completed and raw evidence was saved. |
| `PARTIALLY AVAILABLE` | The tool is present, but a required feature, driver, browser, device, service, or configuration is missing. Record the available portion. |
| `NOT APPLICABLE` | Repository/platform evidence shows that there is no relevant surface or independent coverage need. |
| `PROJECT-INCOMPATIBLE` | The tool cannot validly exercise this stack. Explain the incompatibility. |
| `BLOCKED WITH EVIDENCE` | A relevant run is prevented by a target, credential, platform, cost, or safety condition. Preserve the failure and the exact blocker. |
| `FAILED DURING EXECUTION` | A relevant run started and failed. Preserve output and investigate; do not relabel it as not applicable. |

For each tool, record: name/version; role; readiness probe; project surface; exact command or runner/configuration; target and environment; result/exit code; evidence path; limitations; and independent verification. A version check alone is not execution evidence.

## Safe execution sequence

1. **Preserve and fingerprint.** Record repository path, branch/HEAD, dirty and untracked files, lock/config hashes, tool versions, OS, and environment-variable names only. Keep raw output unique and non-overwriting. Run intrusive, mutating, or service-backed checks in a disposable copy, isolated worktree, or the designated audit workspace.
2. **Check the configured baseline.** Run `npm run verify:toolchain` and save the full output and exit code. This probes the configured toolchain only; it does not establish that every inventory item was executed.
3. **Run core source checks.** Use `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run test:vitest`. Use `npm run test:coverage` and `npm run test:bench` for coverage and benchmarks where they add evidence. Preserve failures; do not fix product code as part of an audit-only run.
4. **Build and release checks.** Run `npm run verify`, then `npm run build` in the audit copy. Record generated artifact paths and hashes. Run `npm run verify:android-release-assets` only when Android release assets are in scope. Do not publish, sign, or promote artifacts.
5. **Browser and UI checks.** Run configured Playwright suites and browser projects. Use the targeted accessibility, API, visual, and Chromium scripts below. Exercise additional runners only if repository configuration, tests, or a genuine independent coverage need supports them.
6. **Native/mobile checks.** Run Android unit/lint checks first. Connected tests and Maestro/Appium require a local disposable emulator/device and test credentials; never point them at production.
7. **Security, dependencies, and database.** Run local source/lockfile analysis first. Use DAST only against an explicitly local disposable preview. Start local services only as needed and record service/config state.
8. **Performance checks.** Establish a baseline and run bounded tests against a local disposable target. Set request, duration, concurrency, and resource limits. Stop if the target or spend boundary is uncertain.
9. **Reconcile.** Match every inventory item to one terminal status and evidence record. Summarize meaningful findings and blockers; do not equate tool count, a green scan, or a successful build with release or production proof.

## Repository command set

These scripts are present in `package.json`. Capture each command's working directory, start/end time, exit code, and raw output.

| Purpose | Repository command |
| --- | --- |
| Configured toolchain readiness | `npm run verify:toolchain` |
| Full project verification | `npm run verify` |
| Type check / lint | `npm run typecheck`; `npm run lint` |
| Node test runner / Vitest | `npm run test`; `npm run test:vitest` |
| Coverage / benchmark / bundle analysis | `npm run test:coverage`; `npm run test:bench`; `npm run test:perf:bundle` |
| Production build | `npm run build` |
| Playwright E2E | `npm run test:e2e`; `npm run test:e2e:chromium` |
| Accessibility / API / visual E2E | `npm run test:e2e:accessibility`; `npm run test:e2e:api`; `npm run test:visual` |
| Accessibility regional script | `npm run audit:accessibility:regional` |
| Lighthouse | `npm run test:lighthouse` |
| Android unit / connected / lint | `npm run test:android:unit`; `npm run test:android:connected`; `npm run test:android:lint` |
| Maestro / Appium driver readiness | `npm run test:maestro`; `npm run test:appium:drivers` |
| Source, dependency, secret, and architecture analysis | `npm run audit:security`; `npm run audit:dependencies`; `npm run audit:osv`; `npm run audit:secrets`; `npm run audit:gitleaks`; `npm run audit:trivy`; `npm run audit:deadcode`; `npm run audit:architecture` |
| Database / mutation / Android / release | `npm run audit:database`; `npm run audit:mutation`; `npm run audit:android`; `npm run audit:release` |
| Additional analyzers / DAST | `npm run audit:fallow`; `npm run audit:fallow:security`; `npm run audit:strix`; `npm run audit:zap`; `npm run audit:mobsf:status`; `npm run audit:deep` |

Before running a script that installs packages, launches a service, contacts a remote endpoint, or executes lifecycle code, inspect the script and its target. Keep source, customer data, credentials, and paid service limits protected. The visual snapshot update script is not a normal test command; never use it simply to clear a diff.

## Per-category use matrix

### Unit, integration, component, and API tools

| Inventory items | Proper use |
| --- | --- |
| `node:test` via `tsx` | Use the repository's `npm run test` / `npm run test:node` runner. Inspect its selected test files and preserve test output. |
| Vitest, Vitest UI, coverage, benchmarks | Use `npm run test:vitest`, `npm run test:coverage`, `npm run test:bench`; UI mode (`npm run test:ui`) is for interactive diagnosis, not a substitute for a recorded batch run. |
| Testing Library DOM/React/Jest DOM/User Event; happy-dom; fake-indexeddb; MSW; Fast-check; Faker; Chai; Expect-type | These are libraries/helpers. Probe package resolution and config, then account for them through the real test runner. Verify that tests actually import/exercise them. Do not invent standalone CLI invocations. |
| Jest; Mocha; AVA; TAP; Karma | Probe package/config/test files. Run a bounded real project suite only if the runner is configured and applicable; otherwise record evidence for `NOT APPLICABLE` or `PROJECT-INCOMPATIBLE`. Do not create a fake test suite solely to launch each runner. |
| Supertest; Pactum; Testcontainers | Exercise only where API/server contracts or disposable container integration tests exist. Testcontainers requires a local Docker target and bounded cleanup. If the app has no server-side interface in scope, document that evidence. |

### Browser and E2E tools

| Inventory items | Proper use |
| --- | --- |
| Playwright and its API, visual, accessibility, screenshot, real-Supabase suites | Start with `npm run test:e2e`; then run the targeted scripts `npm run test:e2e:chromium`, `npm run test:e2e:accessibility`, `npm run test:e2e:api`, and `npm run test:visual`. Inspect `playwright.config.ts` for projects, base URL, retries, workers, and browser dependencies. Keep real-service tests on local/test credentials. |
| Chromium/Chrome, Firefox, WebKit; desktop/mobile/tablet profiles; system Chrome/Edge and Playwright browser versions | Treat these as runner targets, not separate testing frameworks. Confirm browser installation and configured project/profile, then run the corresponding Playwright project. Record actual browser build and viewport/device emulation. An emulated Safari profile is not proof on physical Safari. |
| Cypress; Nightwatch; TestCafe; WebdriverIO/wdio | Probe runner package, config, and actual test sources. Execute a short project-relevant test if configured. A config file without project tests is not execution evidence. Mark no relevant suite `NOT APPLICABLE` with evidence; don't scaffold duplicate UI tests without a material coverage gap. |
| chrome-debug; chrome-remote-interface; Chrome DevTools Protocol | Use as diagnostic interfaces to an explicitly launched local browser, for a defined check such as console/network/runtime evidence. They are not interchangeable E2E suites and require a target browser session. |

### Accessibility and visual tools

| Inventory items | Proper use |
| --- | --- |
| axe-core Playwright / axe-playwright | Run through configured Playwright accessibility tests (`npm run test:e2e:accessibility`). Preserve violations with URL, selector, impact, and screenshot/context. Review false positives manually. |
| Pa11y / Pa11y CI | Run against a built, local preview URL and a bounded route set. Record URL, standard/config, browser, and output. Do not scan a public or production site without explicit target authorization. |
| Lighthouse / Lighthouse CI | Run `npm run test:lighthouse` for the configured local flow; use LHCI only with its actual config and local/test target. Record device profile, throttling, route, and raw report. Separate accessibility results from performance scores. |
| Lost Pixel; Playwright screenshot comparisons | Use the configured visual test and compare against preserved baselines. Capture diffs and hashes. Never update baselines to make a failing comparison pass. |
| Rollup visualizer; bundle analysis | Use the existing bundle analysis (`npm run test:perf:bundle`) and inspect generated output. Treat bundle size as build evidence, not runtime performance evidence. |
| Regional accessibility scripts | Run `npm run audit:accessibility:regional`; record locales/regions covered and known omissions. |
| Unlighthouse | Inspect `unlighthouse.config.ts`; run the configured script (`npm run test:unlighthouse`) only against local/test pages and review any crawl scope before use. |
| Storybook | Check configuration and actual stories. If configured, use `npm run test:storybook:smoke` and relevant component accessibility/visual checks. If no stories or package exist, report that rather than manufacturing a Storybook surface. |

### Mobile and Android tools

| Inventory items | Proper use |
| --- | --- |
| Appium, UiAutomator2 driver, Maestro, Detox | Probe executable, installed driver, app artifact, test definitions, device, and local-only credentials. Use repository scripts `npm run test:appium:drivers` and `npm run test:maestro`; run Appium/Detox flows only when compatible configured tests and an isolated device exist. Driver listing is a readiness check, not app test execution. |
| Android unit, connected tests, lint | Use `npm run test:android:unit` and `npm run test:android:lint`; use `npm run test:android:connected` only with a verified disposable emulator/device. Record Gradle task, SDK/JDK, device ID, and app build hash. |
| ADB, Android emulator, emulator-5554/5556/5558, AVD names | Use `adb version`, `adb devices -l`, and emulator/AVD inventory as readiness evidence. Validate exact device state before interaction; never assume a named emulator is available or disposable. |
| Gradle, Android Gradle wrapper, Java/JDK | Use the repository wrapper and capture `java -version`, wrapper version, and exact tasks. Prefer wrapper-pinned execution over a global Gradle binary. |
| aapt, aapt2, apksigner, zipalign, dexdump, apkanalyzer | Inspect a generated disposable APK/AAB for manifest, SDK levels, permissions, package contents, signing metadata, and alignment. These checks are artifact analysis, not source tests. Never re-sign a release artifact. |
| keytool, jarsigner | Use only to inspect public signing metadata/certificate details. Never print keys, passwords, private material, or secret-bearing command arguments. |
| Capacitor CLI, native-run | Use `npx cap` only where the configured Capacitor project and Android target exist. Check generated sync/build changes and keep them in the audit copy. Native-run needs an explicit local target. |
| ChromeDriver, GeckoDriver, EdgeDriver | Probe only when the chosen runner requires that driver. Match driver and browser versions. Do not install drivers solely because they are listed. |
| iOS/Xcode native tooling | On Windows, classify native iOS execution as platform-blocked unless an authorized macOS runner is available. Safari emulation is not native iOS validation. |

### Load and performance tools

| Inventory items | Proper use |
| --- | --- |
| Artillery, Autocannon, k6 | Use only against a local disposable service or explicitly authorized test target. Start with a low request rate, short duration, bounded virtual users/concurrency, and explicit stop conditions. Save scripts, target, parameters, results, and resource metrics. Never point at production or a third party by default. |
| Vitest benchmarks | Use `npm run test:bench` for stable, local microbenchmarks. Record runtime, hardware, warmup, repetitions, and variance; do not present a microbenchmark as end-to-end latency. |
| Lighthouse performance audits | Use the same local build/route and recorded device/throttle profile for comparisons. Preserve raw reports; repeat only to understand variance. |
| Bundle-size/performance analysis; Rollup visualizer | Use `npm run test:perf:bundle`; compare output to the same build baseline and explain material module/chunk changes. This does not replace load testing. |

### Security and static analysis tools

| Inventory items | Proper use |
| --- | --- |
| Semgrep | Use `npm run audit:security`; record ruleset/version, analyzed paths, exclusions, and findings. Validate candidates in source before assigning severity. |
| Gitleaks | Use `npm run audit:gitleaks`; distinguish current-tree from history scanning. Preserve redacted evidence only; do not print secret values. |
| Trivy | Use `npm run audit:trivy` for applicable filesystem/dependency/config scans. Container scans require a local image; do not pull arbitrary images without reviewing provenance and network impact. |
| OSV-Scanner | Use `npm run audit:osv` against the lockfile/source. Preserve database/version and dependency resolution context. |
| npm audit; audit-ci; Snyk | Use `npm run audit:dependencies` for npm audit. Probe audit-ci config and run if configured. Snyk may require network/auth and can transmit dependency metadata; gate egress, policy, and cost first. Lack of authorization is a documented blocker, not a reason to expose source. |
| Secretlint; custom secret scanner | Use the repository script `npm run audit:secrets`; probe Secretlint package/config and run through the applicable configured path. Redact secret values in reports and terminal evidence. |
| OWASP ZAP | Use `npm run audit:zap` only after confirming its target is the designated local preview (the prompt names `http://127.0.0.1:4174`). Verify target before scan; use bounded passive/baseline mode unless a more intrusive mode is explicitly authorized for a disposable target. |
| MobSF | Check readiness with `npm run audit:mobsf:status`; use a disposable Android artifact and local service only. Record APK hash and service version; do not upload customer or release binaries externally. |
| Strix AI security testing | Use `npm run audit:strix` only after reviewing target/scope and data-egress behavior. Model-backed scanning requires authorized credentials and bounded spend; otherwise preserve readiness/block evidence. |
| Fallow | Use `npm run audit:fallow` and `npm run audit:fallow:security`; preserve reports. Follow prompt-prescribed JSON output flags only after confirming live CLI help supports them. |
| Dependency Cruiser | Use `npm run audit:architecture`; inspect rules/config and distinguish intentional cycles from defects. |
| Knip | Use `npm run audit:deadcode`; validate apparent unused exports/files against dynamic loading, scripts, and platform entry points. |
| Android lint | Use `npm run test:android:lint` or `npm run audit:android` for Android source/config. Treat findings as candidates requiring source review. |
| CSP/security scripts; TypeScript compiler; ESLint | Use the existing scripts and inspect their rule/config coverage. TypeScript/lint are static checks; they do not prove runtime security. |
| Deep audit orchestrator | Use `npm run audit:deep` after reading `scripts/audit-deep.ts` and its child commands. Ensure it does not duplicate destructive work, contact unauthorized targets, or overwrite evidence. |

### Build, database, and environment tools

| Inventory items | Proper use |
| --- | --- |
| TypeScript / tsc; tsx; Vite | Exercise through `npm run typecheck`, test scripts, and `npm run build`. Record build mode and environment names, never secret values. |
| Tailwind CSS | Verify through the real Vite build and CSS output. Do not invent a standalone scanner if no configured tool exists. |
| Supabase CLI; PostgreSQL; PostgREST; Realtime; Auth; Storage; Edge Runtime; Studio; Mailpit; Kong | Inspect `supabase/config.toml` and `docker-compose.supabase.yml`. Start only the local stack required for the check; then use `npm run audit:database` / `supabase db lint --local`, local migrations/RLS/API tests, and service health checks. Record which services actually started and their ports. Never target a production project. |
| Docker / Docker Compose | Check `docker version`, `docker compose version`, and `docker compose config` before startup. Review mounts, ports, env references, and images. Use isolated local services and clean up only resources created for this audit. |
| Node.js / npm | Record versions and lockfile/package-manager consistency. The repository uses npm scripts and `package-lock.json`; avoid switching package managers. Before installing, inspect lockfile and lifecycle scripts; prefer a script-suppressed install where compatible. |
| Python; .NET | Probe version and relevance to actual scripts/tools. Use only for identified project tooling or service dependencies; otherwise record `NOT APPLICABLE` with evidence. |
| Git | Capture status, branch, HEAD, tracked diff, untracked files, relevant ignored files, tags/remotes/history as read-only evidence. Do not reset, clean, stash, rebase, commit, or push as part of the audit. |

## Evidence and completion checklist

- [ ] Every inventory item has an individual status, including tools that are libraries, browser targets, profiles, services, drivers, or helpers.
- [ ] Every executed tool has a relevant command/runner, target, version, exit code, and raw evidence path.
- [ ] Readiness-only checks are labeled as probes, not executions.
- [ ] Missing tools were assessed for actual applicability; repair attempts are bounded and recorded.
- [ ] External/cloud/model-backed tools passed the data-egress and spend gate before use.
- [ ] DAST, load, mobile, and database checks used verified local/disposable or explicitly authorized targets.
- [ ] Failures remain visible and are not changed to `NOT APPLICABLE` for convenience.
- [ ] Findings were manually validated, deduplicated, severity-ranked, and linked to evidence.
- [ ] No product fix, snapshot update, signing, publish, deployment, or production mutation occurred as an implicit part of testing.
- [ ] Final tool totals reconcile to the per-tool evidence matrix and state/coverage records.
