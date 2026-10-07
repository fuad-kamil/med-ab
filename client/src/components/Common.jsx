import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical, AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

export function StatusChip({
  icon: Icon = null,
  label,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) {
  const variants = {
    neutral: 'bg-surface-800/60 text-surface-300 border border-surface-700/50',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    primary: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  };

  const sizes = {
    sm: 'h-9 max-sm:h-11 px-3 text-xs',
    md: 'h-10 max-sm:h-11 px-3.5 text-xs sm:text-sm',
    lg: 'h-12 px-4 text-sm font-medium',
  };

  return (
    <div
      role="status"
      aria-label={label}
      className={`
        inline-flex items-center justify-center gap-1.5
        font-semibold rounded-[10px] whitespace-nowrap select-none
        pointer-events-none transition-none shadow-none cursor-default
        ${variants[variant] || variants.neutral}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />}
      <span className="truncate">{label}</span>
    </div>
  );
}

export function ActionRow({ children, className = '', ...props }) {
  return (
    <div
      data-action-row="true"
      className={`
        w-full grid grid-flow-col auto-cols-fr gap-2 items-center justify-stretch
        sm:flex sm:items-center sm:justify-end sm:w-auto sm:gap-2
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function MenuButton({ items = [], label = 'More options', className = '' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56
      const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth));
      const top = rect.bottom + 6;
      setCoords({ top, left });
    }
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    function handleScrollOrResize() {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 224;
        const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth));
        const top = rect.bottom + 6;
        setCoords({ top, left });
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`
          h-10 w-10 max-sm:h-11 max-sm:w-11 rounded-[10px]
          bg-surface-800/80 hover:bg-surface-700/80 text-surface-200 border border-surface-700
          flex items-center justify-center transition-colors cursor-pointer touch-manipulation shrink-0
          ${className}
        `}
      >
        <MoreVertical className="w-4.5 h-4.5 stroke-[1.75]" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            className="
              fixed w-56 rounded-2xl
              bg-surface-900 border border-surface-700/80 shadow-2xl py-1.5 z-[9999] animate-pop-in
              divide-y divide-surface-800 text-surface-200
            "
          >
            <div className="py-1">
              {items
                .filter((item) => !item.danger)
                .map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      if (item.onClick) item.onClick();
                    }}
                    className={`
                      w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold
                      text-surface-200 hover:bg-surface-800/80
                      flex items-center gap-2.5 cursor-pointer transition-colors text-left
                      disabled:opacity-40 disabled:cursor-not-allowed
                    `}
                  >
                    {item.icon && <item.icon className="w-4 h-4 text-surface-400 stroke-[1.75] shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
            </div>

            {items.some((item) => item.danger) && (
              <div className="py-1">
                {items
                  .filter((item) => item.danger)
                  .map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={item.disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        if (item.onClick) item.onClick();
                      }}
                      className={`
                        w-full min-h-[44px] px-3.5 py-2 text-xs font-semibold
                        text-rose-400 hover:bg-rose-500/10
                        flex items-center gap-2.5 cursor-pointer transition-colors text-left
                        disabled:opacity-40 disabled:cursor-not-allowed
                      `}
                    >
                      {item.icon && <item.icon className="w-4 h-4 text-rose-400 stroke-[1.75] shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4 select-none">{icon}</span>
      <h3 className="text-lg font-bold text-surface-200 mb-1">{title}</h3>
      {message && <p className="text-sm text-surface-400 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', code, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-400 stroke-[1.75]" />
      </div>
      <h3 className="text-lg font-bold text-rose-400 mb-1">{t('common.error') || 'Error'}</h3>
      <p className="text-sm text-surface-400 max-w-sm mb-4">
        {message}
        {code ? ` (${code})` : ''}
      </p>
      {onRetry && (
        <Button variant="secondary" size="md" iconStart={RefreshCw} onClick={onRetry}>
          {t('common.tryAgain') || 'Try Again'}
        </Button>
      )}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-600/15 to-primary-900/5 border-primary-500/20 text-primary-400',
    success: 'from-emerald-600/15 to-emerald-900/5 border-emerald-500/20 text-emerald-400',
    warning: 'from-amber-600/15 to-amber-900/5 border-amber-500/20 text-amber-400',
    danger: 'from-rose-600/15 to-rose-900/5 border-rose-500/20 text-rose-400',
  };

  return (
    <div
      className={`
        bg-gradient-to-br ${colors[color] || colors.primary}
        border rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full min-h-[100px]
      `}
    >
      <div className="flex items-center gap-2.5 mb-2">
        {Icon && typeof Icon === 'function' ? (
          <Icon className="w-5 h-5 shrink-0 stroke-[1.75]" />
        ) : typeof Icon === 'string' ? (
          <span className="text-xl select-none">{Icon}</span>
        ) : null}
        <span className="text-xs sm:text-sm text-surface-400 font-medium line-clamp-2 leading-tight">
          {label}
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-surface-100 tabular-nums">{value}</p>
    </div>
  );
}

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-surface-800 text-surface-300 border border-surface-700',
    success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    primary: 'bg-primary-500/15 text-primary-300 border border-primary-500/30',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center px-2.5 py-1 rounded-full
        text-xs font-bold whitespace-nowrap shrink-0 select-none leading-none h-6
        ${variants[variant] || variants.default}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
