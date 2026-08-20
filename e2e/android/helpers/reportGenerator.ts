import fs from 'fs';
import path from 'path';
import { DeviceProperties } from './adbHelper';

export type TestStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'MANUAL_REQUIRED' | 'NOT_APPLICABLE';

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  durationMs: number;
  reason: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export interface AndroidE2EReport {
  timestamp: string;
  appId: string;
  apkPath: string;
  device: {
    id: string;
    properties?: DeviceProperties;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    manualRequired: number;
    notApplicable: number;
    durationMs: number;
    verdict: 'READY FOR PRODUCTION' | 'READY FOR RELEASE CANDIDATE' | 'BLOCKED';
  };
  tests: TestCaseResult[];
}

export class ReportGenerator {
  static generateJsonReport(report: AndroidE2EReport, outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  }

  static generateMarkdownReport(report: AndroidE2EReport, outputPath: string): void {
    const { device, summary, tests } = report;
    const props = device.properties;

    const md = `# Amaratv Krishi CRM — Android Automated Device QA Report

> **Execution Date:** ${report.timestamp}  
> **Target Application:** \`${report.appId}\`  
> **Target Device:** ${props ? `${props.manufacturer} ${props.model} (Android ${props.androidVersion}, API ${props.sdkVersion}, ${props.abi})` : device.id}  
> **Final Verdict:** **${summary.verdict}**

---

## 1. Summary of E2E Results

| Total Tests | Passed | Failed | Blocked | Manual Required | Total Duration |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **${summary.total}** | **${summary.passed}** | **${summary.failed}** | **${summary.blocked}** | **${summary.manualRequired}** | **${(summary.durationMs / 1000).toFixed(2)}s** |

---

## 2. Test Case Execution Matrix

| # | Test Case | Category | Status | Duration | Screenshot / Evidence | Details |
|---|-----------|----------|:------:|:--------:|:---------------------:|---------|
${tests
  .map((t, idx) => {
    const statusBadge =
      t.status === 'PASS'
        ? '`PASS`'
        : t.status === 'FAIL'
        ? '**`FAIL`**'
        : t.status === 'BLOCKED'
        ? '**`BLOCKED`**'
        : '`MANUAL_REQUIRED`';

    const screenshotRef = t.screenshot ? `[${path.basename(t.screenshot)}](${t.screenshot})` : '—';
    return `| ${idx + 1} | **${t.name}** | ${t.category} | ${statusBadge} | ${t.durationMs}ms | ${screenshotRef} | ${t.reason} |`;
  })
  .join('\n')}

---

## 3. Visual Artifacts & Screen Captures

${tests
  .filter((t) => t.screenshot && fs.existsSync(t.screenshot))
  .map((t) => `### ${t.name}\n![${t.name}](${t.screenshot})\n`)
  .join('\n')}

---

## 4. Release Decision

### **${summary.verdict}**

*Generated automatically by Amaratv Krishi Android Device E2E Test Suite*
`;

    fs.writeFileSync(outputPath, md, 'utf8');
  }
}
