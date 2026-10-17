# Verification matrix

See `EXECUTION-REPORT.md` for this task's exact command results, final SHAs and CI URLs. Prior maintenance CI does not cover new code.

| Layer | Automated coverage | Boundary / remaining acceptance |
| --- | --- | --- |
| Dependency-free companion | `node --test companion/server.test.mjs` | Loopback HTTP, Origin/Host, pairing/tenant/role/device/session, nonce/replay/expiry, one call, DNC/consent, cooldown/budget, rate, port collision; no real SIP |
| NDJSON | Encoder/parser + ephemeral TCP mock | Source-required server, split/corrupt/oversize/unknown states and sanitized payload; no real :4890 registration/media |
| CRM service/lifecycle | `npx vitest run tests/services/windowsCalling.test.ts --reporter dot` | Feature default off, backend/key scope, account/offline/DNC/races/idempotency/zero duration; fake IndexedDB |
| Chromium actual companion | `npx playwright test e2e/windows-calling.spec.ts --project=chromium` | Real local HTTP pairing, synthetic authenticated fixture, lead click/outcome/history, denial, refresh, narrow layout/axe, Android UA hidden |
| Regression | Existing Node, Vitest, Chromium, tablet, disposable Supabase, Android build workflow | No Android device or live customer backend; owner excluded Android real-backend sync |
| Windows | `VoIP synthetic pilot` windows-latest | Syntax/contract tests and source ZIP hashes, no Bluetooth/Jio/installer |
| Upstream supply chain | `python3 scripts/verify-voip-upstream.py` | Pinned selected text hashes only; binary safety/reproducibility not established |
| Operations | `node --test tests/voip/*.test.mjs` | Preview target/key fail-closed, recovery contract no execution, bypass main/manual guard |
| Production access | Credential-free read-only workflow; optional protected manual workflow | Artifact result must be passed; green workflow with blocked is no app proof |
| HTTPS Windows handoff | NOT_RUN / BLOCKED | Actual Windows Chrome/Edge LNA/PNA/CSP/native-confirmation tests required; no insecure flags |
| Live carrier/audio | NOT_RUN / BLOCKED | Source remediation, Jio commercial authorization, own line and Bluetooth acceptance |
| Hosted recovery | NOT_RUN / BLOCKED | No dump/upload/restore/history repair or PG upgrade in this task |

Supported **code/mock CI**: Node 24, Linux Chromium, GitHub Windows runner. Windows 11 Chrome/Edge and Bluetooth live support are targets, not verified compatibility. Firefox, Safari and incoming calling are not approved pilot transports. Tests use synthetic contacts, ephemeral tokens and local/disposable databases; never retain real pairing secrets or account data in traces.
