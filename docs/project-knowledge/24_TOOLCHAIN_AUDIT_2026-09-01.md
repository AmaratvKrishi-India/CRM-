# Toolchain Audit — 2026-09-01

This is an environment audit only. It does not represent release verification and no production system was accessed or changed.

## Verified project tooling

| Category | Tool / component | Required version | Installed / observed version | Status | Used by | Command |
| --- | --- | --- | --- | --- | --- | --- |
| Core | Node.js | CI: 26; project has no `engines` pin | 26.5.0 | Valid | all npm workflows | `node --version` |
| Core | npm / npx | Node 26 bundled version | 11.17.0 | Valid | dependency install and local CLIs | `npm --version` |
| Core | Git | no project pin | 2.55.0.windows.2 | Valid | source control | `git --version` |
| Frontend | TypeScript | `^7.0.2` | 7.0.2 | Valid | typecheck/build | `npm run typecheck` |
| Frontend | Vite | `^8.2.2` | 8.2.2 | Valid | web build / local server | `npm run build` |
| Frontend | React / Tailwind | package-lock-pinned | installed through `npm ci` | Valid | app build | `npm run build` |
| Testing | tsx / Node test runner | `^4.23.12` | 4.23.12 | Available | root `tests/*.test.ts` | `npm run test:node` |
| Testing | Vitest / happy-dom / fake-indexeddb | package-lock-pinned | Vitest 4.1.11 | Runner available; configured tests blocked | services, DB, integration and visual tests | `npm run test:vitest` |
| Testing | Playwright | `^1.62.1` | 1.62.1; Chromium, Firefox and WebKit browser bundles listed | Ready to start E2E when requested | `e2e/` | `npx playwright test` |
| Database | Docker / Compose | no project pin | Docker 29.7.2 / Compose 5.4.0 | CLI valid; daemon unavailable to this session | local compose stack | `docker compose -f docker-compose.supabase.yml config --quiet` |
| Database | Supabase CLI | external CLI required by CI and local config | not available as a direct command; `npx supabase` did not complete in this session | Blocked | migrations, RLS, realtime | `npx supabase status` |
| Android | Java / JDK | CI: 17; AGP 8.13 requires a compatible JDK | not on PATH; `JAVA_HOME` unset | Blocked | Gradle / Android builds | `android\\gradlew.bat --version` |
| Android | Android SDK platform 36 / build tools / platform-tools / emulator | compile/target SDK 36 | SDK root configured in `android/local.properties`, but inaccessible to this session; not on PATH | Blocked | Android build and AVD tests | `adb devices`, `emulator -list-avds` |
| Android | Gradle wrapper | wrapper in `android/gradle/wrapper` | unable to start without Java | Blocked | Android builds/tests | `android\\gradlew.bat --version` |
| Android E2E | Maestro | configured by `maestro.config.yaml` and CI | not installed | Blocked | Android Maestro flows | `maestro --version` |
| Accessibility / visual / performance | Playwright, Lighthouse, Lost Pixel, Unlighthouse, local TypeScript scripts | configuration exists | Playwright available; other dedicated CLIs are not package dependencies | Pending/blocked by their respective tooling | CI and `scripts/` | see CI workflow |
| Security | local TypeScript secret/dependency/CSP/OWASP scripts | repository scripts | source present; no npm scripts expose them | Pending | CI security jobs | `tsx scripts/<name>.ts` |

## Verification results

- `npm ci`: **PASS**. It installed 355 packages. npm warned that the `esbuild` install script still needs explicit approval in the local npm policy, but Vite built successfully.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**.
- `npm run lint`: **FAIL**. ESLint is now installed as a project dependency and the config syntax/ES-module loading issue was repaired, but the config references the unavailable `eslint-plugin-react-a11y` package (and related TypeScript/React plugins are not declared). No application code was changed.
- `npm run test:type`: **FAIL**. `tsd` expects `index.d.ts`; this is an application rather than a declaration-package, so the configured command is not presently suitable.
- Minimal Vitest execution: **FAIL** before test execution. `tests/utils/phone-utils.test.ts` imports missing `src/utils/phone`; `tests/utils/date-utils.test.ts` has a syntax error at line 74. These are test/source defects, not runner-install defects. Vitest also warns that `poolOptions` is obsolete in v4 and that `__dirname` in `vitest.config.ts` is not compatible with Vite's planned native config loader.
- Docker compose parsing: **PASS** (with a warning that Compose `version` is obsolete). Docker daemon access is denied to this session, so the local database stack was not started.
- Environment-variable names from `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV`, and `VITE_APP_VERSION` are present in `.env.local`. Values were not inspected or recorded.

## Test ownership and required services

- Node test runner (`tsx --test`): root-level legacy/current test files.
- Vitest: service, repository, utility, Dexie and local integration tests. Its configuration intentionally excludes `realSupabasePostgres.test.ts` and `multiDeviceSync.test.ts`.
- Playwright: browser E2E, mobile viewport, accessibility and visual-regression specs. Browser bundles are installed.
- Maestro: Android E2E flows. It requires a compatible JDK, Android SDK/emulator, an AVD, and the Maestro CLI.
- Local Supabase: `supabase/config.toml` uses API port 15432 and database port 15433; migrations and `seed.sql` are enabled. It requires a working Docker daemon and Supabase CLI. The alternate compose stack is not equivalent to `supabase start` and currently cannot be validated while the daemon is inaccessible.

## Exact blockers before release testing

1. Restore Docker daemon access for this account/session, then validate `docker info`, local Supabase startup, migrations, RLS and realtime.
2. Install/configure JDK 17 and set `JAVA_HOME`; expose or set `ANDROID_HOME`/`ANDROID_SDK_ROOT` for the installed SDK. Install/confirm platform 36, build-tools, platform-tools, emulator and the three intended AVDs. No physical device is required.
3. Install Maestro only after the Android prerequisites are working, then list its version and validate the configured flows against an AVD.
4. Add the missing project-local `eslint` dependency (the audit session's two network installation attempts did not change the package), then run `npm run lint`.
5. Correct the stale/broken type-test configuration and the two observed Vitest test defects before using those suites as gates. Do not change tests merely to obtain a passing audit.
6. Make a project-local, pinned Supabase CLI available (or repair access to the approved `npx supabase` package) before running database tests.

## Resume update

- Project-local `eslint@10.9.1` was installed and lockfile updated.
- `eslint.config.mjs` was minimally repaired for a syntax error and ESM `require` loading. Lint remains blocked by undeclared/unavailable plugins.
- Android Studio's bundled JDK 21 was confirmed present. Gradle still cannot download its pinned wrapper distribution because outbound network access is denied.
- A system-wide JDK installation via Chocolatey could not complete because this session is not an administrator shell.
- Supabase CLI installation completed, but its first-run telemetry file write is denied by the sandbox.

## Phase 3.2 verification update

| Check | Result | Evidence / blocker |
| --- | --- | --- |
| `npm ci` | PASS | 406 packages installed; only the existing esbuild install-script approval warning remains. |
| `npm run typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `npm run build` | PASS | Vite production build completed successfully. |
| `npm run test:node` | PASS | 155 passed, 0 failed, 1 intentionally skipped multi-device case because ADB found 0 emulators. |
| `npm run lint` | FAIL | Config now parses, but references unavailable `eslint-plugin-react-a11y`; TypeScript ESLint 8 also rejects TypeScript 7, so no blind downgrade was applied. |
| Supabase CLI | READY (CLI only) | `SUPABASE_TELEMETRY_DISABLED=1 supabase --version` => 2.116.0. `supabase status` is blocked by Docker access. |
| Docker / database / RLS | BLOCKED | Docker daemon pipe access denied; no local stack was started in this session. Existing Node tests use controlled local fixtures and are not a substitute for daemon verification. |
| Android JDK | BLOCKED | Android Studio JDK 21 executes, but no system JDK 17 was installed; Chocolatey requires an administrator shell. |
| Gradle | BLOCKED | Wrapper distribution 8.14.3 is not cached and outbound access is denied. |
| ADB / AVD | BLOCKED | SDK executables exist, but Windows returns `Access is denied` when launching `adb.exe` and `emulator.exe`; AVD count could not be verified. |
| Maestro | BLOCKED | CLI is not installed. |

### Host actions required

An administrator must install/configure JDK 17 (or explicitly approve the Android Studio JDK 21 compatibility decision), grant this user access to `C:\Users\PC\AppData\Local\Android\Sdk`, and ensure Docker Desktop's named pipe is accessible. A network-enabled shell must download the Gradle 8.14.3 wrapper distribution and install Maestro. These host-level actions cannot be safely simulated from this restricted session.

## Phase 3 synchronization verification

## Final environment recovery attempt

- Fresh `npm ci`: **PASS** after the earlier transient executable lock cleared.
- `npm test`: **PASS** — 156 tests, 155 passed, 0 failed, 1 Android multi-device test skipped by its own prerequisite guard because ADB could not execute.
- `npm run typecheck`: **PASS**; `npm run build`: **PASS**.
- ESLint configuration was replaced with a valid flat config using the maintained `@typescript-eslint` packages; the obsolete `eslint-plugin-react-a11y` reference was removed. `npm run lint` remains **BLOCKED** because the installed parser/plugin explicitly does not support TypeScript 7.0. Resolving this requires either a future TypeScript-7-compatible typescript-eslint release or an explicitly approved TypeScript downgrade; neither was fabricated.
- `SUPABASE_TELEMETRY_DISABLED=1 supabase --version`: **PASS** (2.116.0). `supabase status`: **BLOCKED** by Docker named-pipe access.
- `docker version` / `docker compose version`: client **PASS**; server access **BLOCKED** (`permission denied ... docker_engine`).
- Android Studio JDK 21 executes. `JAVA_HOME` can be pointed at its `jbr`, but Gradle 8.14.3 is uncached and network access is denied. SDK `adb.exe` and `emulator.exe` exist but Windows returns `Access is denied`; AVD and Maestro execution are therefore blocked.

### Exact host actions still required

Run these from an elevated, network-enabled Windows session: grant the current user access to Docker Desktop's `\\.\pipe\docker_engine`; grant execute/read access to `C:\Users\PC\AppData\Local\Android\Sdk` and add its `platform-tools`, `emulator`, and `cmdline-tools\latest\bin` directories to PATH; install JDK 17 or explicitly approve Android Studio JDK 21 for AGP 8.13; run the Gradle wrapper once to cache 8.14.3; install Maestro and create three Android Studio AVDs (ADMIN, AGENT A, AGENT B). For lint, wait for TypeScript-7 support in typescript-eslint or approve a project TypeScript downgrade after compatibility review.

- `npm test`: **PASS** — 156 tests, 155 passed, 0 failed, 1 intentionally skipped because three Android emulators were unavailable. The passing suites cover account switching, logout/revocation, role and assignment changes, cursor/outbox/push/pull isolation, retry/backoff, conflict resolution, delete propagation, backup/restore, mutex behavior, pruning, Phase 1/2 regressions, and local-fixture PostgreSQL/RLS assertions.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**.
- Fresh `npm ci` attempt: **FAIL** with Windows `EPERM` unlinking an in-use TypeScript executable; a subsequent `npm install` restored the working dependency tree. This is a host/file-lock issue, not a dependency-resolution pass.
- `npm run lint`: **FAIL** — `eslint-plugin-react-a11y` is not published/declared in the project, and the available TypeScript ESLint release rejects TypeScript 7. No incompatible downgrade or test weakening was applied.
- Docker client/Compose versions are executable, but `docker info` and `supabase status` cannot access the Docker named pipe. Database/RLS/realtime are therefore **BLOCKED** as environment gates, even though deterministic local-fixture tests pass.
- Android Studio JDK 21 executes. ADB/emulator binaries exist but return Windows `Access is denied`; Gradle cannot fetch wrapper 8.14.3 under the current network policy. Maestro and AVD execution remain blocked.

## Safety record

- Production mutations: none.
- Release tests: not run.
- Physical devices: not used.
- Screenshots: not used.
- Commits, pushes and deployments: none.

## Fresh Phase 3 blocker verification

## Fresh multi-device verification update

- Elevated ADB now reports three online emulators: `emulator-5554`, `emulator-5556`, and `emulator-5558`.
- The multi-device harness detects all three and Agent/Admin Step 1 reaches the dashboard. The run then remains attached to multiple Node worker processes after beginning Step 2 and does not produce a complete test result or reach Agent B deterministically. This is not counted as a pass or as proof of the reported Agent B fix.
- The current UI selector remains semantically valid because `SalesDashboard.tsx` renders `Lucknow Field Sales Dashboard`, which contains the expected text.
- No synchronization application code was changed in this verification attempt.

Date: 2026-09-01. Branch: `codex/release-readiness`. HEAD: `10f111d5683b538b5b00dadc07ccaf1673fe4a3a`.

- Node 26.5.0, npm 11.17.0, TypeScript 7.0.2, Vitest 4.1.11, Vite 8.2.2, Playwright 1.62.1, Capacitor 8.5.0, Supabase CLI 2.116.0, Docker client 29.7.2 and Compose 5.4.0 are present.
- `npm run typecheck`: PASS. `npm test`: PASS (156 tests; 155 passed, 1 Android prerequisite skip). `npm run build`: PASS.
- `npm run lint`: FAIL: `@typescript-eslint` explicitly rejects TypeScript 7.0. The obsolete `eslint-plugin-react-a11y` reference has been removed; no TypeScript downgrade was applied.
- Fresh integration/RLS Vitest command fails before execution because `supabase-test` and legacy `ConflictResolver` imports are absent, and `securityRlsIsolation.test.ts` contains no Vitest suite. These are repository test-infrastructure defects and were not converted to skips.
- `npm ci` was re-attempted; this session returned no usable completion evidence after prior Windows executable-lock errors, so it is not claimed as a fresh PASS.
- Supabase CLI version works with `SUPABASE_TELEMETRY_DISABLED=1`, but `supabase status` is blocked by Docker named-pipe permission. Docker client works; server access is denied.
- Android Studio JDK 21 executes. ADB/emulator binaries and three emulator processes are present, but direct executable calls still return Windows `Access is denied`; AVD usability cannot be claimed. Maestro is not installed. Gradle 8.14.3 is uncached and network access is denied.
