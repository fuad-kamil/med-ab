import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Globe, Check } from 'lucide-react';
import { LANGUAGES, getLanguage } from '../constants/languages';

export default function PreferencesControls({ className = '' }) {
  const { i18n, t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentLang = (i18n.language || 'en').slice(0, 2);
  const activeConfig = getLanguage(currentLang);

  const handleSelectLanguage = (code) => {
    const target = getLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem('app_lang', code);
    localStorage.setItem('i18nextLng', code);
    document.documentElement.lang = code;
    document.documentElement.dir = target.dir;
    if (target.dir === 'rtl') {
      document.documentElement.classList.add('rtl-active');
    } else {
      document.documentElement.classList.remove('rtl-active');
    }
    setIsOpen(false);
  };

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Viewport-smart dropdown positioning (never overflows screen edge in LTR or RTL)
  const getDropdownStyle = () => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 192; // 12rem / w-48
    const isRtl = document.documentElement.dir === 'rtl';

    let leftPos = isRtl ? rect.right - dropdownWidth : rect.left;

    if (rect.right > window.innerWidth / 2 || window.innerWidth - rect.right < dropdownWidth) {
      leftPos = rect.right - dropdownWidth;
    }

    const maxLeft = Math.max(8, window.innerWidth - dropdownWidth - 8);
    leftPos = Math.max(8, Math.min(leftPos, maxLeft));

    return {
      top: `${rect.bottom + 8}px`,
      left: `${leftPos}px`,
      right: 'auto',
      width: `${dropdownWidth}px`,
    };
  };

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 p-1 rounded-2xl bg-surface-100/80 dark:bg-surface-900/80 border border-surface-200/80 dark:border-surface-800 backdrop-blur-md shadow-xs select-none ${className}`}
    >
      {/* 3-Language Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t('common.language')}
        aria-label="Select Language"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-surface-700 dark:text-surface-300 hover:bg-surface-200/70 dark:hover:bg-surface-800 transition-colors cursor-pointer min-h-[38px] focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none"
      >
        <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
        <span lang={activeConfig.code}>{activeConfig.nativeName}</span>
      </button>

      {/* Portaled Viewport-Smart Dropdown Menu */}
      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
            <div
              ref={dropdownRef}
              style={getDropdownStyle()}
              className="fixed z-[100] w-48 p-1.5 rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl space-y-1 animate-scale-in text-surface-100"
            >
              {LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    lang={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors min-h-[44px] cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold'
                        : 'text-surface-300 hover:bg-surface-800 hover:text-surface-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span lang={lang.code}>{lang.nativeName}</span>
                      {lang.isRtl && (
                        <span className="px-1 py-0.5 rounded text-xs font-semibold bg-surface-800 text-surface-400 border border-surface-700">
                          RTL
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}

      <div className="w-px h-4 bg-surface-200 dark:bg-surface-800" />

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="p-2 rounded-xl text-surface-700 dark:text-surface-300 hover:bg-surface-200/70 dark:hover:bg-surface-800 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none"
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-teal-600" />
        )}
      </button>
    </div>
  );
}
