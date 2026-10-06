import { forwardRef } from 'react';

const variants = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-900/30 active:scale-[0.97]',
  secondary:
    'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-600 active:scale-[0.97]',
  danger:
    'bg-danger-600 hover:bg-danger-700 text-white active:scale-[0.97]',
  ghost:
    'bg-transparent hover:bg-surface-800 text-surface-300 hover:text-surface-100',
  success:
    'bg-success-600 hover:bg-success-500 text-white active:scale-[0.97]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-xl
        transition-all duration-150 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        cursor-pointer
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

export default Button;
