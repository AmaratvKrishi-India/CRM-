# Consolidation cleanup record

Reviewed 2026-10-03. **Manual cleanup is complete.** The user confirmed completion, then read-only existence checks found all 15 external and all 20 internal cleanup targets listed below absent. Codex did not delete local files.

## Preserved locations and signing material

- `C:\Users\PC\Desktop\calling app - Copy` remains as the canonical project.
- `C:\Users\PC\Desktop\keys` remains. Its `CRM KEYS\amaratv-crm-production.jks` and `keystore.properties` exist; their contents were not opened during the final check.
- The separate OneDrive signing directory and its `amaratv-release-key.jks` and `keystore.properties` remain.
- `C:\Users\PC\Desktop\CRM-Release-Artifacts-2026-09-15` is absent. Its PEM certificate was public certificate material matching the preserved Desktop release keystore; no signing-material hold remains.
- Inside the project, `.lostpixel/.gitignore` and `html.meta.json.gz` remain.

## External Desktop targets checked absent

1. `C:\Users\PC\Desktop\CRM-Android-QA-20260924-185311`
2. `C:\Users\PC\Desktop\audit prompt`
3. `C:\Users\PC\Desktop\ui_polish.ps1`
4. `C:\Users\PC\Desktop\UI REFRESH REVIEW`
5. `C:\Users\PC\Desktop\run_ui_refresh.ps1`
6. `C:\Users\PC\Desktop\calling app` (the separate unused folder whose 161 uncommitted entries the user chose to discard)
7. `C:\Users\PC\Desktop\crm-release-candidate-verify`
8. `C:\Users\PC\Desktop\ss`
9. `C:\Users\PC\Desktop\CRM_AUTOMATION_TEST`
10. `C:\Users\PC\Desktop\crm-production-prebuilt-6424870`
11. `C:\Users\PC\Desktop\CRM-Release-Artifacts-2026-09-15`
12. `C:\Users\PC\Desktop\calling-app-remediation-continuation-20260918`
13. `C:\Users\PC\Desktop\final`
14. `C:\Users\PC\Desktop\repo-cleanup-backup-2026-09-22`
15. `C:\Users\PC\Desktop\AUDIT` (last in the former manual deletion order)

## Internal generated/report targets checked absent

1. `C:\Users\PC\Desktop\calling app - Copy\.lighthouseci`
2. `C:\Users\PC\Desktop\calling app - Copy\playwright-report`
3. `C:\Users\PC\Desktop\calling app - Copy\reports\mutation`
4. `C:\Users\PC\Desktop\calling app - Copy\test-results`
5. `C:\Users\PC\Desktop\calling app - Copy\strix_runs`
6. `C:\Users\PC\Desktop\calling app - Copy\tests_output\nightwatch-html-report`
7. `C:\Users\PC\Desktop\calling app - Copy\test-results.json`
8. `C:\Users\PC\Desktop\calling app - Copy\androguard.db`
9. `C:\Users\PC\Desktop\calling app - Copy\.fallow\cache.bin`
10. `C:\Users\PC\Desktop\calling app - Copy\.fallow\churn.bin`
11. `C:\Users\PC\Desktop\calling app - Copy\.fallow\graph-cache.bin`
12. `C:\Users\PC\Desktop\calling app - Copy\.opencode\node_modules`
13. `C:\Users\PC\Desktop\calling app - Copy\android\.gradle`
14. `C:\Users\PC\Desktop\calling app - Copy\android\app\build`
15. `C:\Users\PC\Desktop\calling app - Copy\android\build`
16. `C:\Users\PC\Desktop\calling app - Copy\android\app\src\main\assets\public`
17. `C:\Users\PC\Desktop\calling app - Copy\dist`
18. `C:\Users\PC\Desktop\calling app - Copy\graft`
19. `C:\Users\PC\Desktop\calling app - Copy\docs\AUTOMATED_VERIFICATION_GATES.md`
20. `C:\Users\PC\Desktop\calling app - Copy\docs\AUTOMATED_VERIFICATION_REPORT.md`

## Repository and APK state

The final read-only Git status was clean on `main`, aligned with `origin/main`. `git worktree list` showed only the canonical project; no worktree remains under `AUDIT`.

The Android build output, including the last tested debug APK's former path under `android\app\build`, was removed during cleanup. Its identity, checksum, and emulator results are preserved in [Android Device Acceptance](./ANDROID_DEVICE_ACCEPTANCE.md). If the APK was not retained outside this project, rebuild it before another install. Physical-device acceptance remains optional; calling, SIM, hardware, OEM, and device-specific behavior are still unverified.
