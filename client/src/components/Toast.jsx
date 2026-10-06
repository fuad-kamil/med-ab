import { useState, useEffect } from 'react';

export function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade out
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: 'bg-success-600/90 border-success-500',
    error: 'bg-danger-600/90 border-danger-500',
    warning: 'bg-warning-600/90 border-warning-500',
    info: 'bg-primary-600/90 border-primary-500',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-[100]
        flex items-center gap-3
        px-4 py-3 rounded-xl
        border backdrop-blur-sm
        text-white text-sm font-medium
        shadow-2xl
        transition-all duration-300
        ${colors[type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      <span className="text-lg">{icons[type]}</span>
      <span>{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

// Toast container hook
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast, i) => (
        <div key={toast.id} style={{ top: `${1 + i * 4.5}rem` }} className="fixed right-4 z-[100]">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );

  return { addToast, ToastContainer };
}

export default Toast;
