'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import styles from '../../../components/dashboard.module.css';

export default function MaintenancePage() {
  const { token, status } = useManagerSession();
  const { data, reload } = useResource('/maintenance/requests', token, { enabled: status === 'ready' });
  const [error, setError] = useState('');

  const requests = useMemo(
    () =>
      arrayFrom(data, 'requests', 'maintenanceRequests').map((item) => ({
        id: item.id,
        title: item.title || 'Maintenance request',
        category: labelize(item.category),
        priority: labelize(item.priority),
        statusValue: item.status,
        status: labelize(item.status),
        age: ageLabel(item.createdAt || item.updatedAt),
      })),
    [data],
  );

  async function resolve(requestId) {
    setError('');
    try {
      await apiRequest(`/maintenance/requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }, token);
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <DashboardShell title="Maintenance" subtitle="Maintenance tickets across your estates.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      <DataTable
        title="Maintenance Tickets"
        subtitle="Update ticket status as work progresses."
        columns={[
          { key: 'title', label: 'Ticket' },
          { key: 'category', label: 'Category' },
          { key: 'priority', label: 'Priority', pill: true },
          { key: 'status', label: 'Status', pill: true },
          { key: 'age', label: 'Updated' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) =>
              !['resolved', 'closed'].includes(row.statusValue) ? (
                <ActionButton icon={CheckCircle2} tone="positive" onClick={() => resolve(row.id)}>Mark resolved</ActionButton>
              ) : (
                <small>Done</small>
              ),
          },
        ]}
        rows={requests}
        emptyTitle="No maintenance tickets"
        emptyBody="Tickets submitted by your residents will appear here."
      />
    </DashboardShell>
  );
}
