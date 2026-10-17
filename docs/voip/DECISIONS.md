# Integration decision log — 17 October 2026 IST

1. Continued PR #10 at actual fetched head d7a5d6d, preserving original work checkout and released main 0eea4fe.
2. Rejected live upstream execution after source audit: unconditional carrier TLS bypass, unauthenticated globally bound SIP/TCP, unverified assets and dependency/legal provenance. Code development is authorized; live activation is not.
3. Chose dependency-free Node 24 foreground Windows companion source package. It is easy to stop/audit and needs no admin/service/installer. It cannot launch SIP or route a call.
4. Used tested local Chromium HTTP loopback/CORS with one-time pairing and intents. Development CSP gets one fixed endpoint; Production policy/microphone stays unchanged. Hosted HTTPS/native protocol acceptance is blocked, not inferred.
5. No hosted migration. Retained scoped Dexie/outbox/activity contracts and native dialer behavior; mock history is expressly unverified and cannot manufacture answer/duration.
6. Added separate unprivileged Windows/mock CI. Existing Production-environment web/Android build workflow was inspected and preserved; no new production secret consumption added to PR jobs.
7. Prepared main-only reviewer-protected optional read-only bypass workflow; no bypass created or configured. Recovery work is a non-executing contract validator/template because destination/key/credential contracts are unavailable.
8. Carrier commercial authorization, Windows/Bluetooth/live-call, source remediation, hosted browser/recovery and final merge remain distinct gates. Drive remains deferred.
