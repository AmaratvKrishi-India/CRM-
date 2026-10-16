# Post-release dependency repair — 2026-10-16

The released main commit `f6f9d7e` has four moderate npm entries for one advisory, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). The affected chain is the development-only Snyk npm wrapper → global-agent / roarr → sprintf-js. Production dependency audit reports zero findings.

Registry checks still report Snyk 1.1308.1 and sprintf-js 1.1.3 as latest. Neither supplies a patched npm chain; npm suggests an inappropriate Snyk downgrade. No override, downgrade, audit exception or threshold change was introduced.

## Repair

Remove the optional Snyk npm wrapper from devDependencies and regenerate the lockfile with npm. No retained dependency version changed; 34 lockfile entries disappeared, with npm also removing `libc` metadata from 70 retained optional-platform entries. A clean `npm ci` succeeded. Both full and production-only audits then reported **zero vulnerabilities**. `npm ls snyk roarr sprintf-js --all` returned an empty tree.

Snyk is not imported by CRM source, build code or CI. Its only executable use is the optional Windows manual audit. That audit now calls an independently installed official `snyk.exe` on PATH; the toolchain inventory labels it standalone. Install an exact approved version from the [official Snyk CLI releases](https://github.com/snyk/cli/releases), verify its published checksum and run `snyk.exe --version` before use. Do not reinstall the npm wrapper. No standalone binary or Snyk authentication was installed or tested in this cloud task. Windows execution remains unverified here.

The optional manual Snyk step already skipped when unavailable. Its missing-tool result remains explicit. The mandatory CI `npm audit --audit-level=high` gate, secret scan and release checks remain enabled and unchanged in the workflow.

## Reachability and shipped artifacts

The old wrapper can fall back to its bundled legacy JavaScript CLI. Roarr's enabled logging path imports sprintf-js and formats log messages, so the dependency was reachable in developer audit tooling; we do not claim it was unreachable. Exploitation requires control of a format string with excessive precision. No exploit was run.

The old packages are marked development-only in the lockfile and have no application imports. Vite bundles browser modules from the application import graph; Capacitor packages that generated `dist` directory. The production dependency tree and captured web bundles contain no dependency path to Snyk. No Android artifact was downloaded or rebuilt in this task; exact binary-forensic validation of an already published APK was not performed. Android real-backend synchronization is excluded by the owner.

The historical audit JSON remains unchanged under `docs/ai-toolkit/dependency-audit/`. The new zero-finding result applies to this candidate branch until merged; released main's four moderate findings are not declared fixed in advance. No residual-risk acceptance is needed for the removed npm chain once this candidate is released. Other advisor findings are documented separately.

## Secret-scanner reproducibility

Installing the repository toolkit under ignored `work/` exposed a scanner-scope bug: the CRM scanner read upstream SkillSpector test fixtures and task captures, producing false positives. `work/**` now joins the existing generated-dependency exclusions, and the whole task scratch directory is Git-ignored. CRM source, scripts, tests and docs remain scanned. Detection rules, failure severities and CI commands are unchanged. A synthetic positive-control scan verifies that the high-severity gate still rejects a credential-shaped fixture.
