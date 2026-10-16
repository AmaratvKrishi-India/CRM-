# Installation and storage

## Rebuild the scanner

The setup script uses an isolated Python 3.12 virtual environment, pins NVIDIA SkillSpector to commit `e8850a88c02dfc53cf8abead1ff753d35b5ba853` (version 2.12.0), and installs dependencies from that source checkout's locked `uv.lock` file:

```bash
scripts/ai-toolkit/check-storage.sh
scripts/ai-toolkit/bootstrap.sh
scripts/ai-toolkit/verify.sh
```

The default installation is under ignored `work/ai-toolkit/`. Set `AI_TOOLKIT_HOME=/absolute/path` to use another writable task-local location. The bootstrap script is idempotent, verifies the checkout URL and exact commit, and does not install `uv`, invoke a shell installer, or touch Docker configuration. The cloud Python runtime must provide Python 3.12+, Git, and `uv`.

To scan a skill after installation:

```bash
scripts/ai-toolkit/scan-skill.sh .agents/skills/professional-writing
```

The wrapper accepts only repo-local skills or explicitly staged public skill samples, disables LLM analysis, and fails on incomplete coverage or findings. SkillSpector's static supply-chain analyzer may query public OSV advisories for package identifiers; it is not used on CRM source or private data.

## Actual size measurements

Measurements in this Codex Cloud workspace on 2026-10-16:

| Item | Before scanner install | After scanner install |
| --- | ---: | ---: |
| Root filesystem used | 429,555,712 bytes | 669,679,616 bytes |
| Root filesystem available | 31,605,874,688 bytes | 31,365,750,784 bytes |
| Isolated scanner environment | 0 | 216 MiB (`du -sh`) |
| Existing `node_modules` | 1.1 GiB | 1.1 GiB |
| Existing `.git` | 31 MiB | 31 MiB |
| Existing `dist` | 1.9 MiB | 1.9 MiB |

The writable filesystem is 32 GiB. Existing Docker uses the VFS driver and had approximately 615 MB of non-PostgreSQL Supabase images. No database image was pulled, no Docker objects were pruned, no model was downloaded, and no application dependency was installed again. The public source checkouts used for security review occupied approximately 407 MB under ignored `work/ai-toolkit/upstream/`; they are scratch material and can be removed after review without affecting the repository.

The root filesystem is an overlay with read-only base layers. `du` of visible files can exceed the filesystem's reported writable usage. `check-storage.sh` measures available space and reports VFS; it does not delete files or modify infrastructure. The public review clones and the duplicate clean reconstruction were removed after use. The pinned 19 MiB SkillSpector checkout stays under ignored `work/ai-toolkit/upstream/` because the installed package is editable and uses that source tree.

After removing task-created review clones and the duplicate reconstruction environment while retaining the scanner checkout, the workspace reported 564,097,024 bytes used and 31,471,333,376 bytes available. The active scanner venv measured 217 MiB and its source checkout 19 MiB. The Playwright headless Chromium install separately downloaded about 267 MB to the environment browser cache for the requested tests; browser binaries are not in the repository.

## Codex Cloud persistence

Repository-local skills, plan templates, memory, and setup scripts persist through Git and are available to later tasks after the branch is checked out. The installed virtual environment is task-local and reproducible from the pinned setup script. The script deliberately keeps binaries outside the Git tree.

The active session exposes environment status as read-only and has no environment-publishing control. To persist the scanner prerequisite, open Codex Cloud **Settings → Environments**, select the CRM environment, set its setup step to provide Python 3.12, Git, and `uv` 0.12.23, and publish a new revision. In future tasks, check out this branch and run `scripts/ai-toolkit/bootstrap.sh` followed by `scripts/ai-toolkit/verify.sh`. This is the only environment-level UI action; no secret variables or outbound identities are required. The repository scripts remain reproducible without publishing when the base environment already provides these three executables.

## Deferred services

Google Drive is on hold. Existing backup scripts and documentation remain untouched; this setup performs no OAuth, `rclone` configuration, uploads, scheduling, or Drive tests.
