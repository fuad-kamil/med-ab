// Document, Excel, and Email Typography Constants Map
export const docFonts = {
  latin: {
    font: 'Calibri',
    bodySize: 22, // 11pt in half-points
    headingSize: 32, // 16pt
    headingLargeSize: 36, // 18pt
  },
  arabic: {
    font: 'Traditional Arabic',
    csFont: 'Traditional Arabic',
    bodySize: 32, // 16pt
    bodyCsSize: 32,
    headingSize: 40, // 20pt
    headingCsSize: 40,
    rtl: true,
  },
  amharic: {
    font: 'Nyala',
    bodySize: 24, // 12pt
    headingSize: 32, // 16pt
  },
  excel: {
    font: 'Calibri',
    size: 11,
  },
  email: {
    en: 'font-family: "Segoe UI", Arial, sans-serif;',
    ar: 'font-family: Tahoma, Arial, sans-serif; direction: rtl;',
    am: 'font-family: Nyala, "Noto Sans Ethiopic", Arial, sans-serif;',
  },
};

export function detectScript(text = '') {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const amharicRegex = /[\u1200-\u137C\u1380-\u1399\u2D80-\u2DDE\uAB01-\uAB2E]/;

  if (arabicRegex.test(text)) return 'ar';
  if (amharicRegex.test(text)) return 'am';
  return 'en';
}

export function getDocFont(text = '') {
  const script = detectScript(text);
  if (script === 'ar') return docFonts.arabic;
  if (script === 'am') return docFonts.amharic;
  return docFonts.latin;
}
