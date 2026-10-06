import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  hasUnsavedChanges = false,
  unsavedWarningText,
}) {
  const { t } = useTranslation();
  const warningMsg = unsavedWarningText || t('common.unsavedWarning');
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const bodyRef = useRef(null);
  const previousFocusRef = useRef(null);

  const [isScrolledTop, setIsScrolledTop] = useState(true);
  const [isScrolledBottom, setIsScrolledBottom] = useState(true);

  // Handle Close Attempt (with unsaved changes check)
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm(warningMsg)) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, warningMsg, onClose]);

  // Lock Page Scroll & Save Focus on Mount/Open
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      // Lock body & document element scroll
      const originalBodyOverflow = document.body.style.overflow;
      const originalDocOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      // Focus modal card or first focusable input
      const timer = setTimeout(() => {
        if (cardRef.current) {
          const focusable = cardRef.current.querySelectorAll(
            'input:not([type="hidden"]), select, textarea, button:not([disabled]), [tabindex]:not([-tabindex="-1"])'
          );
          if (focusable.length > 0) {
            // Prefer autofocus input if present, else first focusable
            const autoFocusInput = Array.from(focusable).find((el) => el.hasAttribute('autofocus'));
            if (autoFocusInput) {
              autoFocusInput.focus();
            } else {
              focusable[0].focus();
            }
          } else {
            cardRef.current.focus();
          }
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalDocOverflow;

        // Restore focus on close
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Escape key listener & Focus Trap
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;

      if (e.key === 'Escape' && closeOnEsc) {
        e.preventDefault();
        handleCloseAttempt();
        return;
      }

      // Focus trap TAB navigation
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = Array.from(
          cardRef.current.querySelectorAll(
            'input:not([type="hidden"]), select, textarea, button:not([disabled]), [tabindex]:not([-tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, handleCloseAttempt]);

  // Handle Scroll state for Header / Footer border shadows
  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    setIsScrolledTop(scrollTop <= 2);
    setIsScrolledBottom(scrollTop + clientHeight >= scrollHeight - 2);
  }, []);

  useEffect(() => {
    if (isOpen && bodyRef.current) {
      handleScroll();
    }
  }, [isOpen, handleScroll, children]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-[440px]',
    md: 'max-w-[640px]',
    lg: 'max-w-[880px]',
    xl: 'max-w-[960px]',
    full: 'max-w-[calc(100vw-2rem)] h-[calc(100dvh-2rem)]',
  };

  const modalContent = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      className="fixed inset-0 z-[var(--z-overlay,60)] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm animate-backdrop-in"
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === overlayRef.current) {
          handleCloseAttempt();
        }
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`
          w-full flex flex-col
          glass-card animate-modal-pop
          bg-surface-50 dark:bg-surface-900
          border border-surface-200 dark:border-surface-700
          shadow-2xl rounded-t-2xl sm:rounded-2xl
          relative z-[var(--z-modal,70)] overflow-hidden my-auto
          ${sizeClasses[size] || sizeClasses.md}
          h-[100dvh] sm:h-auto
          max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)]
        `}
      >
        {/* Modal Fixed Header */}
        {title && (
          <div
            className={`
              flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4
              border-b border-surface-200 dark:border-surface-800 shrink-0
              bg-surface-100/90 dark:bg-surface-800/80 backdrop-blur-md
              transition-shadow duration-200 min-h-[56px]
              ${!isScrolledTop ? 'shadow-md border-surface-300 dark:border-surface-700' : ''}
            `}
          >
            <div className="flex-1 min-w-0 pr-2">
              <h2
                id="modal-title"
                className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100 break-words flex items-center gap-2"
              >
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={handleCloseAttempt}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition-colors cursor-pointer shrink-0 ml-2"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body - THE ONLY SCROLLING CONTAINER */}
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4"
        >
          {children}
        </div>

        {/* Modal Fixed Footer */}
        {footer && (
          <div
            className={`
              px-5 sm:px-6 py-3.5
              border-t border-surface-200 dark:border-surface-800 shrink-0
              bg-surface-100/90 dark:bg-surface-800/80 backdrop-blur-md
              pb-[max(0.875rem,env(safe-area-inset-bottom))]
              transition-shadow duration-200
              ${!isScrolledBottom ? 'shadow-[0_-4px_12px_rgba(0,0,0,0.15)] border-surface-300 dark:border-surface-700' : ''}
            `}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  loading = false,
}) {
  const { t } = useTranslation();
  const finalTitle = title || t('common.confirmAction');
  const finalConfirmText = confirmText || t('common.confirm');
  const finalCancelText = cancelText || t('common.cancel');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={finalTitle}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {finalCancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={loading}
            className={`px-4 py-2 text-xs font-medium rounded-xl text-white transition-colors cursor-pointer flex items-center gap-2 ${
              variant === 'danger'
                ? 'bg-danger-600 hover:bg-danger-700'
                : 'bg-primary-600 hover:bg-primary-700'
            } disabled:opacity-50`}
          >
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {finalConfirmText}
          </button>
        </div>
      }
    >
      <p className="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}

export default Modal;
