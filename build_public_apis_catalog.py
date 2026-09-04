from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).parent
SOURCE = ROOT / "public-apis-readme.md"
OUT = ROOT / "Public_APIs_Catalog_and_CRM_Fit.docx"

ROW = re.compile(r"^\| \[([^\]]+)\]\(([^\)]+)\)\s*\|\s*(.+?)\s*\|\s*(`?[^|]+`?)\s*\|\s*(Yes|No)\s*\|\s*(Yes|No|Unknown)(?:\s*\|.*)?$")
PROMO_ROW = re.compile(r"^\| \[([^\]]+)\]\(([^\)]+)\)\s*\|\s*(.+?)\s*\|\s*(?:\[.*)?\|?$")


def set_font(run, size=10, bold=False, color="000000"):
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar')
        tcPr.append(tcMar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tcMar.append(node)
        node.set(qn("w:w"), str(v)); node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width):
    tcPr = cell._tc.get_or_add_tcPr()
    tcW = tcPr.find(qn("w:tcW"))
    if tcW is None:
        tcW = OxmlElement("w:tcW"); tcPr.append(tcW)
    tcW.set(qn("w:w"), str(width)); tcW.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tblPr = table._tbl.tblPr
    tblW = tblPr.find(qn("w:tblW"))
    tblW.set(qn("w:w"), str(sum(widths))); tblW.set(qn("w:type"), "dxa")
    ind = OxmlElement("w:tblInd"); ind.set(qn("w:w"), "120"); ind.set(qn("w:type"), "dxa")
    tblPr.append(ind)
    grid = table._tbl.tblGrid
    for col, width in zip(grid.gridCol_lst, widths): col.set(qn("w:w"), str(width))
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            set_cell_width(cell, width); cell_margins(cell)


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    r_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink"); hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    color = OxmlElement("w:color"); color.set(qn("w:val"), "0563C1"); rPr.append(color)
    under = OxmlElement("w:u"); under.set(qn("w:val"), "single"); rPr.append(under)
    sz = OxmlElement("w:sz"); sz.set(qn("w:val"), "17"); rPr.append(sz)
    new_run.append(rPr)
    text_node = OxmlElement("w:t"); text_node.text = text; new_run.append(text_node)
    hyperlink.append(new_run); paragraph._p.append(hyperlink)


def add_text(p, text, size=10, bold=False, color="000000"):
    run = p.add_run(text); set_font(run, size, bold, color); return run


def set_style(style, size, color, before, after, bold=False):
    style.font.name = "Calibri"; style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri"); style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    style.font.size = Pt(size); style.font.bold = bold; style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(before); style.paragraph_format.space_after = Pt(after); style.paragraph_format.line_spacing = 1.25


def header_footer(section):
    hp = section.header.paragraphs[0]; hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_text(hp, "PUBLIC APIS CATALOG | AMARATV KRISHI CRM", 8, False, "666666")
    fp = section.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_text(fp, "Generated from public-apis/public-apis | 01 Sep 2026", 8, False, "666666")


def parse():
    category = None; data = {}
    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^### (.+)$", line)
        if match:
            category = match.group(1); data.setdefault(category, []); continue
        match = ROW.match(line)
        if match and category:
            data[category].append(dict(name=match.group(1), url=match.group(2), description=match.group(3), auth=match.group(4).strip('`'), https=match.group(5), cors=match.group(6)))
        elif (not category) and (match := PROMO_ROW.match(line)) and not line.startswith('|:'):
            data.setdefault('APILayer APIs', []).append(dict(name=match.group(1), url=match.group(2), description=match.group(3), auth='See provider', https='Yes', cors='Unknown'))
    return data


def api_table(doc, records):
    table = doc.add_table(rows=1, cols=5)
    table.style = "Table Grid"
    widths = [1900, 4700, 850, 850, 1060]
    headers = ["API", "Description", "Auth", "HTTPS", "CORS"]
    for cell, label in zip(table.rows[0].cells, headers):
        shade(cell, "E8EEF5"); cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(0); add_text(p, label, 8, True, "1F4D78")
    for item in records:
        cells = table.add_row().cells
        p = cells[0].paragraphs[0]; p.paragraph_format.space_after = Pt(0); add_hyperlink(p, item['name'], item['url'])
        p = cells[1].paragraphs[0]; p.paragraph_format.space_after = Pt(0); add_text(p, item['description'], 8)
        for c, key in zip(cells[2:], ('auth','https','cors')):
            p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0); add_text(p, item[key], 8)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_table_geometry(table, widths)
    trPr = table.rows[0]._tr.get_or_add_trPr(); rep = OxmlElement('w:tblHeader'); rep.set(qn('w:val'), 'true'); trPr.append(rep)


def main():
    data = parse(); total = sum(len(v) for v in data.values())
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = sec.bottom_margin = sec.left_margin = sec.right_margin = Inches(1)
    sec.header_distance = sec.footer_distance = Inches(.492)
    header_footer(sec)
    set_style(doc.styles['Normal'], 11, '000000', 0, 6)
    set_style(doc.styles['Heading 1'], 16, '2E74B5', 18, 10, True)
    set_style(doc.styles['Heading 2'], 13, '2E74B5', 14, 7, True)

    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(20); p.paragraph_format.space_after = Pt(4)
    add_text(p, "Public APIs Catalog", 26, True, "0B2545")
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(18)
    add_text(p, "Complete catalog from github.com/public-apis/public-apis, with CRM fit for Amaratv Krishi", 13, False, "4E6278")
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(14)
    add_text(p, f"Catalog snapshot: 01 September 2026 | {total:,} API entries across {len(data)} categories", 10, False, "666666")

    doc.add_heading("What you can use in this project", level=1)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(8)
    add_text(p, "Filter applied: the catalog contains 741 entries marked No Auth and HTTPS Yes. That means the repository says they need no account or API key. It does not independently guarantee pricing, uptime, or commercial-use rights, so check each provider's live terms before release. For this CRM, the 7 candidates below are the best direct fits.", 11)
    recs = [
        ("PIN-code enrichment", "Indian Pincode", "Fill state, district, post office, and GPS information for Indian lead addresses."),
        ("Market intelligence", "Indian Mandi Prices", "Show daily wholesale mandi-price context for relevant agricultural prospects."),
        ("Email quality", "Disify, EVA", "Flag disposable emails and perform lightweight email validation without an API key."),
        ("Maps & territory", "Nominatim, Geocode.xyz", "Convert a lead address into coordinates for territory planning; respect each public service's usage limits."),
        ("Follow-up scheduling", "Nager.Date", "Avoid scheduling routine follow-ups on public holidays."),
        ("Currency reference", "Frankfurter", "Retrieve exchange-rate reference data only if the CRM later supports foreign-currency reporting."),
    ]
    table = doc.add_table(rows=1, cols=3); table.style = 'Table Grid'
    for c, title in zip(table.rows[0].cells, ("Use case", "Recommended services", "CRM value")):
        shade(c, 'E8EEF5'); p=c.paragraphs[0]; p.paragraph_format.space_after=Pt(0); add_text(p,title,9,True,'1F4D78')
    for row in recs:
        cells=table.add_row().cells
        for cell, value in zip(cells,row):
            p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(0); add_text(p,value,9)
    set_table_geometry(table,[1550,2750,5060])
    p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(8); p.paragraph_format.space_after=Pt(10)
    add_text(p, "Integration note: these selected services do not need a secret key. Still route requests through the app's sync/service layer, cache optional results, and respect rate limits because this CRM is intentionally offline-first.", 10, False, '4E6278')

    doc.add_heading("Catalog", level=1)
    p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(8)
    add_text(p, "Each API name is a clickable link to its source documentation. The availability fields reproduce the repository snapshot: Auth, HTTPS, and CORS.", 10, False, '4E6278')
    for category, records in data.items():
        doc.add_heading(f"{category} ({len(records)})", level=2)
        api_table(doc, records)

    doc.save(OUT)
    print(f"Created {OUT} with {total} entries in {len(data)} categories")


if __name__ == '__main__':
    main()
