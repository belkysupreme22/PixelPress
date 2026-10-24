"use client";

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import styles from './Tooltip.module.css';

export default function Tooltip({ children, content, label, position = "top", showIcon = false }) {
  const [visible, setVisible] = useState(false);

  if (showIcon) {
    return (
      <span className={styles.tooltipWrapper}>
        {children}
        <span 
          className={styles.helpTrigger}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
          onFocus={() => setVisible(true)}
          onBlur={() => setVisible(false)}
          tabIndex={0}
          aria-label={label || "More info"}
        >
          <HelpCircle size={12} />
        </span>
        {visible && content && (
          <div className={`${styles.tooltipBubble} ${styles[position]}`} role="tooltip">
            {label && <div className={styles.tooltipLabel}>{label}</div>}
            <div className={styles.tooltipText}>{content}</div>
          </div>
        )}
      </span>
    );
  }

  return (
    <span 
      className={styles.tooltipWrapper}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div className={`${styles.tooltipBubble} ${styles[position]}`} role="tooltip">
          {label && <div className={styles.tooltipLabel}>{label}</div>}
          <div className={styles.tooltipText}>{content}</div>
        </div>
      )}
    </span>
  );
}
