import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const out = path.join(root, 'THIRD_PARTY_LICENSES.md');
const packages = Object.entries(lock.packages || {}).filter(([location]) => location);

function packageName(location) {
  const tail = location.split('node_modules/').at(-1);
  const parts = tail.split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function installed(location) {
  return fs.existsSync(path.join(root, ...location.split('/')));
}

function rowEscape(value) {
  return String(value ?? 'UNKNOWN').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const inventory = packages.map(([location, meta]) => ({
  name: packageName(location), location, version: meta.version || 'UNKNOWN',
  license: meta.license || 'UNKNOWN', dev: meta.dev === true, optional: meta.optional === true,
  installed: installed(location),
}));
const counts = new Map();
for (const item of inventory) counts.set(item.license, (counts.get(item.license) || 0) + 1);
const licenseSummary = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const installedCount = inventory.filter((item) => item.installed).length;
const directRuntime = Object.keys(pkg.dependencies || {}).map((name) => {
  const meta = lock.packages?.[`node_modules/${name}`] || {};
  return { name, version: meta.version || 'UNKNOWN', license: meta.license || 'UNKNOWN' };
});
const reviewLicenses = inventory.filter((item) =>
  /GPL|LGPL|AGPL|MPL|EPL|CDDL|OSL/i.test(item.license) || item.license === 'UNKNOWN'
);

const lines = [];
lines.push('# Third-Party License Inventory', '');
lines.push('**Project:** Amaratv Krishi Field Sales CRM v2.0.0');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)} from \`package-lock.json\``);
lines.push(`**Lockfile package entries:** ${inventory.length}`);
lines.push(`**Present in this node_modules tree:** ${installedCount}`, '');
lines.push('This is an engineering inventory, not legal advice. It reports SPDX/license metadata supplied by the dependency tree. It does not by itself prove that every package is shipped in the final browser or APK bundle, nor that all notice/source obligations have been satisfied. Perform release-specific notice and bundle review before distribution.', '');
lines.push('The dependency graph is not exclusively permissive: MPL-2.0 packages are present, and `jszip` is declared `(MIT OR GPL-3.0-or-later)`. An `OR` expression offers alternative licensing paths; its presence must not be summarized as "GPL code is necessarily imposed on the application."', '');
lines.push('## Declared runtime dependencies', '');
lines.push('| Package | Locked version | License |', '|---|---:|---|');
for (const item of directRuntime) {
  lines.push(`| ${rowEscape(item.name)} | ${rowEscape(item.version)} | ${rowEscape(item.license)} |`);
}
lines.push('', '## License summary for the lockfile', '');
lines.push('| License metadata | Entries |', '|---|---:|');
for (const [license, count] of licenseSummary) {
  lines.push(`| ${rowEscape(license)} | ${count} |`);
}
lines.push('', '## Licenses requiring explicit release review', '');
lines.push('These entries are highlighted because they contain copyleft/weak-copyleft terms, an alternative GPL path, or missing metadata. Their presence is not a conclusion about final product obligations. Dev-only status is shown explicitly because lockfile presence is broader than shipped browser/APK code.', '');
lines.push('| Package | Version | License | Dev only | Installed here | Dependency location |', '|---|---:|---|:---:|:---:|---|');
for (const item of reviewLicenses) {
  lines.push(`| ${rowEscape(item.name)} | ${rowEscape(item.version)} | ${rowEscape(item.license)} | ${item.dev ? 'Yes' : 'No'} | ${item.installed ? 'Yes' : 'No'} | \`${rowEscape(item.location)}\` |`);
}
lines.push('', '## Complete lockfile inventory', '');
lines.push('| Package | Version | License | Dev | Optional | Installed here | Dependency location |', '|---|---:|---|:---:|:---:|:---:|---|');
for (const item of inventory.sort((a, b) => a.location.localeCompare(b.location))) {
  lines.push(`| ${rowEscape(item.name)} | ${rowEscape(item.version)} | ${rowEscape(item.license)} | ${item.dev ? 'Yes' : 'No'} | ${item.optional ? 'Yes' : 'No'} | ${item.installed ? 'Yes' : 'No'} | \`${rowEscape(item.location)}\` |`);
}
lines.push('', '## Regeneration', '');
lines.push('Run the generator after dependency changes:', '', '```powershell', 'node scripts/generate-third-party-licenses.mjs', '```', '');
lines.push('Before a release, also inspect the built `dist/` and Android dependency outputs because lockfile presence is broader than shipped-code presence. Preserve third-party NOTICE/license files when the selected licenses require them.', '');

const interLicense = path.join(root, 'node_modules', '@fontsource', 'inter', 'LICENSE');
if (fs.existsSync(interLicense)) {
  lines.push('## Inter font license text', '', 'The Inter font is bundled locally through `@fontsource/inter`. The installed package supplies the following license text:', '', '```text');
  lines.push(fs.readFileSync(interLicense, 'utf8').trim());
  lines.push('```', '');
}

fs.writeFileSync(out, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, out)}: ${inventory.length} lock entries, ${installedCount} installed entries, ${licenseSummary.length} license labels.`);
