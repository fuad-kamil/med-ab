import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import am from './locales/am.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  am: { translation: am },
  ar: { translation: ar },
};

function getNestedValue(obj, keyPath) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'am', 'ar'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'app_lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React escapes HTML by default
    },
    saveMissing: true,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Missing key "${key}" in languages: ${lngs.join(', ')}`);
      }
    },
    parseMissingKeyHandler: (key) => {
      // 1. Try English resource fallback
      const enValue = getNestedValue(resources.en?.translation, key);
      if (enValue) return enValue;

      // 2. Format key string into readable text
      const lastPart = key.split('.').pop() || key;
      const formatted = lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim();
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    },
  });

function syncDocumentAttributes(lng) {
  if (typeof document === 'undefined') return;
  const currentLang = lng || i18n.language || 'en';
  const isRtl = currentLang === 'ar';

  document.documentElement.lang = currentLang;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

  if (isRtl) {
    document.documentElement.classList.add('rtl-active');
  } else {
    document.documentElement.classList.remove('rtl-active');
  }
}

// Synchronize html lang & dir attributes
i18n.on('languageChanged', (lng) => {
  syncDocumentAttributes(lng);
});

// Set initial html attributes
syncDocumentAttributes(i18n.language);

export default i18n;
