# Amaratv Krishi Sales CRM — Production Release Notes

> **Application:** Amaratv Krishi Sales CRM  
> **Version:** `1.0.0` (versionCode `1`)  
> **Package ID:** `com.amaratvkrishi.salescrm`  
> **Platform:** Android (Capacitor 8 / Android 16 / SDK 36)  
> **Release Date:** 2026-08-20  
> **Signing:** Production keystore (APK Signature Scheme v2, RSA 2048-bit, 10,000-day validity)  
> **Architecture:** 100% Offline-First / Local-Only (Dexie.js IndexedDB)

---

## 1. Product Overview & Identity

Amaratv Krishi Sales CRM is a purpose-built, offline-first mobile CRM designed for field sales representatives in Lucknow pitching natural high-protein flour and nutrition blends directly to fitness centres, gyms, and wellness clubs.

* **Brand:** Amaratv Krishi
* **Tagline:** *From Our Fields to Your Home*

---

## 2. Major Features

* **Excel Lead Ingestion** — 141 verified Lucknow fitness leads with Indian phone normalization
* **Lead Detail & Pipeline Management** — Status transitions, activity feeds, search and filters
* **Native Calling & Outcome Workflow** — `Intent.ACTION_DIAL` with post-call outcome and remark capture
* **WhatsApp Outreach & Catalogue Sharing** — 5 B2B pitch templates, `FileProvider` PDF sharing, landline guard
* **Follow-ups & Push Reminders** — Quick presets, local Android notifications, Follow-ups Hub
* **Real-Time Sales Dashboard** — 9 KPI tiles, clickable pipeline, locality breakdown
* **Local Backup & Restore** — Versioned JSON export, LWW merge restore, rollback snapshot replace

---

## 3. Architecture

* **Cloud Sync:** `NOT IMPLEMENTED` (Intentionally local/offline only)
* **Authentication:** `NOT IMPLEMENTED` (Direct single-user access)
* **Remote Backend:** `NOT IMPLEMENTED` (Local Dexie/IndexedDB is sole source of truth)

---

## 4. Verification Summary

| Metric | Result |
| :--- | :--- |
| Unit & Integration Tests (Vitest) | **99 / 99 PASSED** |
| Automated Android E2E Tests | **10 / 10 PASSED** |
| Physical Device Tested | **vivo V30 Pro** (Android 16, SDK 36) |
| APK Signature Verification | **Verified** (APK Signature Scheme v2) |
| Release Smoke Test | **PASSED** |
| Production Web Build | **0 errors** |
| Capacitor Sync | **PASSING** |

---

## 5. Release Artifacts

| File | Size | SHA-256 |
| :--- | :---: | :--- |
| `AmaratvKrishi-SalesCRM-v1.0.0.apk` | 3.33 MB | `61027fcf...8302fd` |
| `AmaratvKrishi-SalesCRM-v1.0.0.aab` | 3.19 MB | `f0b07da5...a1f18e` |

Full checksums available in `CHECKSUMS.txt`.

---

*Amaratv Krishi Field Sales CRM v1.0.0 • Signed Production Release • 2026-08-20*
