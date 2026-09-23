import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const localBin = join(projectRoot, 'node_modules', '.bin');

type Tool = {
  name: string;
  category: string;
  command: string;
  scope: string;
  paths?: string[];
  note?: string;
  probeArgs?: string[];
};

const userProfile = process.env.USERPROFILE ?? '';

const tools: Tool[] = [
  { name: 'TypeScript', category: 'Build/typecheck', command: 'tsc', scope: 'project-local' },
  { name: 'Vite', category: 'Build/dev server', command: 'vite', scope: 'project-local' },
  { name: 'Vitest', category: 'Unit/component tests', command: 'vitest', scope: 'project-local' },
  { name: 'Playwright', category: 'Browser E2E', command: 'playwright', scope: 'project-local' },
  { name: 'Cypress', category: 'Browser E2E', command: 'cypress', scope: 'project-local' },
  { name: 'Nightwatch', category: 'Browser E2E', command: 'nightwatch', scope: 'project-local', note: 'Installed; use only after supplying a project-specific Nightwatch test source.' },
  { name: 'Appium', category: 'Mobile E2E', command: 'appium', scope: 'project-local' },
  { name: 'Stryker', category: 'Mutation testing', command: 'stryker', scope: 'project-local' },
  { name: 'Artillery', category: 'Load testing', command: 'artillery', scope: 'project-local' },
  { name: 'Autocannon', category: 'Load testing', command: 'autocannon', scope: 'project-local' },
  { name: 'Dependency Cruiser', category: 'Architecture', command: 'depcruise', scope: 'project-local' },
  { name: 'Knip', category: 'Dead code/dependencies', command: 'knip', scope: 'project-local' },
  { name: 'Secretlint', category: 'Secret scanning', command: 'secretlint', scope: 'project-local' },
  { name: 'Snyk', category: 'Dependency/security scanning', command: 'snyk', scope: 'project-local', note: 'CLI is installed; account/token is only needed for authenticated Snyk services.' },
  { name: 'Supabase CLI', category: 'Database/functions', command: 'supabase', scope: 'project-local', paths: isWindows ? [join(projectRoot, 'node_modules', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe')] : [], probeArgs: ['--version'] },
  { name: 'Capacitor CLI', category: 'Native packaging', command: 'cap', scope: 'project-local' },
  { name: 'Jest', category: 'Alternative unit runner', command: 'jest', scope: 'project-local', note: 'Installed but Vitest is the project’s configured unit runner.' },
  { name: 'Mocha', category: 'Alternative unit runner', command: 'mocha', scope: 'project-local', note: 'Installed but Vitest is the project’s configured unit runner.' },
  { name: 'AVA', category: 'Alternative unit runner', command: 'ava', scope: 'project-local', note: 'Installed but Vitest is the project’s configured unit runner.' },
  { name: 'TAP', category: 'Alternative unit runner', command: 'tap', scope: 'project-local', note: 'Installed but Vitest is the project’s configured unit runner.' },
  { name: 'Karma', category: 'Alternative browser runner', command: 'karma', scope: 'project-local', note: 'Installed but Playwright is the project’s configured browser runner.' },
  { name: 'TestCafe', category: 'Alternative browser runner', command: 'testcafe', scope: 'project-local', note: 'Installed but Playwright is the project’s configured browser runner.' },
  { name: 'Fallow', category: 'Code health/security', command: 'fallow', scope: 'standalone', paths: [join(userProfile, '.local', 'bin', 'fallow.exe'), 'C:\\Users\\PC\\AppData\\Local\\Programs\\fallow\\fallow.exe'] },
  { name: 'Strix', category: 'AI security testing', command: 'strix', scope: 'standalone', paths: [join(userProfile, '.local', 'bin', 'strix.exe')], note: 'Executable is present; authentication/model access is checked only when a scan starts.' },
  { name: 'Graft', category: 'Codebase context graph', command: 'graft', scope: 'global npm', paths: [join(userProfile, 'AppData', 'Roaming', 'npm', 'graft.cmd')], probeArgs: ['--version'], note: 'Pinned to 0.12.1 on Windows/Node 26 until the upstream tree-sitter-kotlin native-build issue is resolved.' },
  { name: 'Semgrep', category: 'SAST', command: 'semgrep', scope: 'standalone', paths: [join(userProfile, 'Tools', 'SecurityAudit', 'semgrep.cmd')] },
  { name: 'Gitleaks', category: 'Secret scanning', command: 'gitleaks', scope: 'standalone', paths: ['C:\\Users\\PC\\Tools\\SecurityAudit\\gitleaks.cmd'] },
  { name: 'Trivy', category: 'Container/dependency scanning', command: 'trivy', scope: 'standalone', paths: ['C:\\Users\\PC\\Tools\\SecurityAudit\\trivy.cmd'] },
  { name: 'OSV-Scanner', category: 'Dependency scanning', command: 'osv-scanner', scope: 'standalone', paths: ['C:\\Users\\PC\\Tools\\SecurityAudit\\osv-scanner.cmd'] },
  { name: 'ZAP', category: 'DAST', command: 'zap', scope: 'standalone', paths: ['C:\\Users\\PC\\Tools\\SecurityAudit\\zap.cmd'], note: 'Requires the preview server at http://127.0.0.1:4174 for audit:zap.' },
  { name: 'MobSF', category: 'Mobile security', command: 'mobsf', scope: 'standalone', paths: ['C:\\Users\\PC\\Tools\\SecurityAudit\\mobsf.cmd'], note: 'Uses host port 8003 by default because Supabase uses port 8000.' },
  { name: 'Docker', category: 'Containers', command: 'docker', scope: 'system' },
  { name: 'ADB', category: 'Android device testing', command: 'adb', scope: 'Android SDK' },
  { name: 'Maestro', category: 'Mobile UI testing', command: 'maestro', scope: 'standalone', paths: ['C:\\maestro\\bin\\maestro.bat'] },
  { name: 'k6', category: 'Load testing', command: 'k6', scope: 'system', paths: ['C:\\ProgramData\\chocolatey\\bin\\k6.exe'] },
  { name: 'Gradle wrapper', category: 'Android build/test', command: 'gradlew.bat', scope: 'project-local', paths: [join(projectRoot, 'android', 'gradlew.bat')] },
];

function commandPath(command: string, paths: string[] = []): string | undefined {
  for (const candidate of paths) {
    if (existsSync(candidate)) return candidate;
  }

  const localCandidate = join(localBin, isWindows ? `${command}.cmd` : command);
  if (existsSync(localCandidate)) return localCandidate;

  const lookup = spawnSync(isWindows ? 'where.exe' : 'which', [command], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (lookup.status === 0) {
    const first = String(lookup.stdout).split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }
  return undefined;
}

const rows = tools.map((tool) => {
  const found = commandPath(tool.command, tool.paths);
  const isBatchShim = Boolean(found && isWindows && /\.(?:cmd|bat)$/i.test(found));
  const probe = found && tool.probeArgs
    ? spawnSync(
      // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process -- `found` is resolved from the local/system toolchain and shell execution is disabled.
      isBatchShim ? (process.env.ComSpec ?? 'cmd.exe') : found,
      isBatchShim ? ['/d', '/c', `${found} ${tool.probeArgs.join(' ')}`] : tool.probeArgs,
      { encoding: 'utf8', windowsHide: true, shell: false },
    )
    : undefined;
  const usable = Boolean(found) && (!probe || probe.status === 0);
  const status = usable ? 'READY' : 'ATTENTION';
  const probeFailure = probe && probe.status !== 0
    ? `Probe failed (exit ${probe.status ?? 'unknown'}).`
    : '';
  return {
    ...tool,
    path: found ?? 'not found',
    status,
    note: probeFailure || tool.note || '',
  };
});

const headings = ['Tool', 'Category', 'Scope', 'Command/path', 'Status', 'Notes'];
const values = rows.map((row) => [row.name, row.category, row.scope, row.path, row.status, row.note ?? '']);
const widths = headings.map((heading, index) => Math.max(heading.length, ...values.map((row) => row[index].length)));
const format = (row: string[]) => row.map((value, index) => value.padEnd(widths[index])).join(' | ');

console.log(`Project toolchain: ${projectRoot}`);
console.log(format(headings));
console.log(widths.map((width) => '-'.repeat(width)).join('-|-'));
for (const row of values) console.log(format(row));

const attention = rows.filter((row) => row.status === 'ATTENTION');
console.log(`\nReady: ${rows.length - attention.length}/${rows.length}; attention: ${attention.length}`);
if (attention.length > 0) process.exitCode = 1;
