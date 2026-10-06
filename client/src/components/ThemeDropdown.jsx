import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeDropdown() {
  const { t } = useTranslation();
  const { preference, resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

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

  const options = [
    { key: 'light', label: t('nav.lightMode') || 'Light', icon: Sun },
    { key: 'dark', label: t('nav.darkMode') || 'Dark', icon: Moon },
    { key: 'system', label: t('nav.systemTheme') || 'System', icon: Monitor },
  ];

  const getDropdownStyle = () => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 176; // w-44
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

  const currentLabel =
    preference === 'system'
      ? `${t('nav.systemTheme') || 'System'} (${resolved})`
      : preference === 'dark'
      ? t('nav.darkMode') || 'Dark'
      : t('nav.lightMode') || 'Light';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Theme mode selection, current setting ${currentLabel}`}
        title={`Theme: ${currentLabel}`}
        className="h-10 w-10 flex items-center justify-center rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-200 dark:border-surface-800 text-surface-400 hover:text-surface-100 transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
      >
        {resolved === 'dark' ? (
          <Moon className="w-[18px] h-[18px] text-surface-300" strokeWidth={1.75} />
        ) : (
          <Sun className="w-[18px] h-[18px] text-surface-600 dark:text-surface-300" strokeWidth={1.75} />
        )}
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              style={getDropdownStyle()}
              className="fixed z-[100] w-44 rounded-xl bg-surface-900 border border-surface-800 shadow-xl p-1.5 space-y-1 animate-scale-in text-surface-100"
            >
              {options.map((opt) => {
                const isActive = preference === opt.key;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setTheme(opt.key);
                      setOpen(false);
                    }}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-primary-600/15 text-primary-400 font-semibold'
                        : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className="w-4 h-4 text-surface-400 shrink-0" strokeWidth={1.75} />
                      <span>{opt.label}</span>
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
