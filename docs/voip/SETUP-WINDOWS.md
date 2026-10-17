# Windows 11 mock companion setup

**Mock only. No Jio credentials, OTP, SIP registration, microphone access or carrier call.** Upstream real-mode execution is rejected by security review. Windows hardware acceptance and hosted HTTPS handoff remain unverified. This source package requires an independently installed trusted Node.js 24 runtime; it adds zero npm dependencies, registry entries, services or firewall rules.

1. Download the `windows-mock-companion-source` artifact from the exact reviewed PR commit's successful **VoIP synthetic pilot** workflow. Check that run's SHA and review the scripts. Verify the ZIP against its SHA-256 sidecar and compare the extracted file digests to `SHA256SUMS`:

   ```powershell
   Get-FileHash .\voip-companion.zip -Algorithm SHA256
   Get-Content .\voip-companion.zip.sha256
   Expand-Archive .\voip-companion.zip .\voip-companion
   Set-Location .\voip-companion
   Get-Content .\SHA256SUMS
   Get-FileHash .\server.mjs, .\protocol.mjs -Algorithm SHA256
   node --version
   ```

   Hashes establish correspondence to the artifact, not publisher code signing. Package is source-only and unsigned. Do not run unreviewed downloads or installer one-liners. Keep the extracted directory private to the Windows account. No third-party binary is bundled.

2. Use only a local synthetic CRM development build. From the CRM checkout, PowerShell example (replace scope with your **synthetic** allowed account; no secrets):

   ```powershell
   $env:VITE_WINDOWS_CALLING_MOCK='1'
   $env:VITE_WINDOWS_CALLING_MOCK_SCOPES='synthetic-org:synthetic-user'
   # Existing approved disposable backend configuration must already be set.
   npm run dev -- --host 127.0.0.1 --port 4174 --strictPort
   ```

   Default Production builds do not set these flags. Hosted Preview requires approved Staging configuration and actual served-build guard, and currently cannot complete this bridge because production CSP excludes localhost. Do not deploy policy exceptions.

3. Start the companion in another foreground terminal. From extracted package use `server.mjs`; from the repository use `companion/server.mjs`:

   ```powershell
   node .\server.mjs mock http://127.0.0.1:4174 synthetic-user synthetic-org AGENT
   ```

   The endpoint is fixed at `127.0.0.1:48765`. User/organization/role must match the designated test profile. The startup code appears locally once and expires in two minutes. Never capture/share the terminal or redirect its output. In CRM choose **Windows mock calling settings**, enter the code and check consent, then **Enable mock calling**. Refresh or account switch requires restarting the companion and pairing again. A code/token is not a carrier password.

4. Open a synthetic permitted lead and click **Call** once. The banner says mock connecting/ringing/connected/ended; polling may miss brief intermediate states. End manually if desired, then save an outcome/notes or skip. Inspect history: MOCK, unverified, duration 0, answeredAt null. No real phone rings. DNC/current partition checks run before creating an intent. Offline attempts require manual retry; no future call is queued.

5. Status/stop/uninstall:

   ```powershell
   Test-NetConnection 127.0.0.1 -Port 48765
   # This tests reachability only, not identity, registration or carrier readiness.
   # Ctrl+C in the exact companion terminal stops and unpairs.
   ```

   **Disable and unpair** in Settings before stopping. Closing the terminal also stops it. After confirming the exact process has stopped, delete only your extracted package directory. No registry, service, firewall or carrier settings need reversal. Do not kill arbitrary port owners. Port collision: identify the owner in Windows Resource Monitor; stop only a process you recognize or use manual calling. No alternate/public listener is chosen.

## Troubleshooting and later hardware work

Pairing denied: verify exact origin including port, Windows browser, active allowed account/tenant/role, consent, two-minute code and no existing pairing. Restart locally to issue a fresh code. Service reachable is not SIP registered; both SIP and carrier fields stay false. Expired ten-minute session or thirty-second lease loss needs new pairing. No silent reconnect or redial.

Browser console CSP/LNA/PNA denial: record only a redacted fixed error. Current hosted handoff is blocked; use the tested local mock route. Do not disable site security or ignore certificate errors. A future custom protocol fallback requires opaque intents, local confirmation, signed handler ownership and real Windows tests; it is not installed here.

Bluetooth audio is not used by the mock. For a later authorized live pilot, Windows Settings → System → Sound must show the intended **microphone input** and **headset output** separately, with input meter activity and explicit output test. NetSIPCore uses defaults and may fall back to null audio. Registration or media events cannot prove two-way sound. Device switch/sleep/reconnect requires human acceptance; incoming calling remains disabled.
