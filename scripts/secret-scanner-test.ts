#!/usr/bin/env tsx
/**
 * Secret Scanner Test Script
 * Scans for secrets, API keys, tokens, and sensitive data in codebase
 */

import { program } from 'commander';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';

program
  .option('-p, --pattern <glob>', 'File pattern to scan', '**/*')
  .option('-e, --exclude <patterns>', 'Comma-separated exclude patterns', 'node_modules/**,dist/**,build/**,**/build/**,.git/**,.env*,graft/**,android/app/src/main/assets/**,*.lock,*.log,coverage/**,test-results/**,scratch/**,local/**,strix/**,reports/**')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/security/secret-scan.json')
  .option('--fail-on-found', 'Exit with error code if secrets found', true)
  .parse(process.argv);

const options = program.opts();

interface SecretScanResult {
  timestamp: string;
  config: {
    pattern: string;
    excludePatterns: string[];
  };
  findings: SecretFinding[];
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    passed: boolean;
  };
}

interface SecretFinding {
  file: string;
  line: number;
  column: number;
  type: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  secret: string; // Masked
  context: string;
  ruleId: string;
}

const SECRET_PATTERNS: Array<{ regex: RegExp; type: string; severity: SecretFinding['severity']; ruleId: string }> = [
  // AWS
  { regex: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key ID', severity: 'critical', ruleId: 'AWS_ACCESS_KEY' },
  {
    regex: /(?:aws[_-]?secret(?:[_-]?access)?[_-]?key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}['"]?/gi,
    type: 'AWS Secret Access Key',
    severity: 'critical',
    ruleId: 'AWS_SECRET_KEY',
  },

  // GitHub
  { regex: /gh[pousr]_[A-Za-z0-9_]{36,251}/g, type: 'GitHub Token', severity: 'critical', ruleId: 'GITHUB_TOKEN' },
  { regex: /github_pat_[A-Za-z0-9_]{22,}/g, type: 'GitHub PAT', severity: 'critical', ruleId: 'GITHUB_PAT' },

  // Generic API Keys
  { regex: /api[_-]?key[_-]?[:=]\s*['"]?[A-Za-z0-9-_]{20,}['"]?/gi, type: 'API Key', severity: 'high', ruleId: 'API_KEY' },
  { regex: /api[_-]?secret[_-]?[:=]\s*['"]?[A-Za-z0-9-_]{20,}['"]?/gi, type: 'API Secret', severity: 'high', ruleId: 'API_SECRET' },

  // Database URLs
  { regex: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^/\s]+\/[^"\s]+/gi, type: 'PostgreSQL Connection String', severity: 'critical', ruleId: 'PG_CONNECTION_STRING' },
  { regex: /mysql:\/\/[^:\s]+:[^@\s]+@[^/\s]+\/[^"\s]+/gi, type: 'MySQL Connection String', severity: 'critical', ruleId: 'MYSQL_CONNECTION_STRING' },
  { regex: /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^/\s]+\/[^"\s]+/gi, type: 'MongoDB Connection String', severity: 'critical', ruleId: 'MONGO_CONNECTION_STRING' },

  // Supabase
  { regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, type: 'Supabase JWT', severity: 'high', ruleId: 'SUPABASE_JWT' },
  { regex: /supabase[_-]?url[_-]?[:=]\s*['"]?https?:\/\/[^"'\s]+['"]?/gi, type: 'Supabase URL', severity: 'moderate', ruleId: 'SUPABASE_URL' },
  // Source-code secrets must be literal values. Requiring quotes avoids treating
  // safe identifiers such as `VITE_SUPABASE_ANON_KEY: playwrightSupabaseAnonKey`
  // as credentials while JWT-shaped values remain covered by SUPABASE_JWT above.
  { regex: /supabase[_-]?(?:anon[_-]?|service[_-]?)?key[_-]?[:=]\s*['"][A-Za-z0-9-_]{20,}['"]/gi, type: 'Supabase Key', severity: 'high', ruleId: 'SUPABASE_KEY' },

  // Generic Secrets
  { regex: /secret[_-]?[:=]\s*['"]?[A-Za-z0-9-_]{20,}['"]?/gi, type: 'Generic Secret', severity: 'high', ruleId: 'GENERIC_SECRET' },
  { regex: /(?:password|passwd|pwd)[_-]?\s*[:=]\s*['"][^"']{8,}['"]/gi, type: 'Password', severity: 'high', ruleId: 'PASSWORD' },
  { regex: /private[_-]?key[_-]?[:=]\s*['"]?[A-Za-z0-9/+=]{40,}['"]?/gi, type: 'Private Key', severity: 'critical', ruleId: 'PRIVATE_KEY' },

  // JWT Tokens
  { regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, type: 'JWT Token', severity: 'high', ruleId: 'JWT_TOKEN' },

  // Private Keys
  { regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, type: 'Private Key Block', severity: 'critical', ruleId: 'PRIVATE_KEY_BLOCK' },
  { regex: /-----BEGIN (?:RSA |EC |DSA )?PUBLIC KEY-----/g, type: 'Public Key Block', severity: 'low', ruleId: 'PUBLIC_KEY_BLOCK' },

  // Slack
  { regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g, type: 'Slack Token', severity: 'high', ruleId: 'SLACK_TOKEN' },

  // Stripe
  { regex: /sk_live_[A-Za-z0-9]{24,}/g, type: 'Stripe Secret Key', severity: 'critical', ruleId: 'STRIPE_SECRET_KEY' },
  { regex: /pk_live_[A-Za-z0-9]{24,}/g, type: 'Stripe Publishable Key', severity: 'moderate', ruleId: 'STRIPE_PUBLISHABLE_KEY' },

  // Google
  { regex: /AIza[A-Za-z0-9_-]{35}/g, type: 'Google API Key', severity: 'high', ruleId: 'GOOGLE_API_KEY' },
  { regex: /ya29\.[A-Za-z0-9_-]+/g, type: 'Google OAuth Token', severity: 'high', ruleId: 'GOOGLE_OAUTH_TOKEN' },

  // Azure
  { regex: /[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}/g, type: 'Azure UUID (possible)', severity: 'low', ruleId: 'AZURE_UUID' },

  // Heroku
  { regex: /heroku[_-]?[A-Za-z0-9]{32,}/g, type: 'Heroku Token', severity: 'high', ruleId: 'HEROKU_TOKEN' },

  // npm
  { regex: /npm_[A-Za-z0-9]{36,}/g, type: 'npm Token', severity: 'high', ruleId: 'NPM_TOKEN' },

  // Docker
  { regex: /docker[_-]?[A-Za-z0-9]{32,}/g, type: 'Docker Token', severity: 'high', ruleId: 'DOCKER_TOKEN' },

  // Kubernetes
  { regex: /kube[_-]?config/gi, type: 'Kubeconfig Reference', severity: 'moderate', ruleId: 'KUBECONFIG_REF' },

  // .env files
  { regex: /^\s*[A-Z_]+[_-]?(?:KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^#\s]+/gm, type: 'Env Variable Assignment', severity: 'moderate', ruleId: 'ENV_SECRET_ASSIGNMENT' },
];

function loadConfiguredPublicSupabaseAnonKey(): string | null {
  try {
    const env = readFileSync(join(process.cwd(), '.env.production'), 'utf-8');
    const match = env.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$/m);
    if (!match) return null;
    return match[1].replace(/^(['"])(.*)\1$/, '$2');
  } catch {
    return null;
  }
}

const configuredPublicSupabaseAnonKey = loadConfiguredPublicSupabaseAnonKey();

function relativeFilePath(file: string): string {
  return relative(process.cwd(), file).replace(/\\/g, '/');
}

function isIntentionalPublicClientKey(ruleId: string, value: string): boolean {
  // The Supabase anon key is intentionally shipped to the browser. Only the
  // exact configured production value is exempted; arbitrary JWTs still fail.
  return (
    (ruleId === 'SUPABASE_JWT' || ruleId === 'JWT_TOKEN') &&
    configuredPublicSupabaseAnonKey !== null &&
    value === configuredPublicSupabaseAnonKey
  );
}

function isIntentionalDisabledLoopbackPg(ruleId: string, value: string): boolean {
  if (ruleId !== 'PG_CONNECTION_STRING') return false;
  return /^postgres(?:ql)?:\/\//i.test(value) && /@(?:127\.0\.0\.1|localhost|\[::1\]):1\/disabled(?:[^A-Za-z0-9]|$)/i.test(value);
}

function isInteractiveMaestroPrompt(relativePath: string, ruleId: string, lines: string[], lineNumber: number): boolean {
  if (ruleId !== 'PASSWORD' || !relativePath.endsWith('run-local-audit.bat')) return false;
  const line = lines[lineNumber - 1] ?? '';
  return /set\s+\/p/i.test(line) && /MAESTRO_[A-Z_]*PASSWORD/i.test(line) && /Local (?:Maestro |provisioned-agent )/i.test(line);
}

function maskSecret(secret: string, visibleChars: number = 4): string {
  if (secret.length <= visibleChars * 2) {
    return '*'.repeat(secret.length);
  }
  return secret.substring(0, visibleChars) + '*'.repeat(secret.length - visibleChars * 2) + secret.substring(secret.length - visibleChars);
}

function getContext(content: string, line: number, contextLines: number = 2): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - contextLines - 1);
  const end = Math.min(lines.length, line + contextLines);
  return lines.slice(start, end).join('\n');
}

async function scanFile(file: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];

  try {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of SECRET_PATTERNS) {
      let match;
      pattern.regex.lastIndex = 0; // Reset regex

      while ((match = pattern.regex.exec(content)) !== null) {
        const matchIndex = match.index;
        const lineNumber = content.substring(0, matchIndex).split('\n').length;
        const column = matchIndex - content.lastIndexOf('\n', matchIndex - 1);

        // Skip if in test file or example
        const relativePath = relativeFilePath(file);
        if (relativePath.includes('.test.') || relativePath.includes('.spec.') || relativePath.includes('test/fixtures/')) {
          continue;
        }

        // Documentation and config templates intentionally contain marker
        // values. They are not credentials and must not be reported as such.
        if (/(?:your_|<[^>]+>|\[redacted\]|placeholder|example)/i.test(match[0])) {
          continue;
        }

        if (isIntentionalPublicClientKey(pattern.ruleId, match[0])) {
          continue;
        }

        if (isIntentionalDisabledLoopbackPg(pattern.ruleId, match[0])) {
          continue;
        }

        // Interactive local-audit prompts request input at runtime; they do
        // not contain a credential value and must not be reported as one.
        if (isInteractiveMaestroPrompt(relativePath, pattern.ruleId, lines, lineNumber)) {
          continue;
        }

        // Skip if in .env.example or similar
        if (relativePath.endsWith('.env.example') || relativePath.endsWith('.env.template')) {
          continue;
        }

        findings.push({
          file: relativePath,
          line: lineNumber,
          column,
          type: pattern.type,
          severity: pattern.severity,
          secret: maskSecret(match[0]),
          context: getContext(content, lineNumber),
          ruleId: pattern.ruleId,
        });

        // Prevent infinite loop
        if (match[0].length === 0) break;
      }
    }
  } catch (error) {
    console.warn('Failed to scan file %s:', file, error);
  }

  return findings;
}

async function main(): Promise<void> {
  const pattern = options.pattern;
  const excludePatterns = options.exclude.split(',').map((p: string) => p.trim());
  const outputFile = options.output;

  console.log(`Scanning files matching: ${pattern}`);
  console.log(`Excluding: ${excludePatterns.join(', ')}`);

  const files = await glob(pattern, {
    ignore: excludePatterns,
    nodir: true,
    absolute: true,
  });

  console.log(`Found ${files.length} files to scan`);

  const allFindings: SecretFinding[] = [];

  for (const file of files) {
    const findings = await scanFile(file);
    allFindings.push(...findings);
  }

  // Deduplicate findings (same file, line, rule)
  const uniqueFindings = allFindings.filter((finding, index, self) =>
    index === self.findIndex(f => f.file === finding.file && f.line === finding.line && f.ruleId === finding.ruleId)
  );

  // Summary
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const finding of uniqueFindings) {
    byType[finding.type] = (byType[finding.type] || 0) + 1;
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  }

  const passed = uniqueFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0;

  const result: SecretScanResult = {
    timestamp: new Date().toISOString(),
    config: {
      pattern,
      excludePatterns,
    },
    findings: uniqueFindings,
    summary: {
      total: uniqueFindings.length,
      byType,
      bySeverity,
      passed,
    },
  };

  // Write results
  mkdirSync('test-results/security', { recursive: true });
  writeFileSync(outputFile, JSON.stringify(result, null, 2));

  // Print summary
  console.log('\n=== SECRET SCAN SUMMARY ===');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Total findings: ${uniqueFindings.length}`);
  console.log(`By severity:`);
  console.log(`  Critical: ${bySeverity.critical || 0}`);
  console.log(`  High: ${bySeverity.high || 0}`);
  console.log(`  Moderate: ${bySeverity.moderate || 0}`);
  console.log(`  Low: ${bySeverity.low || 0}`);
  console.log(`\nBy type:`);
  for (const [type, count] of Object.entries(byType).sort(([,a], [,b]) => b - a)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (uniqueFindings.length > 0) {
    console.log('\nTop findings:');
    uniqueFindings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 10)
      .forEach(f => {
        console.log(`  [${f.severity.toUpperCase()}] ${f.file}:${f.line} - ${f.type} (${f.ruleId})`);
        console.log(`    ${f.secret}`);
      });
  }

  if (!passed && (options.failOnFound === true || options.failOnFound === 'true')) {
    console.log('\n❌ Critical/High severity secrets found. Failing build.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
