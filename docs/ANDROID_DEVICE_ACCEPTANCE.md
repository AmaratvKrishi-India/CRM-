# Android device acceptance

## Last tested APK

This debug APK was used for the recorded emulator acceptance. Its generated in-repository build output was later removed as part of manual cleanup, so the path below is no longer present. No external copy location was checked. Use a retained external copy if available; otherwise rebuild before another install.

- File: C:\Users\PC\Desktop\calling app - Copy\android\app\build\outputs\apk\debug\app-debug.apk
- SHA-256: E8599D0A9A43882B297855A3F9B93A559552A7491805262F8C233E4828DD6D04
- Package: com.amaratvkrishi.salescrm
- Version: 2.0.0, version code 2
- This is a debug APK, not an externally signed release APK.
- Rebuild the debug APK with `android\gradlew.bat -p android assembleDebug` if the recorded artifact was not retained outside the project.

## Emulator evidence

Built with release Android assets and assembled successfully. The APK installed and launched on sdk_gphone16k_x86_64 running Android 17, API 37; MainActivity was foregrounded and the app process remained running. Earlier emulator coverage passed password-only login/logout and designated lead list/create/edit flows. No physical phone was used.

## Optional physical-device checklist

These checks require access to the user's Android device. They are optional for the revised consolidation goal. Use only the designated test account and designated test records. Do not call customer numbers or change 2FA settings.

1. Install this APK and confirm it opens without a crash.
2. Sign in with the designated password-only test account; confirm the dashboard and lead list load. Stop if a second-factor prompt appears.
3. Open the designated test lead and verify details/search/navigation. Avoid editing customer records.
4. If a write check is specifically needed, use a uniquely tagged test record and the already documented cleanup path; confirm it is absent after cleanup.
5. If relevant, test background/resume and network reconnect on the device. Record whether queued changes sync after reopening.
6. Calling, SIM permissions, call audio, contacts, camera, device hardware, battery restrictions, and OEM-specific behavior require a physical device and remain unverified until tested.

The emulator cannot establish physical calling/SIM behavior, hardware compatibility, OEM battery behavior, or device-specific permission handling. Keep the manual cleanup state separate from device acceptance.
