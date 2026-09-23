'use client';

import { useMemo } from 'react';
import { arrayFrom } from '../../../lib/api';
import { ageLabel } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';

function metadataPreview(value) {
  if (!value) return '-';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Object.entries(parsed)
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ') || '-';
  } catch {
    return String(value);
  }
}

export default function AuditLogsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data } = useResource('/admin/audit-logs', token, { enabled: status === 'ready' && isSuperAdmin });

  const logs = useMemo(
    () =>
      arrayFrom(data, 'auditLogs').map((item) => ({
        id: item.id,
        actor: item.actorName || item.actorEmail || 'System',
        action: item.action,
        entity: item.entityType ? `${item.entityType}${item.entityId ? ` #${item.entityId}` : ''}` : '-',
        details: metadataPreview(item.metadata),
        age: ageLabel(item.createdAt),
      })),
    [data],
  );

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Audit Logs" subtitle="Every verification decision, staff action, and sensitive change — who did what, and when.">
        <EmptyState title="Master Owner access required" body="Reviewing the audit trail is an oversight function reserved for the Master Owner. Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Audit Logs" subtitle="Every verification decision, staff action, and sensitive change — who did what, and when.">
      <DataTable
        title="Audit Trail"
        subtitle="Most recent 200 recorded actions across the platform."
        columns={[
          { key: 'actor', label: 'Staff member' },
          { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Entity' },
          { key: 'details', label: 'Details' },
          { key: 'age', label: 'When' },
        ]}
        rows={logs}
        emptyTitle="No audit records yet"
        emptyBody="Verification approvals/rejections, staff account changes, and settings updates will appear here."
      />
    </DashboardShell>
  );
}
