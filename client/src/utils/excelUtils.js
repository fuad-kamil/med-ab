import JSZip from 'jszip';

/**
 * Utility to generate and download true binary OpenXML MS Excel (.xlsx) spreadsheet files
 * compatible with Microsoft 365 (Desktop & Mobile), Google Sheets, and Apple Numbers.
 */

function getColLetter(colIdx) {
  let temp = colIdx;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function downloadExcelFile(arg1, arg2) {
  let filename = 'export.xlsx';
  let title = '';
  let metadata = [];
  let headers = [];
  let rows = [];

  if (typeof arg1 === 'string') {
    filename = arg1;
    if (Array.isArray(arg2) && arg2.length > 0) {
      headers = Object.keys(arg2[0]);
      rows = arg2.map((item) => headers.map((h) => item[h]));
    }
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    filename = arg1.filename || filename;
    title = arg1.title || title;
    metadata = arg1.metadata || [];
    headers = arg1.headers || [];
    rows = arg1.rows || [];

    if (Array.isArray(arg1.data) && arg1.data.length > 0) {
      if (!headers.length) headers = Object.keys(arg1.data[0]);
      if (!rows.length) rows = arg1.data.map((item) => headers.map((h) => item[h]));
    }
  }

  // Enforce .xlsx extension
  if (!filename.toLowerCase().endsWith('.xlsx')) {
    filename = filename.replace(/\.(csv|xls)$/i, '') + '.xlsx';
  }

  const zip = new JSZip();
  const stringTable = [];
  const stringMap = new Map();

  function getSharedStringIndex(val) {
    const s = String(val ?? '');
    if (stringMap.has(s)) {
      return stringMap.get(s);
    }
    const idx = stringTable.length;
    stringTable.push(s);
    stringMap.set(s, idx);
    return idx;
  }

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Arial"/><color rgb="FF1E293B"/></font>
    <font><b/><sz val="14"/><name val="Arial"/><color rgb="FF0F172A"/></font>
    <font><sz val="10"/><name val="Arial"/><color rgb="FF475569"/></font>
    <font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const sheetRows = [];
  let rowIndex = 1;

  if (title) {
    const titleStrIdx = getSharedStringIndex(`Medresa Exam Portal — ${title}`);
    sheetRows.push(`<row r="${rowIndex}"><c r="A${rowIndex}" t="s" s="1"><v>${titleStrIdx}</v></c></row>`);
    rowIndex++;
  }

  if (metadata.length > 0) {
    for (const m of metadata) {
      const metaText = `${m.label}: ${m.value}`;
      const metaStrIdx = getSharedStringIndex(metaText);
      sheetRows.push(`<row r="${rowIndex}"><c r="A${rowIndex}" t="s" s="2"><v>${metaStrIdx}</v></c></row>`);
      rowIndex++;
    }
  }

  if (title || metadata.length > 0) {
    rowIndex++;
  }

  if (headers.length > 0) {
    const headerCells = headers
      .map((h, cIdx) => {
        const colLetter = getColLetter(cIdx);
        const strIdx = getSharedStringIndex(h);
        return `<c r="${colLetter}${rowIndex}" t="s" s="3"><v>${strIdx}</v></c>`;
      })
      .join('');
    sheetRows.push(`<row r="${rowIndex}">${headerCells}</row>`);
    rowIndex++;
  }

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowData = rows[rIdx];
    const styleId = rIdx % 2 === 1 ? 4 : 0;
    const cells = rowData
      .map((val, cIdx) => {
        const colLetter = getColLetter(cIdx);
        const cellRef = `${colLetter}${rowIndex}`;
        if (typeof val === 'number') {
          return `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
        }
        const strIdx = getSharedStringIndex(val ?? '');
        return `<c r="${cellRef}" t="s" s="${styleId}"><v>${strIdx}</v></c>`;
      })
      .join('');
    sheetRows.push(`<row r="${rowIndex}">${cells}</row>`);
    rowIndex++;
  }

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${stringTable.length}" uniqueCount="${stringTable.length}">
  ${stringTable.map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('')}
</sst>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join('\n    ')}
  </sheetData>
</worksheet>`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`);

  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);

  zip.file('xl/styles.xml', stylesXml);
  zip.file('xl/sharedStrings.xml', sharedStringsXml);
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  const content = await zip.generateAsync({ type: 'blob' });
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
