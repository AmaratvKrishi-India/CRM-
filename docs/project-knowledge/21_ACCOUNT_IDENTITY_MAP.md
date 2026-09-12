# 21 — Account and Identity Map

**Document status:** MACHINE-SPECIFIC REFERENCE
**Last reviewed:** 2026-09-10
**Rule:** reverify live account/project state before any deployment; this file is not authorization

This reference keeps only project-scoped, non-secret identifiers that help prevent deployment to the wrong account. Personal machine identities, inactive personal accounts, credentials, tokens, and unrelated global Git settings do not belong in canonical project documentation.

## Project ownership matrix

| Service | Project-scoped identity | Reverification method |
|---|---|---|
| GitHub repository | `AmaratvKrishi-India/CRM-` | `git remote -v` and authenticated GitHub account status |
| Git commits in this repo | repository-level `AmaratvKrishi-India` identity | `git config --local user.name` and `git config --local user.email` |
| Vercel | project `crm`, scope `amaratv-krishi` | `vercel whoami` plus project/scope inspection |
| Supabase production | project ref `lahvcodvgubplzfshare` | `npx supabase projects list` and explicit target confirmation |
| Supabase staging | project ref `dhoinifpzijqyobcamlv` | staging guard plus explicit target confirmation |

The logical project identity across GitHub, Vercel, and production Supabase is AmaratvKrishi-India, but login state can change. Never infer deployment authorization from a saved username or from this snapshot.

## Deployment identity rules

- Confirm the repository remote, Vercel scope/project, and Supabase project reference immediately before a deployment or migration.
- Run `npm run verify:staging-config` before staging Vite/build operations.
- Never point staging commands at production merely because credentials happen to be available.
- Use repository-level Git identity for this project; do not document or depend on a developer's machine-global identity.

## Non-secret production identifiers

- GitHub repository: `AmaratvKrishi-India/CRM-`
- Vercel project/scope: `crm` / `amaratv-krishi`
- Supabase production ref: `lahvcodvgubplzfshare`
- Supabase staging ref: `dhoinifpzijqyobcamlv`

Do not add service-role keys, access tokens, database passwords, session values, signing credentials, personal email addresses, or unrelated account details to this file.

## Related documents

- [20 — Toolchain and CLI Status](./20_TOOLCHAIN_CLI_STATUS.md)
- [22 — Deployment Runbook](./22_DEPLOYMENT_RUNBOOK.md)
- [24 — Isolated Staging Environment](./24_STAGING_ENVIRONMENT.md)
- [16 — Current State](./16_CURRENT_STATE.md)
