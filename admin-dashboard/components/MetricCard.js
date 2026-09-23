'use client';

import { formatCount } from '../lib/format';
import styles from './dashboard.module.css';

export function MetricCard({ icon: Icon, label, value, trend, tone = 'info' }) {
  return (
    <article className={styles.metricCard}>
      <div className={`${styles.metricIcon} ${styles[tone]}`}>
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{formatCount(value)}</strong>
      <p>{trend}</p>
    </article>
  );
}
