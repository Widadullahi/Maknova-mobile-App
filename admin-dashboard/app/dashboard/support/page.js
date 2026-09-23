'use client';

import { useMemo } from 'react';
import { arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';

export default function SupportPage() {
  const { token, status } = useAdminSession();
  const { data } = useResource('/support/tickets', token, { enabled: status === 'ready' });

  const tickets = useMemo(
    () =>
      arrayFrom(data, 'tickets').map((item) => ({
        id: item.id,
        subject: item.subject || 'Support ticket',
        category: labelize(item.category),
        reporter: item.reporterName || `User #${item.reporterUserId || '-'}`,
        priority: labelize(item.priority),
        status: labelize(item.status),
        age: ageLabel(item.updatedAt || item.createdAt),
      })),
    [data],
  );

  return (
    <DashboardShell title="Support" subtitle="Track support queues and escalation ownership.">
      <DataTable
        title="Support Tickets"
        subtitle="Support tickets and escalation ownership from backend."
        columns={[
          { key: 'subject', label: 'Subject' },
          { key: 'category', label: 'Category' },
          { key: 'reporter', label: 'Reporter' },
          { key: 'priority', label: 'Priority', pill: true },
          { key: 'status', label: 'Status', pill: true },
          { key: 'age', label: 'Updated' },
        ]}
        rows={tickets}
        emptyTitle="No support tickets"
        emptyBody="Support tickets created through the backend will appear here."
      />
    </DashboardShell>
  );
}
