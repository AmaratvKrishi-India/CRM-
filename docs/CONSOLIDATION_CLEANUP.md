# Consolidation cleanup checklist

**No deletions have been performed.** The content review is summarized here and in GATES.md / Known Issues. Use File Explorer for the manual items below; do not run cleanup BAT/PowerShell/helper scripts. Preserve these two locations in full:

- C:\Users\PC\Desktop\calling app - Copy
- C:\Users\PC\Desktop\keys

Before deleting C:\Users\PC\Desktop\CRM-Release-Artifacts-2026-09-15, manually review its contents. It contains a PEM certificate and release artifacts; do not remove it until you have decided which artifacts/certificate to keep. Do not copy or expose secret values. The preserved keys folder contains the release keystore.

## Optional generated files inside the preserved project

These locations were present during read-only review. They are build outputs, caches, or test reports; retain any report you still need. Copy the current APK outside android/app/build before removing that directory.

1. C:\Users\PC\Desktop\calling app - Copy\.lighthouseci
2. C:\Users\PC\Desktop\calling app - Copy\playwright-report
3. C:\Users\PC\Desktop\calling app - Copy\reports\mutation
4. C:\Users\PC\Desktop\calling app - Copy\test-results
5. C:\Users\PC\Desktop\calling app - Copy\strix_runs
6. C:\Users\PC\Desktop\calling app - Copy\tests_output\nightwatch-html-report
7. C:\Users\PC\Desktop\calling app - Copy\test-results.json
8. C:\Users\PC\Desktop\calling app - Copy\androguard.db
9. C:\Users\PC\Desktop\calling app - Copy\.fallow\cache.bin
10. C:\Users\PC\Desktop\calling app - Copy\.fallow\churn.bin
11. C:\Users\PC\Desktop\calling app - Copy\.fallow\graph-cache.bin
12. C:\Users\PC\Desktop\calling app - Copy\.opencode\node_modules
13. C:\Users\PC\Desktop\calling app - Copy\android\.gradle
14. C:\Users\PC\Desktop\calling app - Copy\android\app\build
15. C:\Users\PC\Desktop\calling app - Copy\android\build
16. C:\Users\PC\Desktop\calling app - Copy\android\app\src\main\assets\public
17. C:\Users\PC\Desktop\calling app - Copy\dist
18. C:\Users\PC\Desktop\calling app - Copy\graft
19. C:\Users\PC\Desktop\calling app - Copy\docs\AUTOMATED_VERIFICATION_GATES.md
20. C:\Users\PC\Desktop\calling app - Copy\docs\AUTOMATED_VERIFICATION_REPORT.md

Do not delete the tracked .lostpixel/.gitignore or the modified, tracked html.meta.json.gz. The current APK is under android/app/build. Capacitor assets can be regenerated with npm run release:android:prepare; the debug APK can be rebuilt with android\gradlew.bat -p android assembleDebug.

## External Desktop items — manual deletion order

All 15 paths below existed during the read-only check. Delete only after any content you want has been preserved. Item 11 is held for the manual review above. Delete AUDIT last.

1. C:\Users\PC\Desktop\CRM-Android-QA-20260924-185311
2. C:\Users\PC\Desktop\audit prompt
3. C:\Users\PC\Desktop\ui_polish.ps1
4. C:\Users\PC\Desktop\UI REFRESH REVIEW
5. C:\Users\PC\Desktop\run_ui_refresh.ps1
6. C:\Users\PC\Desktop\calling app
7. C:\Users\PC\Desktop\crm-release-candidate-verify
8. C:\Users\PC\Desktop\ss
9. C:\Users\PC\Desktop\CRM_AUTOMATION_TEST
10. C:\Users\PC\Desktop\crm-production-prebuilt-6424870
11. C:\Users\PC\Desktop\CRM-Release-Artifacts-2026-09-15 — keep until you finish the artifact/certificate review.
12. C:\Users\PC\Desktop\calling-app-remediation-continuation-20260918
13. C:\Users\PC\Desktop\final
14. C:\Users\PC\Desktop\repo-cleanup-backup-2026-09-22
15. C:\Users\PC\Desktop\AUDIT — delete last.

After manual cleanup, confirm it is finished. Codex will then run read-only existence checks against this list. At the recorded check, git worktree list showed only C:\Users\PC\Desktop\calling app - Copy; no registered worktree remained under AUDIT. Do not try to unregister or remove any additional worktree unless a later read-only check shows one.