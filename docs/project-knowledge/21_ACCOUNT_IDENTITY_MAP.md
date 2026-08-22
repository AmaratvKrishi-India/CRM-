# 21 - ACCOUNT & IDENTITY MAP

Which account owns which service, and whether Vercel, Git/GitHub, and Supabase are connected with the same account.

> [!IMPORTANT]
> Verified live on 2026-08-22. All three production services are owned by the same logical identity: **AmaratvKrishi-India**.

## Service Ownership Matrix

| Service | Account / Identity | Evidence |
|---------|--------------------|----------|
| GitHub (repo host) | `AmaratvKrishi-India` (org) | Remote: `https://github.com/AmaratvKrishi-India/CRM-.git` |
| GitHub CLI (`gh`) | `AmaratvKrishi-India` (active) | `gh auth status` — active account, keyring, HTTPS |
| Git commit identity (this repo) | `AmaratvKrishi-India <296277231+AmaratvKrishi-India@users.noreply.github.com>` | Repo-level `git config user.name` / `user.email` |
| Git commit identity (global) | `Divinity <divinity.thethirdeye@gmail.com>` | Global config; overridden inside this repo |
| Vercel | `amaratvkrishi-india` (user), team/scope `amaratv-krishi` | `vercel whoami`, `vercel project ls` |
| Supabase | "AmaratvKrishi-India's Project" in org `fyeeutppsgfuhytfaekt` | `npx supabase projects list` |

## Are They the Same Account?

**Yes, effectively.** Vercel, GitHub, and Supabase are all signed in under the AmaratvKrishi-India identity:

- **GitHub:** repo lives in the `AmaratvKrishi-India` org; `gh` is authenticated as `AmaratvKrishi-India`; commits from this repo are attributed to `AmaratvKrishi-India` (noreply email).
- **Vercel:** logged in as `amaratvkrishi-india`, and the CRM project is deployed under the `amaratv-krishi` team scope.
- **Supabase:** the single project in the org is named "AmaratvKrishi-India's Project" (ref `lahvcodvgubplzfshare`, region ap-south-1).

> [!NOTE]
> The machine's *global* git identity is `Divinity <divinity.thethirdeye@gmail.com>` (personal account). It does NOT affect this project because the repository sets its own `user.name`/`user.email`. A second `gh` account (`DIVINITY-THE-THIRD-EYE`) is also registered on this machine but is inactive.

## Known Orphan / Legacy Items

| Item | Status |
|------|--------|
| Old Vercel project `divinity-thethirdeye/amaratv-krishi-crm` (URL `amaratv-krishi-crm.vercel.app`) | ORPHANED — belongs to the old personal account scope and is not accessible from the current `amaratvkrishi-india` login. The live project is `amaratv-krishi/crm`. |
| `vercel.json` naming | FIXED on 2026-08-22: now `{"name": "crm"}`, matching the linked project `crm` in scope `amaratv-krishi`. |
| `gh` account `DIVINITY-THE-THIRD-EYE` | Inactive; kept for other personal repos. Do not switch to it for this project. |

## Production Identifiers (non-secret)

- **GitHub repo:** `AmaratvKrishi-India/CRM-` (private since 2026-08-22)
- **Vercel project:** `crm` in scope `amaratv-krishi` — production URL `https://crm-blush-omega.vercel.app`
- **Supabase project ref:** `lahvcodvgubplzfshare` — API host `https://lahvcodvgubplzfshare.supabase.co`
- **Supabase org id:** `fyeeutppsgfuhytfaekt`

## Related Documents

- [20 - Toolchain & CLI Status](./20_TOOLCHAIN_CLI_STATUS.md)
- [22 - Deployment Runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [16 - Current State](./16_CURRENT_STATE.md)
