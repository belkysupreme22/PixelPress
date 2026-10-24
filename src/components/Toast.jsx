"use client";

import { Check, AlertCircle, Info, Download, Trash2, X } from 'lucide-react';
import styles from './Toast.module.css';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-live="polite">
      {toasts.map(toast => {
        let IconComponent = Info;
        let iconColor = "var(--text-muted)";

        if (toast.type === 'success') {
          IconComponent = Check;
          iconColor = "var(--accent)";
        } else if (toast.type === 'download') {
          IconComponent = Download;
          iconColor = "var(--accent)";
        } else if (toast.type === 'error') {
          IconComponent = AlertCircle;
          iconColor = "#ef4444";
        } else if (toast.type === 'clear') {
          IconComponent = Trash2;
          iconColor = "var(--text-muted)";
        }

        const variantClass = toast.type === 'success' || toast.type === 'download'
          ? styles.toastSuccess 
          : toast.type === 'error'
          ? styles.toastError
          : styles.toastInfo;

        return (
          <div key={toast.id} className={`${styles.toastItem} ${variantClass}`}>
            <div className={styles.toastContent}>
              <div className={styles.toastIconWrap}>
                <IconComponent size={14} color={iconColor} />
              </div>
              <div className={styles.toastText}>
                {toast.title && <div className={styles.toastTitle}>{toast.title}</div>}
                <div className={styles.toastMessage}>{toast.message}</div>
              </div>
            </div>
            <button 
              className={styles.toastCloseBtn}
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
