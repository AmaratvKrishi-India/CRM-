# 10 - ANDROID APPLICATION

This document covers all details regarding the Android application for the Amaratv Krishi Field Sales CRM.

## Application Identity

- **Application ID:** com.amaratvkrishi.salescrm
- **App Name:** Amaratv Krishi Sales CRM
- **versionCode:** 2
- **versionName:** 2.0.0
- **minSdk:** 24 (Android 7.0)
- **targetSdk:** 36
- **compileSdk:** 36
- **Namespace:** com.amaratvkrishi.salescrm

## Capacitor Configuration

Located in `capacitor.config.ts`:
- **appId:** com.amaratvkrishi.salescrm
- **appName:** Amaratv Krishi Sales CRM
- **webDir:** dist
- **server.androidScheme:** https
- **Plugins:** LocalNotifications (smallIcon: ic_stat_icon_config_sample, iconColor: #16a34a)

## Build System

- **Gradle Plugin:** com.android.application
- **AGP:** 8.13.0
- **Google Services:** 4.4.4 (conditionally applied if google-services.json present)
- **Capacitor:** 8.5.0

## Signing Configuration

Release signing loads from an **EXTERNAL** `keystore.properties` file located at [C:\Users\PC\Documents\AmaratvKrishi-Keys\keystore.properties](file:///C:/Users/PC/Documents/AmaratvKrishi-Keys/keystore.properties) (NOT in Git).
- **Properties:** storeFile, storePassword, keyAlias, keyPassword
- **.gitignore:** excludes `*.jks`, `*.keystore`, `keystore.properties`

> [!WARNING]
> Do NOT expose actual keystore passwords or signing secrets in source control.

## Dependencies

- **androidx.appcompat:** 1.7.1
- **androidx.coordinatorlayout:** 1.3.0
- **core-splashscreen:** 1.2.0
- **capacitor-android** (project dependency)
- **capacitor-cordova-android-plugins** (project dependency)
- **JUnit:** 4.13.2
- **AndroidX JUnit:** 1.3.0
- **Espresso:** 3.7.0

## SDK Versions

Loaded from [android/variables.gradle](file:///c:/Users/PC/Desktop/calling%20app/android/variables.gradle):
- **minSdkVersion** = 24
- **compileSdkVersion** = 36
- **targetSdkVersion** = 36
- **androidxActivityVersion** = 1.11.0
- **androidxAppCompatVersion** = 1.7.1
- **androidxCoordinatorLayoutVersion** = 1.3.0
- **androidxCoreVersion** = 1.17.0
- **androidxFragmentVersion** = 1.8.9
- **coreSplashScreenVersion** = 1.2.0
- **androidxWebkitVersion** = 1.14.0
- **junitVersion** = 4.13.2
- **androidxJunitVersion** = 1.3.0
- **androidxEspressoCoreVersion** = 3.7.0
- **cordovaAndroidVersion** = 14.0.1

## AndroidManifest.xml

- **allowBackup:** false (security hardening)
- **Permissions:** INTERNET, POST_NOTIFICATIONS
- **Activity:** MainActivity with singleTask launch mode
- **FileProvider** for content sharing
- **Package visibility queries:** com.whatsapp, com.whatsapp.w4b, tel: dial intent, SEND intent
- **Theme:** AppTheme with SplashScreen

## MainActivity.java

- **Extends:** BridgeActivity (Capacitor)
- **Features:** Enables WebView debugging in onCreate
- **Package:** com.amaratvkrishi.salescrm

## Resources

- **strings.xml:** app_name=Amaratv Krishi Sales CRM, package_name=com.amaratvkrishi.salescrm, custom_url_scheme=com.amaratvkrishi.salescrm
- **styles.xml:** AppTheme (Light.DarkActionBar with brand colors), AppTheme.NoActionBar (DayNight), AppTheme.NoActionBarLaunch (SplashScreen)
- **Splash screens:** portrait and landscape at hdpi/mdpi/xhdpi/xxhdpi/xxxhdpi
- **Launcher icons:** mipmap at all densities + adaptive icon (anydpi-v26)

## Android File Structure

Here are all the files located under `android/app/src/`:

| File | Size (Bytes) |
| --- | --- |
| `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` | 774 |
| `android/app/src/main/AndroidManifest.xml` | 2104 |
| `android/app/src/main/assets/capacitor.config.json` | 266 |
| `android/app/src/main/assets/capacitor.plugins.json` | 322 |
| `android/app/src/main/assets/public/cordova.js` | 0 |
| `android/app/src/main/assets/public/cordova_plugins.js` | 0 |
| `android/app/src/main/assets/public/favicon.png` | 9799 |
| `android/app/src/main/assets/public/index.html` | 1223 |
| `android/app/src/main/assets/public/logo.png` | 306816 |
| `android/app/src/main/assets/public/assets/AdminShell-DEf1Szet.js` | 166438 |
| `android/app/src/main/assets/public/assets/BackupRestoreModal-BlZqtyEk.js` | 14243 |
| `android/app/src/main/assets/public/assets/ExcelImporter-DCLjxGwl.js` | 57567 |
| `android/app/src/main/assets/public/assets/index-CGqAXNxD.js` | 226953 |
| `android/app/src/main/assets/public/assets/index-BdHyj3la.css` | 94037 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-400-normal-HOLc17fK.woff` | 9780 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-400-normal-obahsSVq.woff2` | 7712 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-500-normal-BasfLYem.woff2` | 7900 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-500-normal-CxZf_p3X.woff` | 9940 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-600-normal-4D_pXhcN.woff` | 9936 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-600-normal-CWCymEST.woff2` | 7972 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-700-normal-CjBOestx.woff2` | 7904 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-700-normal-DrXBdSj3.woff` | 9912 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-800-normal-C7MGvYyJ.woff2` | 7992 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-800-normal-CCHyn08d.woff` | 9944 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-900-normal-BAVML7y5.woff` | 9832 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-900-normal-CjyCg421.woff2` | 7808 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2` | 10232 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-400-normal-DQukG94-.woff` | 13336 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-500-normal-B0yAr1jD.woff2` | 10432 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-500-normal-BmqWE9Dz.woff` | 13452 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-600-normal-Bcila6Z-.woff` | 13464 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2` | 10484 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-700-normal-BjwYoWNd.woff2` | 10496 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-700-normal-LO58E6JB.woff` | 13408 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-800-normal-BZOjs1Xv.woff2` | 10440 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-800-normal-Ca-gJeZY.woff` | 13476 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-900-normal-BUlv-ou0.woff` | 13216 |
| `android/app/src/main/assets/public/assets/inter-cyrillic-ext-900-normal-buRuWz4h.woff2` | 10164 |
| `android/app/src/main/assets/public/assets/inter-greek-400-normal-B4URO6DV.woff2` | 7776 |
| `android/app/src/main/assets/public/assets/inter-greek-400-normal-q2sYcFCs.woff` | 9924 |
| `android/app/src/main/assets/public/assets/inter-greek-500-normal-BIZE56-Y.woff2` | 7920 |
| `android/app/src/main/assets/public/assets/inter-greek-500-normal-Xzm54t5V.woff` | 9980 |
| `android/app/src/main/assets/public/assets/inter-greek-600-normal-BZpKdvQh.woff` | 10032 |
| `android/app/src/main/assets/public/assets/inter-greek-600-normal-plRanbMR.woff2` | 7944 |
| `android/app/src/main/assets/public/assets/inter-greek-700-normal-BUv2fZ6O.woff` | 9980 |
| `android/app/src/main/assets/public/assets/inter-greek-700-normal-C3JjAnD8.woff2` | 7920 |
| `android/app/src/main/assets/public/assets/inter-greek-800-normal-BU00tryP.woff` | 9964 |
| `android/app/src/main/assets/public/assets/inter-greek-800-normal-CLIouy3y.woff2` | 7892 |
| `android/app/src/main/assets/public/assets/inter-greek-900-normal-7n5hB3DA.woff` | 9900 |
| `android/app/src/main/assets/public/assets/inter-greek-900-normal-Clii5heL.woff2` | 7840 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2` | 5264 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-400-normal-KugGGMne.woff` | 7064 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-500-normal-2j5mBUwD.woff` | 7192 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-500-normal-C4iEst2y.woff2` | 5428 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-600-normal-B8X0CLgF.woff` | 7212 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2` | 5432 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-700-normal-BoQ6DsYi.woff` | 7216 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-700-normal-qfdV9bQt.woff2` | 5444 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-800-normal-B--PVpEC.woff2` | 5548 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-800-normal-DUe57HfS.woff` | 7204 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-900-normal-LVqH4fM3.woff` | 7100 |
| `android/app/src/main/assets/public/assets/inter-greek-ext-900-normal-voj7phVX.woff2` | 5348 |
| `android/app/src/main/assets/public/assets/inter-latin-400-normal-C38fXH4l.woff2` | 23664 |
| `android/app/src/main/assets/public/assets/inter-latin-400-normal-CyCys3Eg.woff` | 30696 |
| `android/app/src/main/assets/public/assets/inter-latin-500-normal-BL9OpVg8.woff` | 31284 |
| `android/app/src/main/assets/public/assets/inter-latin-500-normal-Cerq10X2.woff2` | 24272 |
| `android/app/src/main/assets/public/assets/inter-latin-600-normal-CiBQ2DWP.woff` | 31260 |
| `android/app/src/main/assets/public/assets/inter-latin-600-normal-LgqL8muc.woff2` | 24452 |
| `android/app/src/main/assets/public/assets/inter-latin-700-normal-BLAVimhd.woff` | 31320 |
| `android/app/src/main/assets/public/assets/inter-latin-700-normal-Yt3aPRUw.woff2` | 24356 |
| `android/app/src/main/assets/public/assets/inter-latin-800-normal-BYj_oED-.woff2` | 24400 |
| `android/app/src/main/assets/public/assets/inter-latin-800-normal-D1mf63XC.woff` | 31296 |
| `android/app/src/main/assets/public/assets/inter-latin-900-normal-D4nM5aha.woff2` | 23900 |
| `android/app/src/main/assets/public/assets/inter-latin-900-normal-EUCDUbiG.woff` | 30680 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-400-normal-77YHD8bZ.woff` | 47560 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-400-normal-C1nco2VV.woff2` | 35000 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-500-normal-BxGbmqWO.woff` | 48492 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-500-normal-CV4jyFjo.woff2` | 36024 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-600-normal-CIVaiw4L.woff` | 48668 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2` | 36260 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-700-normal-Ca8adRJv.woff2` | 36244 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-700-normal-TidjK2hL.woff` | 48632 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-800-normal-BOMpwxm3.woff` | 48592 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-800-normal-DZJjya6U.woff2` | 36128 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-900-normal-DG9wZIMw.woff` | 47656 |
| `android/app/src/main/assets/public/assets/inter-latin-ext-900-normal-ty8Tfvw5.woff2` | 35328 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-400-normal-Bbgyi5SW.woff` | 6500 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-400-normal-DMkecbls.woff2` | 4972 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-500-normal-DOriooB6.woff2` | 5112 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-500-normal-mJboJaSs.woff` | 6596 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-600-normal-BuLX-rYi.woff` | 6640 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2` | 5100 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-700-normal-BZaoP0fm.woff` | 6632 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-700-normal-DlLaEgI2.woff2` | 5104 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-800-normal-Cm7tD1pz.woff2` | 5176 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-800-normal-DDlpr_Ee.woff` | 6644 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-900-normal-C4P836tE.woff2` | 5028 |
| `android/app/src/main/assets/public/assets/inter-vietnamese-900-normal-DBSPUrC7.woff` | 6456 |
| `android/app/src/main/assets/public/assets/rolldown-runtime-hePW80VL.js` | 716 |
| `android/app/src/main/assets/public/assets/SettingsModal-5EZC-WDs.js` | 24202 |
| `android/app/src/main/assets/public/assets/vendor-dexie-D3KjN6fK.js` | 95185 |
| `android/app/src/main/assets/public/assets/vendor-lucide-BdkyNCGb.js` | 24849 |
| `android/app/src/main/assets/public/assets/vendor-react-BV_chA3p.js` | 182123 |
| `android/app/src/main/assets/public/assets/vendor-supabase-H6RbKBY9.js` | 208116 |
| `android/app/src/main/assets/public/assets/vendor-xlsx-Cul4fuIT.js` | 419278 |
| `android/app/src/main/assets/public/assets/web-Czq7RCGj.js` | 844 |
| `android/app/src/main/assets/public/assets/web-DJrGG_yb.js` | 4440 |
| `android/app/src/main/assets/public/assets/web-LM4tiwxl.js` | 365 |
| `android/app/src/main/java/com/amaratvkrishi/salescrm/MainActivity.java` | 361 |
| `android/app/src/main/res/drawable/ic_launcher_background.xml` | 5606 |
| `android/app/src/main/res/drawable/splash.png` | 76588 |
| `android/app/src/main/res/drawable-land-hdpi/splash.png` | 76570 |
| `android/app/src/main/res/drawable-land-mdpi/splash.png` | 39219 |
| `android/app/src/main/res/drawable-land-xhdpi/splash.png` | 146567 |
| `android/app/src/main/res/drawable-land-xxhdpi/splash.png` | 234035 |
| `android/app/src/main/res/drawable-land-xxxhdpi/splash.png` | 375561 |
| `android/app/src/main/res/drawable-port-hdpi/splash.png` | 76588 |
| `android/app/src/main/res/drawable-port-mdpi/splash.png` | 39407 |
| `android/app/src/main/res/drawable-port-xhdpi/splash.png` | 145208 |
| `android/app/src/main/res/drawable-port-xxhdpi/splash.png` | 231976 |
| `android/app/src/main/res/drawable-port-xxxhdpi/splash.png` | 370959 |
| `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml` | 1880 |
| `android/app/src/main/res/layout/activity_main.xml` | 535 |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | 265 |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml` | 265 |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` | 9207 |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` | 21878 |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png` | 9385 |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` | 4362 |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` | 10973 |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png` | 4473 |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` | 15009 |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` | 35185 |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png` | 15314 |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` | 29836 |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` | 67919 |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png` | 30276 |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | 47981 |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` | 107941 |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` | 48628 |
| `android/app/src/main/res/values/ic_launcher_background.xml` | 120 |
| `android/app/src/main/res/values/strings.xml` | 340 |
| `android/app/src/main/res/values/styles.xml` | 823 |
| `android/app/src/main/res/xml/config.xml` | 185 |
| `android/app/src/main/res/xml/file_paths.xml` | 319 |
| `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` | 402 |

## Release APK

- **Shipped artifact:** [release/AmaratvKrishi-SalesCRM-v2.0.0.apk](file:///c:/Users/PC/Desktop/calling%20app/release/AmaratvKrishi-SalesCRM-v2.0.0.apk) (6.9 MB / 7,268,429 bytes)
- **Gradle output path:** `android/app/build/outputs/apk/release/app-release.apk` (currently absent; regenerated by the build below, then copied to `release/` with a versioned name)
- **Build command:** `cd android && gradlew assembleRelease`
- **Requirements:** Requires `JAVA_HOME` set to Android Studio JBR and `ANDROID_HOME` set to the SDK root. As of 2026-08-22 BOTH are unset on this machine (see [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md)).

## Build Commands

To build the application, execute these commands sequentially:
1. `npm run build` (Builds web assets)
2. `npx cap sync android` (Syncs web assets and capacitor plugins to the Android project)
3. `cd android && gradlew assembleRelease` (Builds the final release APK)
