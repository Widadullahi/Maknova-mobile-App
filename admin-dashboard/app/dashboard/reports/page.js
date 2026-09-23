'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, PauseCircle } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function ReportsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data, reload } = useResource('/reports', token, { enabled: status === 'ready' && isSuperAdmin });
  const [actionError, setActionError] = useState('');

  const reports = useMemo(
    () =>
      arrayFrom(data, 'reports').map((item) => ({
        id: item.id,
        estateId: item.estateId,
        estate: item.estateName || `Estate #${item.estateId || '-'}`,
        category: labelize(item.category || item.reason, 'Report'),
        statusValue: item.status,
        status: labelize(item.status),
        severity: labelize(item.severity || item.priority, 'Normal'),
        age: ageLabel(item.createdAt || item.updatedAt),
      })),
    [data],
  );

  async function updateStatus(reportId, nextStatus) {
    setActionError('');
    try {
      await apiRequest(`/reports/${reportId}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }, token);
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Public Reports" subtitle="Investigate public estate reports and moderation decisions.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Public Reports" subtitle="Investigate public estate reports and moderation decisions.">
      {actionError ? <div className={styles.loginError}>{actionError}</div> : null}
      <DataTable
        title="Public Reports"
        subtitle="User-submitted reports and moderation state. Suspending/removing an estate here is logged to the audit trail."
        columns={[
          { key: 'estate', label: 'Estate' },
          { key: 'category', label: 'Category' },
          { key: 'severity', label: 'Severity', pill: true },
          { key: 'status', label: 'Status', pill: true },
          { key: 'age', label: 'Updated' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className={styles.rowActions}>
                {row.statusValue !== 'under_review' ? (
                  <ActionButton icon={PauseCircle} tone="warning" onClick={() => updateStatus(row.id, 'under_review')}>Mark under review</ActionButton>
                ) : null}
                {row.estateId && row.statusValue !== 'estate_suspended' ? (
                  <ActionButton icon={Ban} tone="warning" onClick={() => updateStatus(row.id, 'estate_suspended')}>Suspend estate</ActionButton>
                ) : null}
                {isSuperAdmin && row.estateId && row.statusValue !== 'estate_removed' ? (
                  <ActionButton icon={AlertTriangle} tone="danger" onClick={() => updateStatus(row.id, 'estate_removed')}>Remove estate</ActionButton>
                ) : null}
                {row.statusValue !== 'dismissed' ? (
                  <ActionButton icon={Ban} onClick={() => updateStatus(row.id, 'dismissed')}>Dismiss</ActionButton>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={reports}
        emptyTitle="No reports"
        emptyBody="Public estate reports will appear here."
      />
    </DashboardShell>
  );
}
