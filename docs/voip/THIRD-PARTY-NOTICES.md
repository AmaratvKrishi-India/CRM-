# Third-party candidate notices

The companion package contains only CRM-authored JavaScript and documentation, plus source hashes. No sipserver, NetSIPCore, PJSIP, OpenSSL or codec executable/library/source is redistributed in it.

- sipserver: sidhantjohnaind, top-level MIT, pinned `b8651e921e2370845c88e8ea36ae53f491c26435`.
- NetSIPCore: Copyright (C) 2026 WildRogerr, GPL version 2, pinned `f594e3eea6b65825691513943a2ccf5cda8e853b`.
- PJSIP and linked codec/crypto dependencies have separate licenses/build requirements. NetSIPCore `.gitmodules` names the PJSIP repository but inspected HEAD has no pinned `third_party/pjproject` gitlink; dependency reproducibility is unresolved.

Review original licenses at the pinned source URLs in `UPSTREAM-SECURITY-REVIEW.md`. Process separation does not by itself settle combined-work licensing. Any later upstream binary redistribution requires exact dependency inventory, copyright/license notices, corresponding source/source offers as applicable and legal review. No redistribution/commercial-use clearance is claimed.
