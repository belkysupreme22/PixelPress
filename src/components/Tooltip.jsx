"use client";

import { useState } from 'react';
import styles from './Tooltip.module.css';

export default function Tooltip({ children, content, label, position = "top" }) {
  const [visible, setVisible] = useState(false);

  return (
    <div 
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
    </div>
  );
}
