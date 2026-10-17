# Upstream security decision — 17 October 2026 IST

**REJECT LIVE EXECUTION. Mock pilot only.** Sources were read as text; no upstream installer, executable, provisioning helper or credential export was run. No live SIP registration or Jio call was attempted. Source compatibility is plausible, secure interoperability is not established.

| Candidate | Exact pinned commit | License | Decision |
| --- | --- | --- | --- |
| [sipserver](https://github.com/sidhantjohnaind/sipserver) | b8651e921e2370845c88e8ea36ae53f491c26435 | Top-level MIT; linked PJSIP and codecs have independent obligations | Reject supplied execution path |
| [NetSIPCore](https://github.com/WildRogerr/NetSIPCore) | f594e3eea6b65825691513943a2ccf5cda8e853b | GPL-2.0 | Reject supplied execution path |

Evidence refers to files at those immutable commits, not current master. Git commit objects pin source; selected file SHA-256 hashes are in `upstream-lock.json`. These are source hashes, **not** verified release-binary hashes. No signed/hash-matched Windows binary or reproducible correspondence was established; no binary is approved or bundled.

## Findings from source

- `sipserver/src/b2bua.cpp:276` uses `SSL_VERIFY_NONE` during provisioning; line 447 writes `TLS_VERIFY=0`. More seriously its carrier transport unconditionally sets `tls_cfg.tls_setting.verify_server = PJ_FALSE` near line 1299. Editing an environment variable does not repair that source. No legitimate carrier CA/hostname/trust decision was available. Production cannot use this path.
- `src/b2bua.cpp:487–526` returns successful REGISTER responses without a digest challenge. A SIP password input is not authentication. UDP creation uses a port but no loopback-bound address near line 1277. It is unsuitable on an untrusted LAN without source fixes and host isolation. No firewall was modified.
- `sipserver/install_windows.ps1` elevates, downloads an executable plus mutable master scripts without checksum enforcement, then creates broad inbound SIP/RTP/program rules. `installer.iss` does likewise. `b2bua_sync.bat` scans drive letters/WSL and copies `.env`, offers ZIP export; these helpers are expressly prohibited. No helper was executed. Upstream contains prebuilt DLLs/shared libraries with unestablished build provenance.
- `NetSIPCore/src/tcp/TcpServer.cpp:103` sets `INADDR_ANY`, despite docs describing `127.0.0.1:4890`. The single-client NDJSON controller has no authentication or message-buffer limit and can be occupied by another process. Loopback on the CRM side does not fix that exposure. Local Windows user isolation also needs an ACL-protected IPC boundary or restricted per-user process boundary.
- `src/utils/Json.cpp` extracts strings rather than using a full JSON parser. Only a limited reviewed command set should ever reach it. No arbitrary paths, playback, recording, destroy or remote addresses are exposed by this pilot.
- `SIPCore.cpp:828` passes `cmd.server` into `makeCall`; `makeCall` rejects an empty server. API.md's example **omits this required call field**. Our contract includes `server`, `username`, `remote`, `command` from source. States are account-scoped and have no attempt nonce: correlation across disconnect/reconnect is not authoritative.
- `SIPCore.cpp:554–655` uses default capture/playback devices, and can silently use a null audio device. Registered/confirmed does not prove audible media. There is no reviewed per-device Bluetooth selector in the documented protocol. Windows default communication input and output must be checked separately.

## Signaling, media and licenses

Both use PJSIP; B2BUA codec selection includes PCMA/PCMU and AMR bridging. Windows build variants differ: MSVC enables AMR-NB, MinGW disables it; AMR-WB encode/decode coverage differs. This is source-level feasibility, not a codec/SDP/RTP/Windows build test. NetSIPCore's default audio and ordinary G.711 could serve the downstream leg if independently built, isolated and tested; no actual carrier negotiation was observed.

NetSIPCore's GPL-2.0 and its pinned PJSIP submodule require distribution/source/license review. CRM is UNLICENSED. A separate process/protocol avoids copying upstream implementation into CRM but does not settle combined-work legal questions. sipserver's MIT label does not override GPL/commercial PJSIP or codec library licenses, notices, source offers or patent obligations. We bundle **neither** upstream code nor binary. Any later distributor must inventory exact build dependencies, supply required licenses/corresponding source and obtain legal review before redistribution. No license compatibility approval is claimed.

## Gate and alternatives

Live mode is hard-disabled in both CRM and companion; no configuration switch bypasses this decision. Reopening requires authenticated/restricted engine IPC, loopback downstream SIP, bounded parsers, legitimate carrier peer verification plus actual trust validation, reviewed reproducible Windows assets, licensing clearance and Jio authorization for commercial calls. These are development/security gates in addition to hardware acceptance.

A separately audited JFC/MicroSIP/manual SIP client may be used by the owner for a consented proof of carrier call only after authorization/trust review; it was not installed or tested here. A compliant business provider can implement the same `CallProvider` interface later. No paid service was provisioned.

Public issue review: sipserver issue [#1](https://github.com/sidhantjohnaind/sipserver/issues/1) asks for direct IMS support; it is not proof of secure interoperability. NetSIPCore issue search returned no issues at inspection; absence of reports is not a safety finding. No signed binary/source correspondence was established.
