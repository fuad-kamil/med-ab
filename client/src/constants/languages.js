export const LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', nativeLabel: 'English', short: 'EN', dir: 'ltr' },
  { code: 'am', label: 'Amharic', nativeName: 'አማርኛ', nativeLabel: 'አማርኛ', short: 'አማ', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية', nativeLabel: 'العربية', short: 'ع', dir: 'rtl', isRtl: true },
];

export function getLanguage(code) {
  const norm = (code || 'en').slice(0, 2);
  return LANGUAGES.find((l) => l.code === norm) || LANGUAGES[0];
}

export const getLanguageConfig = getLanguage;
