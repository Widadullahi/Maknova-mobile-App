'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { formatNaira, labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import styles from '../../../components/dashboard.module.css';

export default function PropertiesPage() {
  const { token, status } = useManagerSession();
  const router = useRouter();
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token).then(async (estateData) => {
      const estates = arrayFrom(estateData, 'estates');
      const scoped = await Promise.all(
        estates.map((estate) =>
          apiRequest(`/estates/${estate.id}/properties`, {}, token)
            .then((data) => arrayFrom(data, 'properties').map((property) => ({ ...property, estateName: estate.name })))
            .catch(() => []),
        ),
      );
      setProperties(scoped.flat());
    });
  }, [token]);

  const rows = useMemo(
    () =>
      properties.map((item) => ({
        id: item.id,
        estateId: item.estateId,
        estate: item.estateName || `Estate #${item.estateId}`,
        identifier: item.propertyIdentifier || item.plotNumber || '-',
        type: labelize(item.propertyType),
        price: formatNaira(item.price),
        status: labelize(item.status),
      })),
    [properties],
  );

  if (status !== 'ready') return null;

  return (
    <DashboardShell
      title="Plots"
      subtitle="Every plot across the estates you manage."
      headerActions={
        <Link className={`${styles.actionButton} ${styles.positive}`} href="/dashboard/properties/new">
          <Plus size={17} />
          <span>Add plot</span>
        </Link>
      }
    >
      <DataTable
        title="Plot Registry"
        subtitle="Click a plot to view, edit, or update its status."
        columns={[
          { key: 'estate', label: 'Estate' },
          { key: 'identifier', label: 'Identifier' },
          { key: 'type', label: 'Type' },
          { key: 'price', label: 'Price' },
          { key: 'status', label: 'Status', pill: true },
        ]}
        rows={rows}
        emptyTitle="No plots yet"
        emptyBody="Add your first plot to start selling."
        onRowClick={(row) => router.push(`/dashboard/properties/${row.id}?estateId=${row.estateId}`)}
      />
    </DashboardShell>
  );
}
