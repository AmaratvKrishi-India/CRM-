#!/usr/bin/env tsx
/**
 * CSP Header & OWASP Validation Test Script
 * Validates Content Security Policy headers and OWASP compliance
 */

import { program } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

program
  .option('-u, --url <url>', 'URL to test', 'http://localhost:3000')
  .option('-o, --output <file>', 'Output JSON file', 'test-results/security/csp-validation.json')
  .option('--format <type>', 'Output format: json, text', 'json')
  .option('--strict', 'Enable strict CSP validation', true)
  .parse(process.argv);

const options = program.opts();

interface CSPTestResult {
  timestamp: string;
  config: {
    url: string;
    strict: boolean;
  };
  csp: {
    header: string | null;
    parsed: CSPDirectives;
    score: number;
    issues: CSPIssue[];
  };
  owasp: {
    headers: OWASPHeaderCheck[];
    score: number;
    issues: OWASPIssue[];
  };
  summary: {
    cspScore: number;
    owaspScore: number;
    overallScore: number;
    passed: boolean;
  };
}

interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'upgrade-insecure-requests': boolean;
  'block-all-mixed-content': boolean;
  'require-trusted-types-for': string[];
  'trusted-types': string[];
  [key: string]: string[] | boolean;
}

interface CSPIssue {
  directive: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  message: string;
  recommendation: string;
}

interface OWASPHeaderCheck {
  header: string;
  present: boolean;
  value?: string;
  expected?: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  message: string;
}

interface OWASPIssue {
  category: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  message: string;
  recommendation: string;
}

const REQUIRED_OWASP_HEADERS = [
  {
    header: 'X-Content-Type-Options',
    expected: 'nosniff',
    severity: 'high' as const,
    message: 'Prevents MIME type sniffing',
  },
  {
    header: 'X-Frame-Options',
    expected: 'DENY',
    severity: 'high' as const,
    message: 'Prevents clickjacking',
  },
  {
    header: 'Referrer-Policy',
    expected: 'strict-origin-when-cross-origin',
    severity: 'moderate' as const,
    message: 'Controls referrer information',
  },
  {
    header: 'Permissions-Policy',
    severity: 'moderate' as const,
    message: 'Controls browser features',
  },
  {
    header: 'Strict-Transport-Security',
    expected: 'max-age=31536000; includeSubDomains; preload',
    severity: 'high' as const,
    message: 'Enforces HTTPS',
  },
  {
    header: 'Content-Security-Policy',
    severity: 'critical' as const,
    message: 'Content Security Policy',
  },
];

const DANGEROUS_CSP_VALUES = [
  { pattern: /'unsafe-inline'/, directive: 'script-src', severity: 'high', message: "'unsafe-inline' allows inline scripts" },
  { pattern: /'unsafe-eval'/, directive: 'script-src', severity: 'high', message: "'unsafe-eval' allows eval()" },
  { pattern: /'unsafe-hashes'/, directive: 'script-src', severity: 'moderate', message: "'unsafe-hashes' allows inline event handlers" },
  { pattern: /data:/, directive: 'script-src', severity: 'high', message: "data: URIs in script-src" },
  { pattern: /https?:/, directive: 'default-src', severity: 'moderate', message: "Wildcard HTTP/HTTPS in default-src" },
  { pattern: /\*/, directive: 'script-src', severity: 'high', message: "Wildcard in script-src" },
];

async function fetchHeaders(url: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  } catch (error) {
    console.error('Failed to fetch headers:', error);
    return {};
  }
}

function parseCSPHeader(header: string): CSPDirectives {
  const directives: CSPDirectives = {};
  const parts = header.split(';').map(p => p.trim()).filter(p => p);

  for (const part of parts) {
    const [directive, ...values] = part.split(/\s+/);
    const key = directive.toLowerCase();
    if (values.length > 0) {
      directives[key] = values;
    } else {
      directives[key] = true;
    }
  }

  return directives;
}

function validateCSP(parsed: CSPDirectives): CSPIssue[] {
  const issues: CSPIssue[] = [];

  // Check for missing important directives
  const importantDirectives = [
    'default-src', 'script-src', 'style-src', 'img-src',
    'connect-src', 'font-src', 'frame-src', 'object-src',
    'base-uri', 'form-action', 'frame-ancestors',
  ];

  for (const directive of importantDirectives) {
    if (!parsed[directive]) {
      issues.push({
        directive,
        severity: 'moderate',
        message: `Missing ${directive} directive`,
        recommendation: `Add ${directive} directive with restrictive values`,
      });
    }
  }

  // Check for dangerous values
  for (const { pattern, directive, severity, message } of DANGEROUS_CSP_VALUES) {
    const value = parsed[directive];
    if (Array.isArray(value)) {
      for (const v of value) {
        if (pattern.test(v)) {
          issues.push({
            directive,
            severity,
            message,
            recommendation: `Remove ${v} from ${directive}`,
          });
        }
      }
    } else if (typeof value === 'string' && pattern.test(value)) {
      issues.push({
        directive,
        severity,
        message,
        recommendation: `Remove ${value} from ${directive}`,
      });
    }
  }

  // Check for upgrade-insecure-requests
  if (!parsed['upgrade-insecure-requests']) {
    issues.push({
      directive: 'upgrade-insecure-requests',
      severity: 'moderate',
      message: 'Missing upgrade-insecure-requests directive',
      recommendation: 'Add upgrade-insecure-requests to automatically upgrade HTTP to HTTPS',
    });
  }

  // Check for require-trusted-types-for
  if (!parsed['require-trusted-types-for']) {
    issues.push({
      directive: 'require-trusted-types-for',
      severity: 'low',
      message: 'Missing require-trusted-types-for directive',
      recommendation: 'Add require-trusted-types-for \'script\' to prevent DOM XSS',
    });
  }

  // Check for trusted-types
  if (!parsed['trusted-types']) {
    issues.push({
      directive: 'trusted-types',
      severity: 'low',
      message: 'Missing trusted-types directive',
      recommendation: 'Define trusted-types policy to prevent DOM XSS',
    });
  }

  // Check frame-ancestors
  if (!parsed['frame-ancestors']) {
    issues.push({
      directive: 'frame-ancestors',
      severity: 'high',
      message: 'Missing frame-ancestors directive (clickjacking protection)',
      recommendation: "Add frame-ancestors 'none' or specific origins",
    });
  }

  return issues;
}

function validateOWASPHeaders(headers: Record<string, string>): { checks: OWASPHeaderCheck[]; issues: OWASPIssue[] } {
  const checks: OWASPHeaderCheck[] = [];
  const issues: OWASPIssue[] = [];

  for (const required of REQUIRED_OWASP_HEADERS) {
    const headerKey = required.header.toLowerCase();
    const value = headers[headerKey];

    const check: OWASPHeaderCheck = {
      header: required.header,
      present: !!value,
      value,
      expected: required.expected,
      severity: required.severity,
      message: required.message,
    };

    checks.push(check);

    if (!value) {
      issues.push({
        category: 'Missing Security Header',
        severity: required.severity,
        message: `Missing ${required.header}: ${required.message}`,
        recommendation: `Add ${required.header}: ${required.expected || 'appropriate value'}`,
      });
    } else if (required.expected && value !== required.expected) {
      issues.push({
        category: 'Incorrect Header Value',
        severity: required.severity,
        message: `${required.header} has unexpected value: ${value}`,
        recommendation: `Set ${required.header}: ${required.expected}`,
      });
    }
  }

  return { checks, issues };
}

function calculateCSPScore(issues: CSPIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 20; break;
      case 'high': score -= 15; break;
      case 'moderate': score -= 10; break;
      case 'low': score -= 5; break;
      case 'info': score -= 2; break;
    }
  }
  return Math.max(0, score);
}

function calculateOWASPScore(issues: OWASPIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 20; break;
      case 'high': score -= 15; break;
      case 'moderate': score -= 10; break;
      case 'low': score -= 5; break;
    }
  }
  return Math.max(0, score);
}

async function main(): Promise<void> {
  const url = options.url;
  const outputFile = options.output;
  const strict = options.strict === 'true';

  console.log(`Testing CSP & OWASP headers for: ${url}`);

  const headers = await fetchHeaders(url);

  if (Object.keys(headers).length === 0) {
    console.error('Failed to fetch headers from URL');
    process.exit(1);
  }

  // CSP Validation
  const cspHeader = headers['content-security-policy'] || headers['content-security-policy-report-only'] || null;
  const cspParsed = cspHeader ? parseCSPHeader(cspHeader) : {};
  const cspIssues = validateCSP(cspParsed);
  const cspScore = calculateCSPScore(cspIssues);

  // OWASP Header Validation
  const { checks, issues: owaspIssues } = validateOWASPHeaders(headers);
  const owaspScore = calculateOWASPScore(owaspIssues);

  // Overall score
  const overallScore = Math.round((cspScore * 0.6) + (owaspScore * 0.4));
  const passed = overallScore >= 80 && cspIssues.filter(i => i.severity === 'critical').length === 0;

  const result: CSPTestResult = {
    timestamp: new Date().toISOString(),
    config: { url, strict },
    csp: {
      header: cspHeader,
      parsed: cspParsed,
      score: cspScore,
      issues: cspIssues,
    },
    owasp: {
      headers: checks,
      score: owaspScore,
      issues: owaspIssues,
    },
    summary: {
      cspScore,
      owaspScore,
      overallScore,
      passed,
    },
  };

  // Write results
  mkdirSync('test-results/security', { recursive: true });
  writeFileSync(outputFile, JSON.stringify(result, null, 2));

  // Print summary
  console.log('\n=== CSP & OWASP VALIDATION SUMMARY ===');
  console.log(`URL: ${url}`);
  console.log(`\nCSP Header: ${cspHeader ? 'Present' : 'MISSING'}`);
  console.log(`CSP Score: ${cspScore}/100`);
  console.log(`OWASP Score: ${owaspScore}/100`);
  console.log(`Overall Score: ${overallScore}/100`);
  console.log(`\nCSP Issues: ${cspIssues.length}`);
  cspIssues.forEach(i => console.log(`  [${i.severity.toUpperCase()}] ${i.directive}: ${i.message}`));
  console.log(`\nOWASP Issues: ${owaspIssues.length}`);
  owaspIssues.forEach(i => console.log(`  [${i.severity.toUpperCase()}] ${i.category}: ${i.message}`));
  console.log(`\nOverall: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
