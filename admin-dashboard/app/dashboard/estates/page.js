'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, formatNaira, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function EstatesPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const [estates, setEstates] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle');
  const [actionError, setActionError] = useState('');

  async function loadAll() {
    if (!token || !isSuperAdmin) return;
    setLoadStatus('loading');
    try {
      const data = await apiRequest('/estates', {}, token);
      const estateRows = arrayFrom(data, 'estates');
      setEstates(estateRows);
      const scoped = await Promise.all(
        estateRows.map((estate) =>
          apiRequest(`/estates/${estate.id}/properties`, {}, token)
            .then((propertyData) => arrayFrom(propertyData, 'properties').map((property) => ({ ...property, estateName: estate.name })))
            .catch(() => []),
        ),
      );
      setProperties(scoped.flat());
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isSuperAdmin]);

  async function handleDelete(estate) {
    setActionError('');
    const typed = window.prompt(
      `This permanently deletes "${estate.name}" and every plot, buyer, sale, and resident record tied to it. This cannot be undone.\n\nType the estate name exactly to confirm:`,
    );
    if (typed !== estate.name) {
      if (typed !== null) setActionError('Estate name did not match — deletion cancelled.');
      return;
    }
    try {
      await apiRequest(`/estates/${estate.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true }) }, token);
      await loadAll();
    } catch (error) {
      setActionError(error.message);
    }
  }

  const estateRows = useMemo(
    () =>
      estates.map((item) => ({
        id: item.id,
        raw: item,
        name: item.name || 'Unnamed estate',
        location: item.location || 'No location',
        status: labelize(item.status),
        plots: item.propertiesCount ?? item.plotsCount ?? 0,
        published: item.isPublished ? 'Public' : 'Not public',
        created: ageLabel(item.createdAt),
      })),
    [estates],
  );

  const propertyRows = useMemo(
    () =>
      properties.map((item) => ({
        id: `${item.estateId}-${item.id}`,
        estate: item.estateName || `Estate #${item.estateId || '-'}`,
        identifier: item.propertyIdentifier || item.plotNumber || '-',
        type: labelize(item.propertyType),
        size: item.plotSize || '-',
        price: formatNaira(item.price),
        status: labelize(item.status),
      })),
    [properties],
  );

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Estates & Plots" subtitle="Oversee estate publishing and plot inventory across the platform.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Estates & Plots" subtitle="Oversee estate publishing and plot inventory across the platform.">
      {actionError ? <div className={styles.loginError}>{actionError}</div> : null}
      <div className={styles.loginFooterNote}>
        Estate and plot creation happens on the estate manager&apos;s own app/site — this dashboard is for review, verification, and moderation only.
        {isSuperAdmin ? ' As Master Owner, you can also permanently delete an estate below.' : ''}
      </div>
      <DataTable
        title="Estate Registry"
        subtitle="Estates returned by the backend, across all managers."
        columns={[
          { key: 'name', label: 'Estate' },
          { key: 'location', label: 'Location' },
          { key: 'plots', label: 'Plots' },
          { key: 'status', label: 'Status', pill: true },
          { key: 'published', label: 'Visibility', pill: true },
          { key: 'created', label: 'Created' },
          ...(isSuperAdmin
            ? [
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButton icon={Trash2} tone="danger" onClick={() => handleDelete(row.raw)}>
                      Delete
                    </ActionButton>
                  ),
                },
              ]
            : []),
        ]}
        rows={estateRows}
        emptyTitle={loadStatus === 'loading' ? 'Loading estates...' : 'No estates'}
        emptyBody="Approve an estate manager verification application to create the first estate."
      />
      <DataTable
        title="Plot Registry"
        subtitle="Property/plot records across all estates."
        columns={[
          { key: 'estate', label: 'Estate' },
          { key: 'identifier', label: 'Identifier' },
          { key: 'type', label: 'Type' },
          { key: 'size', label: 'Size' },
          { key: 'price', label: 'Price' },
          { key: 'status', label: 'Status', pill: true },
        ]}
        rows={propertyRows}
        emptyTitle="No plots yet"
        emptyBody="Plots created by estate managers will appear here."
      />
    </DashboardShell>
  );
}
