'use client';

import { FileSearch } from 'lucide-react';
import styles from './dashboard.module.css';

export function EmptyState({ title = 'No records yet', body = 'The backend returned an empty list for this section.' }) {
  return (
    <div className={styles.emptyState}>
      <FileSearch size={22} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
