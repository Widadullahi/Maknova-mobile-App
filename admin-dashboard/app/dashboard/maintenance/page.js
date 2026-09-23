'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function MaintenancePage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data, reload } = useResource('/maintenance/requests', token, { enabled: status === 'ready' && isSuperAdmin });
  const [actionError, setActionError] = useState('');

  const requests = useMemo(
    () =>
      arrayFrom(data, 'requests', 'maintenanceRequests').map((item) => ({
        id: item.id,
        title: item.title || 'Maintenance request',
        category: labelize(item.category),
        priority: labelize(item.priority),
        statusValue: item.status,
        status: labelize(item.status),
        provider: item.providerName || item.provider?.name || 'Unassigned',
        age: ageLabel(item.createdAt || item.updatedAt),
      })),
    [data],
  );

  async function resolve(requestId) {
    setActionError('');
    try {
      await apiRequest(`/maintenance/requests/${requestId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }, token);
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Maintenance" subtitle="Track maintenance tickets, providers, and lifecycle state.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Maintenance" subtitle="Track maintenance tickets, providers, and lifecycle state.">
      {actionError ? <div className={styles.loginError}>{actionError}</div> : null}
      <DataTable
        title="Maintenance Lifecycle"
        subtitle="Tickets and provider assignment state across all estates."
        columns={[
          { key: 'title', label: 'Ticket' },
          { key: 'category', label: 'Category' },
          { key: 'provider', label: 'Provider' },
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
        emptyTitle="No tickets"
        emptyBody="Maintenance requests submitted by residents will appear here."
      />
    </DashboardShell>
  );
}
