'use client';

import styles from './dashboard.module.css';

export function ActionButton({ icon: Icon, children, tone = 'neutral', disabled, onClick, type = 'button' }) {
  return (
    <button className={`${styles.actionButton} ${styles[tone] || ''}`} disabled={disabled} onClick={onClick} type={type}>
      {Icon ? <Icon size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}
