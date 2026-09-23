'use client';

import { EmptyState } from './EmptyState';
import { Pill } from './Pill';
import styles from './dashboard.module.css';

export function DataTable({ title, subtitle, columns, rows, emptyTitle, emptyBody, onRowClick, selectedId, actions }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actions}
      </div>
      {!rows.length ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`${onRowClick ? styles.clickableRow : ''} ${selectedId === row.id ? styles.selectedRow : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render ? column.render(row) : column.pill ? <Pill>{row[column.key]}</Pill> : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
