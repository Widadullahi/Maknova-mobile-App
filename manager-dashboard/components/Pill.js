'use client';

import { toneFor } from '../lib/format';
import styles from './dashboard.module.css';

export function Pill({ children }) {
  const tone = toneFor(children);
  return <span className={`${styles.pill} ${styles[`${tone}Pill`]}`}>{children}</span>;
}
