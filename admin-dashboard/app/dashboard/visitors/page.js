'use client';

import { useMemo } from 'react';
import { arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';

export default function VisitorsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data } = useResource('/visitor-passes', token, { enabled: status === 'ready' && isSuperAdmin });

  const visitors = useMemo(
    () =>
      arrayFrom(data, 'passes', 'visitorPasses').map((item) => ({
        id: item.id,
        code: item.code || item.passCode || '-',
        visitor: item.visitorName || item.name || 'Unknown visitor',
        host: item.hostName || item.requestedBy || 'Unknown host',
        status: labelize(item.status),
        age: ageLabel(item.createdAt || item.updatedAt),
      })),
    [data],
  );

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Visitors" subtitle="Monitor QR scans, visitor passes, and gate-side activity.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Visitors" subtitle="Monitor QR scans, visitor passes, and gate-side activity.">
      <DataTable
        title="Visitor Passes"
        subtitle="QR and PIN visitor activity across all estates."
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'visitor', label: 'Visitor' },
          { key: 'host', label: 'Host' },
          { key: 'status', label: 'Status', pill: true },
          { key: 'age', label: 'Updated' },
        ]}
        rows={visitors}
        emptyTitle="No visitor passes"
        emptyBody="Resident-created visitor passes will appear here."
      />
    </DashboardShell>
  );
}
