'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import styles from '../../../components/dashboard.module.css';

export default function ResidentsPage() {
  const { token, status } = useManagerSession();
  const [estates, setEstates] = useState([]);
  const [estateId, setEstateId] = useState('');
  const [residents, setResidents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token).then((data) => {
      const rows = arrayFrom(data, 'estates');
      setEstates(rows);
      setEstateId((current) => current || rows[0]?.id || '');
    });
  }, [token]);

  async function reload() {
    if (!token || !estateId) return;
    const data = await apiRequest(`/estates/${estateId}/residents`, {}, token).catch(() => ({}));
    setResidents(arrayFrom(data, 'residents'));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estateId]);

  async function setResidentStatus(residentId, nextStatus) {
    setError('');
    try {
      await apiRequest(`/estates/${estateId}/residents/${residentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }, token);
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  const rows = useMemo(
    () =>
      residents.map((item) => ({
        id: item.id,
        name: item.fullName,
        phone: item.phone || '-',
        email: item.email || '-',
        statusValue: item.status,
        status: labelize(item.status),
        joined: ageLabel(item.createdAt),
      })),
    [residents],
  );

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Residents" subtitle="Residents linked to your estates.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Estate</h2></div></div>
        <select value={estateId} onChange={(event) => setEstateId(event.target.value)} style={{ height: 43, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', padding: '0 12px' }}>
          {estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name}</option>)}
        </select>
      </section>
      <DataTable
        title="Residents"
        subtitle="Verify residents before they gain full access."
        columns={[
          { key: 'name', label: 'Resident' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'status', label: 'Status', pill: true },
          { key: 'joined', label: 'Joined' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) =>
              row.statusValue !== 'verified' ? (
                <ActionButton icon={CheckCircle2} tone="positive" onClick={() => setResidentStatus(row.id, 'verified')}>Verify</ActionButton>
              ) : (
                <small>Verified</small>
              ),
          },
        ]}
        rows={rows}
        emptyTitle="No residents found"
        emptyBody="Residents who register against this estate will appear here."
      />
    </DashboardShell>
  );
}
