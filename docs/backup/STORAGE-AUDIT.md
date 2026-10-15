# Codex Cloud storage audit

Captured read-only on 2026-10-15. No files, images, caches, packages, or databases were deleted or changed as part of the audit. Sizes under `du` are visible merged-tree allocations; this environment uses an overlay with a read-only base layer, so those sizes do not equal the writable quota usage reported by `df`.

## Filesystem and inode capacity

`df -hT`, `df -i`, `df -PT -B1`, and `findmnt` were run. The CRM checkout at `/workspace/CRM-` is on the same 32 GiB overlay filesystem reported for `/`.

| Filesystem / mount | Type | Total | Used | Available | `total-used-available` | Inodes used / total | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| `/` and `/workspace` | overlay | 33.77 GB (31.45 GiB) | 1.30 MB (1.24 MiB) | 32.03 GB (29.83 GiB) | 1.73 GB (1.62 GiB), unattributed by `df` | 158 / 2,097,152 | `df` rounds usage to 1%; exact block ratio is about 0.004%. Overlay does not report a separate reserved-block figure. Do not treat the remainder as file usage. |
| `/tmp` | tmpfs | 17.87 GB (16.65 GiB) | 17.27 MB (16.47 MiB) during this audit | 17.85 GB (16.63 GiB) | 0 | 694 / 4,363,255 | Memory-backed temporary filesystem, not the CRM disk quota. Some usage came from temporary audit/backup smoke tests. |
| `/run/codex-runtime-secrets` | tmpfs | 1.05 MB | 0 | 1.05 MB | 0 | 2 / 4,363,255 | No secret file was read or present in the configured environment status. |
| `/dev` | tmpfs | 17.87 GB | 0 | 17.87 GB | 0 | 15 / 4,363,255 | Memory-backed device filesystem. |
| `/dev/tty` | tmpfs | 67.11 MB | 0 | 67.11 MB | 0 | 16 / 4,363,255 | Device mount. |
| `/tmp/codex-daemon-1000`, `/workspace/.git`, `.agents`, `.codex`, `.aws`, and matching `/tmp` aliases | tmpfs | 17.87 GB each | 0 | 17.87 GB each | 0 | 1 each | Separate memory-backed mount views; capacities are not additive and are not disk usage. |

The root overlay's available capacity is roughly 30 GiB, so the current CRM checkout is not close to exhausting its writable quota. The overlay root is read-only; `/workspace` is the writable checkout mount. The 1.62 GiB difference between total, used, and available is not identified by the overlay driver as reserved blocks or file data.

## Visible directory usage

The following table gives the principal paths, purpose, size visible to `du`, share of the 33.77 GB overlay capacity, and conservative cleanup estimate. Nested directory percentages overlap and must not be added together. A theoretical cleanup size is not a measured `df` recovery: lower-layer ownership and the Docker daemon's backing store are not accessible from this checkout.

| Path | Purpose | Visible size | % of reported total (33.77 GB / 31.45 GiB) | Needed for CRM? | Safe to clean? | Possible recovery |
|---|---|---:|---:|---|---|---:|
| `/usr` | Base system binaries, libraries, Chromium, and platform tools | 8.80 GiB | 27.33% | Platform dependencies; some tools support testing | No; platform-managed and base-layer | 0 safely available here |
| `/opt` | Codex runtime and preinstalled applications | 5.31 GiB | 16.88% | Codex runtime required; Slicer/Godot are unrelated | No; read-only platform image | 0 safely available here |
| `/opt/codex` | Codex runtime, Python/Node and host tools | 3.75 GiB | 11.91% | Yes, platform runtime | No | 0 |
| `/opt/slicer` | Preinstalled 3D/imaging application and libraries | 1.43 GiB | 4.55% | No | Not from this environment; base image | 0 |
| `/workspace` | CRM checkout and workspace caches | 1.37 GiB | 4.34% | Yes | No; contains source and reproducibility caches | 0 |
| `/workspace/CRM-` | CRM source, Git history, dependencies and test/build output | 1.07 GiB | 3.42% | Yes | No; preserve source/history | 0 |
| `/workspace/CRM-/node_modules` | Locked npm dependencies, including the 92.41 MiB Supabase CLI binary | 1.03 GiB | 3.28% | Yes for current build/test workflow | Reproducible, but unnecessary to remove while space is available; reinstall downloads are costly | Up to 1.03 GiB only if in writable storage; actual recovery unverified |
| `/workspace/CRM-/.git` | CRM history and branch metadata | 30.45 MiB | 0.095% | Yes | No; source backup and branch history | 0 |
| `/workspace/.npm-cache` | npm package download cache | 233.68 MiB | 0.726% | Helpful for reproducible/offline installs | Reproducible, but retain to avoid downloads | Up to 233.68 MiB only if writable; actual recovery unverified |
| `/workspace/.cache` | Native build cache and browser cache | 64.71 MiB | 0.201% | Helpful; mainly node-gyp here | Reproducible, but retain | Up to 64.71 MiB only if writable; actual recovery unverified |
| `/workspace/.cache/node-gyp` | Cached Node headers for native modules | 64.70 MiB | 0.201% | Useful during native dependency rebuilds | Reproducible | Up to 64.70 MiB only if writable; actual recovery unverified |
| `/workspace/.cache/ms-playwright` | Playwright browser download location | 12 KiB | <0.001% | Browser tests use system Chromium instead | No benefit to clean | Negligible |
| `/workspace/CRM-/dist` | Generated local-test web build | 1.84 MiB | 0.006% | Not source; regenerated by build | Yes after preserving any needed build evidence | Up to 1.84 MiB if writable |
| `/workspace/CRM-/test-results` | Generated test outputs | 0.75 MiB | 0.002% | Not source; useful test evidence | Yes after archiving needed reports | Up to 0.75 MiB if writable |
| `/workspace/CRM-/supabase/.temp` | Small Supabase CLI state | 8 KiB | <0.001% | Only during local Supabase use | Remove only when no local CLI operation is active | Negligible |
| Docker images | Realtime 394 MB, Kong 139.2 MB, GoTrue 61.45 MB, PostgREST 20.45 MB | 615.4 MB logical | 1.82% | Support services for a local Supabase stack; no database image present | Idle and reclaimable according to Docker, but intentionally left intact | Up to 615.4 MB logical; actual filesystem recovery unverified |
| Docker containers / volumes / build cache | No containers, no volumes, no build cache | 0 | 0% | None currently | Nothing to clean | 0 |
| PostgreSQL data | No native server, Postgres image, or database volume | 0 | 0% | No local database available | N/A | 0 |
| `/tmp` | Temporary session data; RAM-backed | 16.47 MiB at capture | Not part of disk capacity | No persistent CRM data | Temporary data is disposable, but audit did not clean it | Not disk recovery |

### 30 largest visible directories

These are the 30 largest directory entries from `du -x -B1 -a /`, ordered by visible bytes. They overlap by parent/child and mostly reside in the read-only base image.

| Path | MiB | % of reported total (33.77 GB / 31.45 GiB) |
|---|---:|---:|
| `/` | 15,768.08 | 48.960% |
| `/usr` | 8,801.61 | 27.329% |
| `/opt` | 5,435.43 | 16.877% |
| `/usr/lib` | 4,807.66 | 14.928% |
| `/opt/codex` | 3,836.48 | 11.912% |
| `/opt/codex/runtimes` | 3,172.71 | 9.851% |
| `/opt/codex/runtimes/codex-primary-runtime` | 3,172.70 | 9.851% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies` | 3,170.27 | 9.844% |
| `/usr/lib/x86_64-linux-gnu` | 2,630.01 | 8.166% |
| `/usr/share` | 2,463.87 | 7.650% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/python` | 1,952.21 | 6.062% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib` | 1,863.17 | 5.785% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12` | 1,823.10 | 5.661% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages` | 1,799.83 | 5.589% |
| `/opt/slicer` | 1,466.39 | 4.553% |
| `/opt/slicer/5.10.0` | 1,466.38 | 4.553% |
| `/workspace` | 1,398.62 | 4.343% |
| `/opt/slicer/5.10.0/lib` | 1,387.06 | 4.307% |
| `/workspace/CRM-` | 1,100.19 | 3.416% |
| `/workspace/CRM-/node_modules` | 1,057.77 | 3.284% |
| `/usr/lib/python3` | 871.93 | 2.707% |
| `/usr/lib/python3/dist-packages` | 871.93 | 2.707% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/native` | 731.14 | 2.270% |
| `/usr/bin` | 713.57 | 2.216% |
| `/opt/slicer/5.10.0/lib/Python` | 605.21 | 1.879% |
| `/opt/slicer/5.10.0/lib/Python/lib` | 605.14 | 1.879% |
| `/opt/slicer/5.10.0/lib/Python/lib/python3.12` | 598.11 | 1.857% |
| `/opt/slicer/5.10.0/lib/Slicer-5.10` | 552.50 | 1.716% |
| `/opt/slicer/5.10.0/lib/Python/lib/python3.12/site-packages` | 546.93 | 1.698% |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless` | 515.32 | 1.600% |

## 30 largest visible files

`find` listed file sizes only; the file with a sensitive-name match is path-redacted and its content was not read. The paths mostly identify read-only platform/runtime components. Percentages use total overlay capacity and are not writable-layer percentages.

| File | MiB | % of reported total (33.77 GB / 31.45 GiB) | Purpose / CRM relevance |
|---|---:|---:|---|
| `/usr/lib/chromium/chromium` | 311.74 | 0.968% | System Chromium; used by lightweight browser tests |
| `/opt/slicer/5.10.0/lib/Python/lib/python3.12/site-packages/SimpleITK/_SimpleITK.abi3.so` | 280.00 | 0.869% | Slicer imaging library; unrelated, platform base |
| `/opt/codex/bin/codex` | 273.47 | 0.849% | Codex platform binary; required by environment |
| `/usr/bin/pandoc` | 188.98 | 0.587% | System document converter; not required by CRM tests |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/site-packages/OCP/OCP.cpython-312-x86_64-linux-gnu.so` | 166.21 | 0.516% | Python/CAD runtime dependency; unrelated base image |
| `/usr/lib/jvm/java-21-openjdk-amd64/lib/modules` | 134.33 | 0.417% | Java modules; needed only for Java/Android-related tasks |
| `/opt/godot/4.6.3/Godot_v4.6.3-stable_linux.x86_64` | 132.54 | 0.412% | Godot; unrelated platform application |
| `/usr/lib/x86_64-linux-gnu/libLLVM.so.19.1` | 123.67 | 0.384% | System compiler library |
| `/opt/slicer/5.10.0/lib/Slicer-5.10/libQt5WebEngineCore.so.5.15.2` | 121.44 | 0.377% | Slicer web engine; unrelated base image |
| `/opt/codex/cua_node/bin/node` | 120.73 | 0.375% | Codex browser-control runtime |
| `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node` | 120.15 | 0.373% | Node runtime used by the environment |
| `/usr/lib/x86_64-linux-gnu/libLLVM-17.so.1` | 118.55 | 0.368% | System compiler library |
| `/workspace/CRM-/node_modules/@supabase/cli-linux-x64/bin/supabase` | 92.41 | 0.287% | Supabase CLI used by CRM; installed locally, no PG server bundled |
| `/usr/bin/blender` | 90.57 | 0.281% | Blender; unrelated platform application |
| `/usr/libexec/docker/cli-plugins/docker-buildx` | 85.59 | 0.266% | Docker build plugin |
| `/opt/slicer/5.10.0/lib/Slicer-5.10/libvtkITK.so` | 84.54 | 0.262% | Slicer library; unrelated base image |
| `/usr/local/bin/dockerd` | 75.69 | 0.235% | Docker daemon binary |
| `/usr/libexec/docker/cli-plugins/docker-compose` | 73.05 | 0.227% | Docker Compose plugin |
| `[sensitive path redacted]` | 72.73 | 0.226% | Name matched a sensitive-path heuristic; exact purpose unknown; no contents inspected |
| `/opt/codex/bin/codex-code-mode-host` | 70.64 | 0.219% | Codex execution host |
| `/opt/codex/codex-resources/voice/bin/codex-voice-host` | 61.54 | 0.191% | Codex platform component |
| `/usr/local/bin/runsc` | 60.78 | 0.189% | Container runtime |
| `/usr/lib/x86_64-linux-gnu/libamd_comgr.so.2.6.0` | 60.39 | 0.188% | System compiler/GPU runtime library |
| `/usr/local/bin/azcopy` | 59.44 | 0.185% | Platform transfer utility |
| `/usr/lib/x86_64-linux-gnu/libopenvdb.so.10.0.1` | 56.28 | 0.175% | 3D/imaging support library; unrelated base image |
| `/workspace/.npm-cache/_cacache/content-v2/sha512/...` | 54.79 | 0.170% | npm cached package blob; reproducible and useful for offline install |
| `/usr/bin/rclone` | 54.25 | 0.168% | Installed Drive transfer tool |
| `/usr/lib/x86_64-linux-gnu/libvtkCommonCore-pv5.13.so.5.13` | 49.70 | 0.154% | Visualization library; unrelated base image |
| `/usr/lib/python3/dist-packages/qgis/_gui.cpython-313-x86_64-linux-gnu.so` | 48.62 | 0.151% | QGIS library; unrelated platform application |
| `/opt/slicer/5.10.0/lib/libvtkCommon-9.5.so.9.5` | 46.19 | 0.143% | Slicer visualization library; unrelated base image |

## Docker, Supabase, packages, and databases

| Area | Finding | CRM impact / recovery |
|---|---|---|
| Docker driver | `vfs`; `/etc/docker/daemon.json` has no `storage-driver` setting; platform selector reports `vfs` | VFS does not share layers copy-on-write. The managed daemon is outside checkout permissions; no supported driver switch is exposed in this environment setup. |
| Docker images | 4 images, 615.4 MB total, 100% reported reclaimable; Realtime 394.3 MB, Kong 139.2 MB, GoTrue 61.45 MB, PostgREST 20.45 MB | No Postgres image is present. The VFS data root is inaccessible to the shell; Docker's logical sizes cannot be reconciled to the overlay `df` value. No images were removed. |
| Docker containers, volumes, build cache | 0 / 0 / 0 B | No running local Supabase stack and no database volume. |
| Supabase CLI | 2.116.0 via `npx --no-install supabase` | Project dependency is present; it does not include a PostgreSQL server. |
| Supabase project config | Project `calling_app`, PostgreSQL major 17, database port 15433; migrations enabled; seed disabled; 19 ordered migrations | Local stack would require the full Supabase auth/realtime schemas and configured extensions. |
| PostgreSQL | `postgres`, `psql`, `pg_dump`, `pg_restore`, `initdb`, and `pg_ctl` absent from PATH and no native server binary found | There is no local DB storage to clean or backup. Full PG migration/restore tests were not run. |
| Migration requirements | Migrations reference `auth.users`, Realtime publication, `uuid-ossp`, and `pg_cron` | SQLite/mock tests are not PostgreSQL integration evidence. |
| npm/pnpm/yarn | npm cache 233.68 MiB under `/workspace/.npm-cache`; no material pnpm/yarn cache found | Keep npm cache to avoid repeated downloads. |
| Browser tests | System Chromium binary 311.74 MiB; Playwright download directory only 12 KiB | Browser assertions can use system Chromium; Playwright browser/ffmpeg downloads are avoided. |
| Build/test outputs | `dist` 1.84 MiB; `test-results` 0.75 MiB | Reproducible; preserve reports until uploaded or no longer needed. |

## Reconciliation and cause of prior exhaustion

`du -xhd1 /` reported about 16.53 GB (15.40 GiB) of visible merged-tree content, including `/usr` 8.60 GiB, `/opt` 5.31 GiB, and `/workspace` 1.37 GiB. In contrast, the 33.77 GB overlay reported only 1.30 MB used and 32.03 GB available. `findmnt` confirms `/` is read-only and `/workspace` is a separate writable overlay view over the same base image. The difference is therefore primarily lower/base-image content, not 16.5 GB of removable writable files. Permission-denied paths include `/root`, `/var/lib/docker`, private system directories, and Docker/container runtime mounts. Docker API inventory was used for image/volume totals, but its backing files are not readable from the checkout.

The prior full-disk event occurred during extraction of the pinned Supabase PostgreSQL 17 image. The current Docker inventory contains no Postgres image, running container, volume, or database bytes. The likely cause is the large image's expanded layers plus VFS layer copying and temporary pull/unpack space, not CRM source or live database data. The exact peak bytes cannot be reconstructed because the failed image was stopped and is no longer present. Current `df` shows ample writable capacity; there is no current 32 GB fill to clean.

## Safe optimization plan

1. Keep source in GitHub and generate commit-addressed archives only after the commit exists on the remote branch.
2. Continue using the npm lockfile, shared npm cache, system Chromium, and the existing local test configuration; avoid duplicate Playwright downloads.
3. Run typecheck, lint, unit tests, and local web/browser checks in Codex Cloud. Run full PostgreSQL/Supabase integration tests on the existing GitHub-hosted CI runner, which already starts the full stack, until the platform supports overlay2 or native PostgreSQL with the required extensions.
4. Do not pull the 17.x Supabase PostgreSQL image into this VFS daemon as a test. Do not remove support images or caches while the current writable quota has about 30 GiB free.
5. Use `scripts/storage-audit.sh --threshold=85` at session start; it is read-only and emits a threshold alert. No persistent Codex-session scheduler exists here.
6. After OAuth is configured, create the Drive folder tree and verify uploads by round-trip SHA-256. Keep daily/weekly/monthly source retention manual; do not automatically delete backups.

No cleanup was performed and no space was recovered. The conservative currently verified recovery is **0 bytes**. Theoretical cleanup candidates are npm dependencies/cache and 615.4 MB of idle Docker images, but `df`/`du` do not prove they occupy the writable layer, and removing them would not address the prior VFS image-extraction peak.
