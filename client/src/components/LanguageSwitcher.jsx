import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { LANGUAGES, getLanguage } from '../constants/languages';

export default function LanguageSwitcher({ variant = 'dropdown', onSelect }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const currentLangCode = (i18n.language || 'en').slice(0, 2);
  const currentLangObj = getLanguage(currentLangCode);

  const handleLanguageChange = (code) => {
    const target = getLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem('app_lang', code);
    document.documentElement.lang = code;
    document.documentElement.dir = target.dir;
    if (target.dir === 'rtl') {
      document.documentElement.classList.add('rtl-active');
    } else {
      document.documentElement.classList.remove('rtl-active');
    }
    setOpen(false);
    if (onSelect) onSelect(code);
  };

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Variant for mobile avatar menu list (<640px)
  if (variant === 'menu-list') {
    return (
      <div role="radiogroup" aria-label="Language selection" className="space-y-1 w-full">
        {LANGUAGES.map((lang) => {
          const isActive = currentLangCode === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center justify-between min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-primary-500/15 text-primary-400 font-semibold border border-primary-500/30'
                  : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800/70 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span lang={lang.code} className="text-sm">
                  {lang.nativeName}
                </span>
                {lang.isRtl && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-surface-800 text-surface-400 border border-surface-700">
                    RTL
                  </span>
                )}
              </div>
              {isActive && <Check className="w-4 h-4 text-primary-400 shrink-0" strokeWidth={2} />}
            </button>
          );
        })}
      </div>
    );
  }

  // Position calculation for dropdown menu
  const getDropdownStyle = () => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 192; // w-48
    const isRtl = document.documentElement.dir === 'rtl';

    let leftPos = isRtl ? rect.right - dropdownWidth : rect.left;

    if (rect.right > window.innerWidth / 2 || window.innerWidth - rect.right < dropdownWidth) {
      leftPos = rect.right - dropdownWidth;
    }

    const maxLeft = Math.max(8, window.innerWidth - dropdownWidth - 8);
    leftPos = Math.max(8, Math.min(leftPos, maxLeft));

    return {
      top: `${rect.bottom + 6}px`,
      left: `${leftPos}px`,
      right: 'auto',
      width: `${dropdownWidth}px`,
    };
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Language switcher, current language ${currentLangObj.nativeName}`}
        className="h-10 px-3 flex items-center gap-2 rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-200 dark:border-surface-800 text-surface-300 hover:text-surface-100 text-xs font-medium transition-all cursor-pointer shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
      >
        <Globe className="w-[18px] h-[18px] text-surface-400 shrink-0" strokeWidth={1.75} />
        {/* Native name at >=1024px */}
        <span className="hidden lg:inline font-semibold" lang={currentLangObj.code}>
          {currentLangObj.nativeName}
        </span>
        {/* Short code on 640-1023px */}
        <span className="inline lg:hidden font-semibold" lang={currentLangObj.code}>
          {currentLangObj.short}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-150 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              style={getDropdownStyle()}
              className="fixed z-[100] w-48 rounded-xl bg-surface-900 border border-surface-800 shadow-xl p-1.5 space-y-1 animate-scale-in text-surface-100"
            >
              {LANGUAGES.map((lang) => {
                const isActive = currentLangCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-primary-600/15 text-primary-400 font-semibold'
                        : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span lang={lang.code} className="text-sm font-medium">
                        {lang.nativeName}
                      </span>
                      {lang.isRtl && (
                        <span className="px-1 py-0.5 rounded text-xs font-semibold bg-surface-800 text-surface-400 border border-surface-700">
                          RTL
                        </span>
                      )}
                    </div>
                    {isActive && <Check className="w-4 h-4 text-primary-400 shrink-0" strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
