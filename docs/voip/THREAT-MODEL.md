# Threat model and residual gates

Assets: CRM identity/tenant partition, lead numbers, local call authority, carrier credentials, call history and Windows user boundary. Untrusted inputs: websites reaching localhost, HTTP headers/body, stale tabs, browser storage, SIP events, upstream installers/builds and local processes. No upstream code is run by this pilot.

| Threat | Implemented control / verification | Residual gate |
| --- | --- | --- |
| CSRF, DNS rebinding, malicious website | Exact Origin and Host, IPv4 loopback binder/peer, JSON POST, random pairing proof and token; wrong/missing origins tested | Allowed-origin XSS/local malware can still act; existing CSP stays strict |
| Forged user/device/tenant | Operator-designated scope, single-use pair code, tab device/session binding, CRM current scoped lead access | Demo does not independently validate server-signed CRM session; mandatory before live |
| Replays/double-clicks/bulk calls | Expiring consumed nonce, attempt dedup, one active call, cooldown, local daily cap, request budget; tests | Memory-only budget is demonstration, not durable live enforcement |
| Account change, logout, sleep/network loss | Async generation checks, unpair, 30s lease, no automatic reconnect/redial, refresh interruption | HTTP revocation can fail; live safety needs stronger local attestation/cancel semantics |
| Leaked numbers/passwords | No number in URLs, no SIP inputs, generic HTTP errors, no persistent logs, no recordings; source package whitelist | E2E traces contain synthetic pair material only; never use traces with real secrets |
| Local port hijack or other Windows user | Fixed endpoint; collision fails, wrong account pairing fails | Same-machine process trust/ACL cannot be proved by TCP; local-Jio disabled |
| Untrusted SIP tool/credential exporters | Pinned text audit/hashes; no binary/installer execution or OTP; real mode rejected | Upstream TLS, global bind, GPL/dependency provenance unresolved |
| Fake connected/billing evidence | Mock provenance, carrierVerified false, zero duration/null answeredAt, no VERIFIED escalation | Real media/answer/duration require new reviewed evidence contract |
| Hosted test writes to Production | Exact Preview+Staging key guard plus actual build inspection before E2E writes | Approved Preview access and synthetic test identity still absent |
| Secret-bearing PR CI | New workflow has contents:read, no environment/secrets, mock-only | Existing release workflow uses Production environment/public build bindings; unchanged, not enlarged |
| Recovery mishandling | Contract validator has no DB/upload/process API; existing loopback-only backup scripts preserved | Real encrypted hosted backup/restore needs owner-approved contracts |

Browser permission is not bypassed: no insecure Chromium flags, certificate exceptions, PNA wildcard grant, public SIP, firewall exceptions, custom protocol registration, UAC/Defender change or microphone enablement. An HTTPS browser may reject loopback requests; this is a blocker, not a reason to weaken policy.

HTTP authorization rate is 300 requests/minute with at most eight connections, 4 KiB body and five-second timeouts. Local DoS remains possible; fail closed, stop companion and restart manually. Logs are deliberately absent; only the foreground pairing code and fixed startup text appear locally. There is no rotation need without stored logs; never redirect that terminal into shared logs. Crash loses pairing and mock policy state. Start is explicit; no service, autostart, remote access or hidden enrollment is installed.
