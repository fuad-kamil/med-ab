import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, id, className = '', ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          w-full px-4 py-2.5 rounded-xl text-sm
          bg-surface-100 dark:bg-surface-800/60 border text-surface-900 dark:text-surface-100
          placeholder:text-surface-400 dark:placeholder:text-surface-500
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          ${error ? 'border-danger-500' : 'border-surface-300 dark:border-surface-700'}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-danger-500 mt-0.5">{error}</p>
      )}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, id, children, className = '', ...props },
  ref
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`
          w-full px-4 py-2.5 rounded-xl text-sm
          bg-surface-100 dark:bg-surface-800/60 border text-surface-900 dark:text-surface-100
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          ${error ? 'border-danger-500' : 'border-surface-300 dark:border-surface-700'}
        `}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="text-xs text-danger-500 mt-0.5">{error}</p>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, id, className = '', ...props },
  ref
) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={`
          w-full px-4 py-2.5 rounded-xl text-sm
          bg-surface-100 dark:bg-surface-800/60 border text-surface-900 dark:text-surface-100
          placeholder:text-surface-400 dark:placeholder:text-surface-500
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          resize-y min-h-[80px]
          ${error ? 'border-danger-500' : 'border-surface-300 dark:border-surface-700'}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-danger-500 mt-0.5">{error}</p>
      )}
    </div>
  );
});

export default Input;
