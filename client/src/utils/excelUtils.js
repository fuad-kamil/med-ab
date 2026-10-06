/**
 * Utility to generate and download formatted MS Excel (.xlsx / .xls) spreadsheet files
 * with rich header banners, metadata, styled column headers, and gridlines.
 */

export function downloadExcelFile({
  filename = 'export.xlsx',
  title = 'Report',
  subtitle = '',
  metadata = [],
  headers = [],
  rows = [],
}) {
  const dateStr = new Date().toLocaleString();

  const metadataHtml = [
    `<tr><td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 11px; color: #475569; padding: 4px 0;">Generated: ${dateStr}</td></tr>`,
    ...metadata.map(
      (m) =>
        `<tr><td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 11px; color: #475569; padding: 2px 0;"><strong>${m.label}:</strong> ${m.value}</td></tr>`
    ),
  ].join('');

  const tableHeadersHtml = headers
    .map(
      (h) =>
        `<th style="background-color: #0f766e; color: #ffffff; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; padding: 10px 14px; border: 1px solid #0d9488; text-align: left;">${h}</th>`
    )
    .join('');

  const tableRowsHtml = rows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = row
        .map(
          (cell) =>
            `<td style="font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 8px 12px; border: 1px solid #cbd5e1; vertical-align: middle;">${
              cell !== null && cell !== undefined ? String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
            }</td>`
        )
        .join('');
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join('');

  const content = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${title.replace(/[\\/?*:[\]]/g, '')}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #0f172a; background-color: #f1f5f9; padding: 14px; border: 1px solid #cbd5e1;">
            Medresa Exam Portal — ${title}
            ${subtitle ? `<br/><span style="font-size: 12px; font-weight: normal; color: #64748b;">${subtitle}</span>` : ''}
          </td>
        </tr>
        ${metadataHtml}
        <tr><td colspan="${headers.length}" style="height: 12px;"></td></tr>
        <thead>
          <tr>${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ensureExt = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.download = ensureExt;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
