# Amaratv Krishi Sales CRM — Production Release Notes

> **Application:** Amaratv Krishi Sales CRM  
> **Version:** `2.0.0` (versionCode `2`)  
> **Package ID:** `com.amaratvkrishi.salescrm`  
> **Platform:** Android (Capacitor 8 / Android 16 / SDK 36)  
> **Release Date:** 2026-08-20  
> **Signing:** Production keystore (APK Signature Scheme v2, RSA 2048-bit)  
> **Architecture:** Single APK • Offline-First Dexie.js v5 + Supabase Cloud Integration

---

## 1. Product Overview & Identity

Amaratv Krishi Sales CRM is an enterprise, offline-first mobile CRM designed for field sales representatives and sales leadership in Lucknow pitching natural high-protein flour and nutrition blends directly to fitness centres, gyms, and wellness clubs.

* **Brand:** Amaratv Krishi
* **Tagline:** *From Our Fields to Your Home*
* **Architecture:** 1 Unified Android APK for both ADMIN and AGENT users

---

## 2. Major Features (v2.0.0)

* **Single-APK Role Architecture** — Unified build supporting ADMIN and AGENT roles seamlessly.
* **Central Supabase Integration** — Authentication, multi-tenant organization isolation, PostgreSQL storage, and Realtime WebSocket feed.
* **Offline-First Synchronisation** — Persistent Dexie v5 IndexedDB with atomic outbox queue and LWW conflict resolution.
* **Bulk Lead Assignment Engine** — Multi-lead selection, active agent validation, batch assignment modal, and immutable audit activity logging.
* **Admin Central Data Management Hub** — Complete Lead Explorer, Import History, Phone Deduplication / Conflict Merger, and Database Health & Sync Inspector.
* **Verified Call Duration Tracking** — Native `Intent.ACTION_DIAL` call lifecycle; strict zero fake talk-time invariant.
* **Controlled Field Lead Registration** — Quick lead capture on the ground with automatic agent self-assignment.
* **WhatsApp Outreach & Catalogue Sharing** — 5 B2B pitch templates with automated phone sanitization and PDF catalogue sharing.
* **Follow-ups & Push Reminders** — Local Android notification reminders and interactive follow-ups hub.
* **Executive CRM Dashboard & Reports** — 9 KPI cards, pipeline visualization, rep productivity scorecards, and formula-sanitized CSV exports.
* **Production Hardening** — React Error Boundary, Rollup chunk splitting (210 KB main JS chunk), and zero credential leakage.

---

## 3. Verification Summary

| Metric | Result |
| :--- | :--- |
| Unit & Integration Tests (Vitest) | **310 / 310 PASSED (30 Suites)** |
| Automated Android E2E Tests | **10 / 10 PASSED** |
| Physical Device Tested | **vivo V2319 / vivo V30 Pro** (Android 16, SDK 36) |
| APK Signature Verification | **Verified** (APK Signature Scheme v2) |
| Production TypeScript Build | **0 errors (1.21s compile)** |
| Capacitor Android Sync | **PASSING** |
| Security Audit | **100% CLEAN** |

---

## 4. Release Artifacts

| File | Size | SHA-256 |
| :--- | :---: | :--- |
| `AmaratvKrishi-SalesCRM-v2.0.0.apk` | 3.59 MB | `36c88f9c0fedc1057a4385fd7d4d0469aaa58250c1268da3592797c921f4bba8` |
| `AmaratvKrishi-SalesCRM-v1.0.0.apk` | 3.33 MB | `086164252c24abb275630f2d6525a3ee2693dce24969a0cd68db5439df452e1d` |
| `AmaratvKrishi-SalesCRM-v1.0.0.aab` | 3.19 MB | `2f149b526632aa690b510a35fa381c2da8075c0fe53086fe13caca0cfdec0fef` |

Full checksums available in `CHECKSUMS.txt`.

---

*Amaratv Krishi Field Sales CRM v2.0.0 • Signed Production Release • 2026-08-20*
