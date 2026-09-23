'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import styles from '../../../components/dashboard.module.css';

export default function EstatesPage() {
  const { token, status } = useManagerSession();
  const { data } = useResource('/estates', token, { enabled: status === 'ready' });
  const router = useRouter();

  const estates = useMemo(
    () =>
      arrayFrom(data, 'estates').map((item) => ({
        id: item.id,
        name: item.name || 'Unnamed estate',
        location: item.location || 'No location',
        status: labelize(item.status),
        published: item.isPublished ? 'Public' : 'Not public',
        created: ageLabel(item.createdAt),
      })),
    [data],
  );

  if (status !== 'ready') return null;

  return (
    <DashboardShell
      title="Estates"
      subtitle="Estates you manage on the platform."
      headerActions={
        <Link className={`${styles.actionButton} ${styles.positive}`} href="/dashboard/estates/new">
          <Plus size={17} />
          <span>Add estate</span>
        </Link>
      }
    >
      <DataTable
        title="Your Estates"
        subtitle="Click an estate to edit its details."
        columns={[
          { key: 'name', label: 'Estate' },
          { key: 'location', label: 'Location' },
          { key: 'status', label: 'Status', pill: true },
          { key: 'published', label: 'Visibility', pill: true },
          { key: 'created', label: 'Created' },
        ]}
        rows={estates}
        emptyTitle="No estates yet"
        emptyBody="Add your first estate to start listing plots."
        onRowClick={(row) => router.push(`/dashboard/estates/${row.id}`)}
      />
    </DashboardShell>
  );
}
