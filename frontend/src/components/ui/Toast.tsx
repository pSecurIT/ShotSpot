import React, { useEffect } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  title?: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  title,
  variant = 'success',
  onDismiss,
  duration = 4000,
}) => {
  useEffect(() => {
    if (duration <= 0) return undefined;

    const timer = window.setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, onDismiss]);

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      <div className={`toast toast--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
        <div className="toast__content">
          {title && <strong className="toast__title">{title}</strong>}
          <p className="toast__message">{message}</p>
        </div>
        <button type="button" className="toast__dismiss" onClick={onDismiss} aria-label="Dismiss notification">
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;