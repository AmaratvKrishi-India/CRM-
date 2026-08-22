# Third-Party Licenses

**Project:** Amaratv Krishi Field Sales CRM v2.0.0
**Audit date:** 2026-08-22 (generated from the installed `node_modules` tree, 174 packages)

The Amaratv Krishi Field Sales CRM application code is proprietary
(see [LICENSE](./LICENSE)). It builds on open-source software listed
below. All dependencies use permissive licenses (MIT, Apache-2.0, ISC,
BSD, 0BSD, BlueOak-1.0.0, Unlicense, CC-BY-4.0, MPL-2.0, OFL-1.1).
**No GPL/AGPL/LGPL or other copyleft licenses are present**, so no
source-disclosure obligations apply to the application.

## Assets shipped inside the product

These components are bundled into the shipped APK / web bundle and their
license terms must accompany the product:

| Component | Version | License | Notes |
|---|---|---|---|
| Inter font (`@fontsource/inter`) | 5.3.0 | SIL OFL 1.1 | Bundled locally for offline use; full OFL text below (required by OFL clause 2) |
| React / React DOM | 19.2.8 | MIT | Runtime bundle |
| Dexie.js | 4.4.5 | Apache-2.0 | Runtime bundle |
| Supabase JS | 2.112.3 | MIT | Runtime bundle |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 | Runtime bundle (Excel import) |
| lucide-react icons | 1.33.0 | ISC | Runtime bundle |
| Capacitor | 8.x | MIT | Android runtime bridge |
| Tailwind CSS output | 4.3.3 | MIT | Compiled CSS only |

Android native dependencies (from `android/app/build.gradle`): AndroidX
libraries (Apache-2.0), Capacitor Android (MIT), JUnit/Espresso
(test-only, not shipped).

## Complete dependency inventory (174 packages)

| Package | Version | License |
|---|---|---|
| @capacitor/android | 8.5.0 | MIT |
| @capacitor/app | 8.1.1 | MIT |
| @capacitor/cli | 8.5.0 | MIT |
| @capacitor/core | 8.5.0 | MIT |
| @capacitor/local-notifications | 8.3.1 | MIT |
| @capacitor/share | 8.0.1 | MIT |
| @esbuild/win32-x64 | 0.28.2 | MIT |
| @fontsource/inter | 5.3.0 | OFL-1.1 |
| @ionic/cli-framework-output | 2.2.8 | MIT |
| @ionic/utils-array | 2.1.6 | MIT |
| @ionic/utils-fs | 3.1.7 | MIT |
| @ionic/utils-object | 2.1.6 | MIT |
| @ionic/utils-process | 2.1.12 | MIT |
| @ionic/utils-stream | 3.1.7 | MIT |
| @ionic/utils-subprocess | 3.0.1 | MIT |
| @ionic/utils-terminal | 2.3.5 | MIT |
| @isaacs/fs-minipass | 4.0.1 | ISC |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/sourcemap-codec | 1.5.5 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @oxc-project/types | 0.146.0 | MIT |
| @playwright/test | 1.62.1 | Apache-2.0 |
| @rolldown/binding-win32-x64-msvc | 1.2.5 | MIT |
| @rolldown/pluginutils | 1.0.1 | MIT |
| @supabase/auth-js | 2.112.3 | MIT |
| @supabase/functions-js | 2.112.3 | MIT |
| @supabase/phoenix | 0.4.5 | MIT |
| @supabase/postgrest-js | 2.112.3 | MIT |
| @supabase/realtime-js | 2.112.3 | MIT |
| @supabase/storage-js | 2.112.3 | MIT |
| @supabase/supabase-js | 2.112.3 | MIT |
| @tailwindcss/node | 4.3.3 | MIT |
| @tailwindcss/oxide | 4.3.3 | MIT |
| @tailwindcss/oxide-win32-x64-msvc | 4.3.3 | MIT |
| @tailwindcss/vite | 4.3.3 | MIT |
| @types/fs-extra | 8.1.5 | MIT |
| @types/node | 26.2.0 | MIT |
| @types/react | 19.2.18 | MIT |
| @types/react-dom | 19.2.4 | MIT |
| @types/slice-ansi | 4.0.0 | MIT |
| @typescript/typescript-win32-x64 | 7.0.2 | Apache-2.0 |
| @vitejs/plugin-react | 6.1.0 | MIT |
| @xmldom/xmldom | 0.9.11 | MIT |
| adler-32 | 1.3.1 | Apache-2.0 |
| ansi-regex | 5.0.1 | MIT |
| ansi-styles | 4.3.0 | MIT |
| astral-regex | 2.0.0 | MIT |
| at-least-node | 1.0.0 | ISC |
| autoprefixer | 10.5.4 | MIT |
| balanced-match | 4.0.4 | MIT |
| base64-js | 1.5.1 | MIT |
| baseline-browser-mapping | 2.11.15 | Apache-2.0 |
| big-integer | 1.6.52 | Unlicense |
| bplist-creator | 0.1.0 | MIT |
| bplist-parser | 0.3.2 | MIT |
| brace-expansion | 5.0.9 | MIT |
| browserslist | 4.28.8 | MIT |
| buffer-crc32 | 0.2.13 | MIT |
| caniuse-lite | 1.0.30001809 | CC-BY-4.0 |
| cfb | 1.2.2 | Apache-2.0 |
| chownr | 3.0.0 | BlueOak-1.0.0 |
| clsx | 2.1.1 | MIT |
| codepage | 1.15.0 | Apache-2.0 |
| color-convert | 2.0.1 | MIT |
| color-name | 1.1.4 | MIT |
| commander | 12.1.0 | MIT |
| crc-32 | 1.2.2 | Apache-2.0 |
| cross-spawn | 7.0.6 | MIT |
| csstype | 3.2.3 | MIT |
| debug | 4.4.3 | MIT |
| define-lazy-prop | 2.0.0 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| dexie | 4.4.5 | Apache-2.0 |
| electron-to-chromium | 1.5.411 | ISC |
| elementtree | 0.1.7 | Apache-2.0 |
| emoji-regex | 8.0.0 | MIT |
| enhanced-resolve | 5.24.5 | MIT |
| env-paths | 2.2.1 | MIT |
| esbuild | 0.28.2 | MIT |
| escalade | 3.2.0 | MIT |
| fake-indexeddb | 6.2.5 | Apache-2.0 |
| fd-slicer | 1.1.0 | MIT |
| fdir | 6.5.0 | MIT |
| frac | 1.1.2 | Apache-2.0 |
| fraction.js | 5.3.4 | MIT |
| fs-extra | 11.4.0 | MIT |
| glob | 13.0.6 | BlueOak-1.0.0 |
| graceful-fs | 4.2.11 | ISC |
| iceberg-js | 0.8.1 | MIT |
| inherits | 2.0.4 | ISC |
| ini | 4.1.3 | ISC |
| is-docker | 2.2.1 | MIT |
| is-fullwidth-code-point | 3.0.0 | MIT |
| is-wsl | 2.2.0 | MIT |
| isexe | 2.0.0 | ISC |
| jiti | 2.7.0 | MIT |
| jsonfile | 6.2.1 | MIT |
| kleur | 4.1.5 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| lru-cache | 11.5.2 | BlueOak-1.0.0 |
| lucide-react | 1.33.0 | ISC |
| magic-string | 0.30.21 | MIT |
| minimatch | 10.2.6 | BlueOak-1.0.0 |
| minipass | 7.1.3 | BlueOak-1.0.0 |
| minizlib | 3.1.0 | MIT |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.18 | MIT |
| native-run | 2.0.3 | MIT |
| node-releases | 2.0.53 | MIT |
| open | 8.4.2 | MIT |
| package-json-from-dist | 1.0.1 | BlueOak-1.0.0 |
| path-key | 3.1.1 | MIT |
| path-scurry | 2.0.2 | BlueOak-1.0.0 |
| pend | 1.2.0 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.5 | MIT |
| playwright | 1.62.1 | Apache-2.0 |
| playwright-core | 1.62.1 | Apache-2.0 |
| plist | 3.1.1 | MIT |
| postcss | 8.5.26 | MIT |
| postcss-value-parser | 4.2.0 | MIT |
| prompts | 2.4.2 | MIT |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |
| readable-stream | 3.6.2 | MIT |
| rimraf | 6.1.3 | BlueOak-1.0.0 |
| rolldown | 1.2.5 | MIT |
| safe-buffer | 5.2.1 | MIT |
| sax | 1.1.4 | ISC |
| scheduler | 0.27.0 | MIT |
| semver | 7.8.5 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| signal-exit | 3.0.7 | ISC |
| simple-plist | 1.3.1 | MIT |
| sisteransi | 1.0.5 | MIT |
| slice-ansi | 4.0.0 | MIT |
| source-map-js | 1.2.1 | BSD-3-Clause |
| split2 | 4.2.0 | ISC |
| ssf | 0.11.2 | Apache-2.0 |
| stream-buffers | 2.2.0 | Unlicense |
| string_decoder | 1.3.0 | MIT |
| string-width | 4.2.3 | MIT |
| strip-ansi | 6.0.1 | MIT |
| tailwind-merge | 3.6.0 | MIT |
| tailwindcss | 4.3.3 | MIT |
| tapable | 2.3.3 | MIT |
| tar | 7.5.22 | BlueOak-1.0.0 |
| through2 | 4.0.2 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tree-kill | 1.2.2 | MIT |
| tslib | 2.8.1 | 0BSD |
| tsx | 4.23.12 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| undici-types | 8.3.0 | MIT |
| universalify | 2.0.1 | MIT |
| untildify | 4.0.0 | MIT |
| update-browserslist-db | 1.3.1 | MIT |
| util-deprecate | 1.0.2 | MIT |
| uuid | 7.0.3 | MIT |
| vite | 8.2.2 | MIT |
| which | 2.0.2 | ISC |
| wmf | 1.0.2 | Apache-2.0 |
| word | 0.3.0 | Apache-2.0 |
| wrap-ansi | 7.0.0 | MIT |
| xcode | 3.0.1 | Apache-2.0 |
| xlsx | 0.18.5 | Apache-2.0 |
| xml2js | 0.6.2 | MIT |
| xmlbuilder | 15.1.1 | MIT |
| yallist | 5.0.0 | BlueOak-1.0.0 |
| yauzl | 2.10.0 | MIT |

## License summary

| License | Count | Obligation for this project |
|---|---|---|
| MIT | 122 | Keep copyright notice with any substantial redistributed portions (satisfied by this file) |
| Apache-2.0 | 20 | Preserve notices; NOTICE files honored where present |
| ISC | 14 | Same as MIT |
| BlueOak-1.0.0 | 10 | No conditions beyond notice |
| MPL-2.0 | 2 | File-level copyleft; `lightningcss` is a build-time tool only, not shipped |
| Unlicense | 2 | Public domain, no obligations |
| 0BSD | 1 | No conditions |
| BSD-3-Clause | 1 | Keep copyright notice |
| CC-BY-4.0 | 1 | `caniuse-lite` data — attribution given here |
| OFL-1.1 | 1 | Inter font — full license text included below (bundled in product) |

---

## SIL Open Font License 1.1 — Inter font

Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

```text
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## Standard license texts (reference)

### MIT (applies to the 122 MIT-licensed packages above)

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Apache License 2.0 (applies to the 20 Apache-2.0 packages above)

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use these files except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations
under the License.

### ISC

```text
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### BSD-3-Clause (source-map-js)

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

### MPL-2.0 (lightningcss — build-time only, not shipped)

Mozilla Public License Version 2.0. Full text:
https://www.mozilla.org/MPL/2.0/ — lightningcss is used only during the
Tailwind/Vite build; no MPL-covered source is distributed with the product.

### CC-BY-4.0 (caniuse-lite — build-time data)

caniuse-lite browser compatibility data by the caniuse community,
licensed CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).
Attribution given here; the data is consumed at build time only.

### Unlicense (big-integer, stream-buffers) / 0BSD (tslib) / BlueOak-1.0.0

Dedicated to the public domain (Unlicense), zero-clause BSD, or
BlueOak Model License 1.0.0 respectively — no conditions apply.
