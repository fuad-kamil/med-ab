import i18n from '../i18n';

export function getDisplayPreferences() {
  return {
    calendar: localStorage.getItem('pref_calendar') || 'gregorian',
    numerals: localStorage.getItem('pref_numerals') || 'western',
    timeFormat: localStorage.getItem('pref_time_format') || '12h',
  };
}

export function setDisplayPreferences(prefs) {
  if (prefs.calendar) localStorage.setItem('pref_calendar', prefs.calendar);
  if (prefs.numerals) localStorage.setItem('pref_numerals', prefs.numerals);
  if (prefs.timeFormat) localStorage.setItem('pref_time_format', prefs.timeFormat);
}

/**
 * Gets locale string with Unicode extension tags for date/calendar & numeral preferences.
 */
function getLocaleTag(langCode = i18n.language) {
  const prefs = getDisplayPreferences();
  const calTag = prefs.calendar === 'hijri' ? 'islamic-umalqura' : 'gregory';
  const numTag = prefs.numerals === 'indic' ? 'arab' : 'latn';

  if (langCode === 'ar') {
    return `ar-SA-u-ca-${calTag}-nu-${numTag}`;
  }
  if (langCode === 'am') {
    return `am-ET-u-ca-${calTag}-nu-${numTag}`;
  }
  return `en-US-u-ca-${calTag}-nu-${numTag}`;
}

/**
 * Format a Date object or ISO string.
 */
export function formatDate(dateValue, options = {}) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';

  const localeTag = getLocaleTag();
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(localeTag, defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Format Date with Time (e.g. Oct 5, 2026, 7:20 PM)
 */
export function formatDateTime(dateValue) {
  const prefs = getDisplayPreferences();
  const hour12 = prefs.timeFormat !== '24h';

  return formatDate(dateValue, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  });
}

/**
 * Format timer seconds to mm:ss (rendered LTR for bidi safety)
 */
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format number with localized digits.
 */
export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const localeTag = getLocaleTag();
  try {
    return new Intl.NumberFormat(localeTag, options).format(Number(value));
  } catch {
    return String(value);
  }
}

/**
 * Format percentage (e.g. 85%)
 */
export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const num = formatNumber(Math.round(Number(value)));
  return `${num}%`;
}

/**
 * Format duration in minutes (e.g. 30 mins)
 */
export function formatDuration(minutes) {
  if (!minutes) return '0m';
  const num = formatNumber(minutes);
  return `${num}m`;
}

/**
 * Format option label by language (A, B, C, D for en/am; أ، ب، ج، د for ar)
 */
export function formatOptionLabel(index, langCode = i18n.language) {
  if (langCode === 'ar') {
    const arabicLabels = ['أ', 'ب', 'ج', 'د', 'هـ', 'ወ', 'ز', 'ح'];
    return arabicLabels[index] || String.fromCharCode(65 + index);
  }
  return String.fromCharCode(65 + index);
}

export function formatDurationMinutes(minutes) {
  if (!minutes && minutes !== 0) return '';
  return i18n.t('common.minutes_other', { count: minutes, defaultValue: `${minutes} mins` });
}

export function formatRelativeTime(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return i18n.t('common.justNow', { defaultValue: 'just now' });
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatDate(date);
}
