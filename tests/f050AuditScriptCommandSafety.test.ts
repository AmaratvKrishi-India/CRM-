import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const auditScript = path.resolve(here, '../scripts/accessibility-regional-test.ts');

describe('F050: audit CLI command safety', () => {
  it('passes CLI-controlled accessibility arguments without shell interpolation', () => {
    const source = fs.readFileSync(auditScript, 'utf8');

    assert.match(source, /import \{ spawnSync \} from 'child_process'/);
    assert.match(source, /spawnSync\(process\.execPath, args,/);
    assert.match(source, /shell:\s*false/);
    assert.match(source, /\r?\n\s*pattern,\r?\n\s*`--region=\$\{region\}`/);
    assert.doesNotMatch(source, /\bexecSync\s*\(/);
    assert.doesNotMatch(source, /const cmd = `npx/);
  });

  it('keeps machine-generated verifier output separate from authoritative GATES.md', () => {
    const verifySource = fs.readFileSync(path.resolve(here, '../scripts/verify.ts'), 'utf8');

    assert.match(verifySource, /AUTOMATED_VERIFICATION_GATES\.md/);
    assert.doesNotMatch(verifySource, /const gatesFile = path\.join\(rootDir, 'GATES\.md'\)/);
  });
  it('does not interpolate ADB paths or serials through a shell', () => {
    const verifySource = fs.readFileSync(path.resolve(here, '../scripts/verify.ts'), 'utf8');
    const multiDeviceSource = fs.readFileSync(path.resolve(here, './multiDeviceSync.test.ts'), 'utf8');

    assert.match(verifySource, /execFileSync\(adbPath,/);
    assert.doesNotMatch(verifySource, /execSync\(`"\$\{adbPath\}/);
    assert.match(multiDeviceSource, /execFileSync\(ADB,/);
    assert.doesNotMatch(multiDeviceSource, /execSync\(`"\$\{ADB\}/);
  });

});
