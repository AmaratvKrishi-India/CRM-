# Phase 3 recovery verification — 2026-09-01

## Repaired blockers

- Removed the unavailable `@accesslint/core@^1.0.0` declaration and other unverified, unused tool declarations from the active package manifest.
- Added the dependencies required by the actual Vitest configuration and setup: `vitest`, `@vitest/ui`, `happy-dom`, Testing Library, `expect-type`, and `tsd`.
- Made bundle visualization analysis-only by removing its static import from the production Vite configuration.
- Updated the fake IndexedDB test setup for fake-indexeddb v6's exported factory API.
- `npm ci --ignore-scripts --no-audit` completes successfully (352 packages) and `npm run typecheck` and `npm run build` pass.

## Current evidence

The Phase 1–3 test files are written for Node's test runner. The appropriate command was run:

```text
npx tsx --test tests/accessScopeIsolation.test.ts tests/phase2Authentication.test.ts tests/phase3Synchronization.test.ts
```

Result: 25 passed, 0 failed, 0 skipped, 0 todo (Phase 1: 3; Phase 2: 8; Phase 3: 14).

## Phase 3.1 recovery result

The actual maintained suite is the root `tests/*.test.ts` Node test-runner suite. `npm test` now invokes it through `tsx --test`; Vitest fixtures remain separate and are not mixed into this runner. The previous Vitest glob was a configuration defect, not a synchronization defect: it loaded Node `node:test` suites under a global Vitest Dexie mock and also discovered obsolete generated fixtures whose imports no longer match the source tree.

Fresh clean verification passed:

```text
npm ci --ignore-scripts --no-audit     PASS (355 packages)
npm test                               PASS (155 passed, 1 emulator-gated skip)
npm run typecheck                      PASS
npm run build                          PASS
```

The aggregate suite includes the Phase 1 access-scope regression, Phase 2 authoritative-authentication regression, all 14 Phase 3 synchronization cases, background-sync mutex/retry coverage, real Dexie restart and backup/restore coverage, and 15 local PostgreSQL schema/RLS/sync checks. The multi-emulator test cleanly skips when its three-emulator prerequisite is absent; no device or screenshot was used.

No production service, database, or configuration was mutated. Graft was not installed because it is optional documentation tooling and unavailable on this host; it does not affect runtime, build, or test correctness.
