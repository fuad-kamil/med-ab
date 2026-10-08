/**
 * Utility to generate and download formatted UTF-8 CSV spreadsheet files (.csv)
 * compatible with MS Excel, Microsoft 365 Mobile, Google Sheets, and Apple Numbers.
 */

export function downloadExcelFile({
  filename = 'export.csv',
  title = 'Report',
  subtitle = '',
  metadata = [],
  headers = [],
  rows = [],
}) {
  const dateStr = new Date().toLocaleString();

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const csvLines = [
    `# ${title}${subtitle ? ' - ' + subtitle : ''}`,
    `# Exported: ${dateStr}`,
    ...metadata.map((m) => `# ${m.label}: ${m.value}`),
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ];

  const csvContent = '\ufeff' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const finalFilename = filename.endsWith('.csv') ? filename : filename.replace(/\.(xlsx|xls)$/i, '') + '.csv';
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
