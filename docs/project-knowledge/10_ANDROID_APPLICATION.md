# 10 — Android Application

**Document status:** CURRENT
**Last reviewed:** 2026-09-11
**Source of truth:** `capacitor.config.ts`, `android/`, `src/services/nativePlatform.ts`, `package.json`, and Android verification reports

## Application identity

| Property | Value |
|---|---|
| Application ID / namespace | `com.amaratvkrishi.salescrm` |
| Version | `2.0.0` / versionCode `2` |
| Minimum SDK | 24 |
| Compile/target SDK | 36 |
| Capacitor core / Android | 8.5.1 |
| Web directory | `dist/` |
| Android scheme | `https` |

## Build flow

```powershell
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
# assembleRelease requires the external signing configuration
```

Android release builds require a working Java/Android SDK environment. Release signing reads an external `keystore.properties` file; passwords and signing files must never be committed.

## Native responsibilities

- App-state and back-button lifecycle callbacks support call completion and navigation.
- Native dialer launch is wrapped by the call lifecycle service; a dial attempt is not treated as verified talk time.
- Local notifications support follow-up reminders.
- Capacitor shares the built web bundle and native plugins with the React application.

## Verification status

- The historical v2.0.0 signed APK and checksum are recorded in [`release/RELEASE_NOTES.md`](../../release/RELEASE_NOTES.md).
- The 2026-09-09 evidence records a current debug build installed and launched on `emulator-5556`.
- The current workspace does not contain the release keystore, so a newly signed distribution artifact is pending.
- Emulator evidence must not be reported as physical-device evidence.

## Related documents

- [Current state](./16_CURRENT_STATE.md)
- [Local development setup](./23_LOCAL_DEV_SETUP.md)
- [Deployment runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [Latest completed historical verification](./FINAL_RELEASE_SIGNOFF_2026-09-09.md)
