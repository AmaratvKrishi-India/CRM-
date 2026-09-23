import { describe, expect, it } from 'vitest';
import { sanitizeCsvCell } from '../../src/services/adminReportsService';

describe('Admin report CSV serialization', () => {
  it.each(['=SUM(1,1)', '+1+1', '-2+2', '@SUM(1,1)', '\t=SUM(1,1)', '\r=SUM(1,1)', '\n=SUM(1,1)'])
    ('neutralizes spreadsheet formula prefix %j', (value) => {
      expect(sanitizeCsvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
    });

  it('neutralizes formulas after leading whitespace', () => {
    expect(sanitizeCsvCell('  =SUM(1,1)')).toBe('"\'  =SUM(1,1)"');
  });

  it('preserves ordinary values and CSV quote escaping', () => {
    expect(sanitizeCsvCell('Acme, "North"')).toBe('"Acme, ""North"""');
    expect(sanitizeCsvCell(false)).toBe('"false"');
    expect(sanitizeCsvCell(0)).toBe('"0"');
  });
});
