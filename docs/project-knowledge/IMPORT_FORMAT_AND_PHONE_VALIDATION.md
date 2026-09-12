# Import Values and Phone Validation

**Document status:** CURRENT
**Last reviewed:** 2026-09-10
**Source of truth:** importer, parser, lead normalizer, and import tests

The app reads `.xlsx` with `read-excel-file` and `.csv` with Papa Parse. It does not
calculate formulas, open linked workbooks or fetch external workbook URLs. A formula
cell with a saved cached value can import that value, including an external-reference
formula. Without a cached value it is empty; missing required name/phone values are
reported during preview. A cached value can be out of date.

Before importing, recalculate the workbook in its spreadsheet application, check
the displayed values, and paste formulas as values into a self-contained copy (or
export a values-only CSV). Keep phone cells as text so leading zeros and country
prefixes are preserved. Review the import preview and correct rejected rows before
writing records. Do not share workbooks or backups containing business data publicly.

Phone normalization validates supported formats, lengths and prefixes. It handles
the supported Indian country-code/mobile/landline representations and produces the
local clean/E.164 form. A format-valid phone number does not prove ownership, current
carrier allocation, availability or reachability. The app does not perform an OTP,
carrier lookup or test call as part of import. Treat a number as unverified until
your ordinary contact workflow establishes it. No allocation-validation product
requirement has been established by findings F017/F019.

Evidence: `tests/realExcelParser.test.ts`, `tests/f019FormulaImport.test.ts`,
`tests/utils/phone-utils.test.ts` and the actual normalizer/parser source. The new
formula regression constructs a real XLSX with cached and uncached external formulas;
preview accepts the cached row and reports the missing business name on the other.
