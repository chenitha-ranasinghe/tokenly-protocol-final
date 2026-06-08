'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from './Toast.module.css';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) {
  if (addToastFn) addToastFn({ message, type, duration });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={styles.toast}
          style={{
            borderColor: toast.type === 'success' ? 'rgba(0,214,143,0.3)' : toast.type === 'error' ? 'rgba(255,92,92,0.3)' : 'rgba(56,189,248,0.3)',
            background: toast.type === 'success' ? 'rgba(0,214,143,0.1)' : toast.type === 'error' ? 'rgba(255,92,92,0.1)' : 'rgba(56,189,248,0.1)',
            color: toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--info)',
          }}
        >
          <span className={styles.icon} aria-hidden="true">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
