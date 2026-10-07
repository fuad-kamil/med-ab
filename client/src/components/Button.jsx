import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white shadow-sm border border-primary-500/30 active:scale-[0.98]',
  secondary:
    'bg-surface-800/80 hover:bg-surface-700/80 text-surface-100 dark:text-surface-200 border border-surface-700/80 dark:border-surface-700 active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-surface-800/60 text-surface-300 hover:text-surface-100 active:scale-[0.98]',
  'danger-outline':
    'bg-transparent text-rose-500 dark:text-rose-400 border border-rose-500/40 hover:bg-rose-500/10 active:scale-[0.98]',
  'danger-solid':
    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-[0.98]',
};

// Size classes enforce min-h-11 (44px) on mobile/touch viewports (<640px)
const sizeClasses = {
  sm: 'h-9 max-sm:h-11 px-3 text-xs sm:text-xs min-w-[72px]',
  md: 'h-10 max-sm:h-11 px-4 text-xs sm:text-sm min-w-[84px]',
  lg: 'h-12 px-5 text-sm sm:text-base min-w-[96px]',
};

const iconOnlySizeClasses = {
  sm: 'h-9 w-9 max-sm:h-11 max-sm:w-11 min-w-[36px] max-sm:min-w-[44px]',
  md: 'h-10 w-10 max-sm:h-11 max-sm:w-11 min-w-[40px] max-sm:min-w-[44px]',
  lg: 'h-12 w-12 min-w-[48px]',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'secondary',
    size = 'md',
    disabled = false,
    disabledReason = '',
    loading = false,
    fullWidth = false,
    iconStart: IconStart = null,
    iconEnd: IconEnd = null,
    className = '',
    type = 'button',
    title,
    ...props
  },
  ref
) {
  // Label warning check in dev mode if label > 18 chars
  if (import.meta.env.DEV && typeof children === 'string' && children.trim().length > 18) {
    console.warn(`[Button UX Warning] Button label "${children}" exceeds recommended 18 characters.`);
  }

  const isIconOnly = !children && (IconStart || IconEnd || loading);
  const sizeStyle = isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      title={disabled && disabledReason ? disabledReason : title}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold rounded-[10px] whitespace-nowrap
        select-none touch-manipulation
        transition-all duration-150 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:transform-none
        cursor-pointer
        ${variants[variant] || variants.secondary}
        ${sizeStyle}
        ${fullWidth ? 'w-full flex-1' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" strokeWidth={2} />
      ) : IconStart ? (
        <IconStart className="w-4 h-4 shrink-0 stroke-[1.75]" />
      ) : null}

      {children && <span className="truncate">{children}</span>}

      {!loading && IconEnd && <IconEnd className="w-4 h-4 shrink-0 stroke-[1.75]" />}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', className = '', ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      iconStart={Icon}
      aria-label={label}
      title={label}
      className={className}
      {...props}
    />
  );
});

export default Button;
