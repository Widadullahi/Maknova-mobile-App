'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Home, Save } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../../lib/api';
import { formatNaira, labelize } from '../../../../lib/format';
import { useManagerSession } from '../../../../lib/auth';
import { DashboardShell } from '../../../../components/DashboardShell';
import { ActionButton } from '../../../../components/ActionButton';
import { DataTable } from '../../../../components/DataTable';
import styles from '../../../../components/dashboard.module.css';

export default function EstateDetailPage() {
  const { token, status } = useManagerSession();
  const params = useParams();
  const router = useRouter();
  const estateId = params.id;

  const [form, setForm] = useState(null);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token || !estateId) return;
    apiRequest(`/estates/${estateId}`, {}, token)
      .then((data) => setForm(data.estate))
      .catch((err) => setError(err.message));
    apiRequest(`/estates/${estateId}/properties`, {}, token)
      .then((data) => setProperties(arrayFrom(data, 'properties')))
      .catch(() => setProperties([]));
  }, [token, estateId]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const data = await apiRequest(
        `/estates/${estateId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            location: form.location,
            description: form.description,
            contactEmail: form.contactEmail,
            contactPhone: form.contactPhone,
          }),
        },
        token,
      );
      setForm(data.estate);
      setMessage('Estate updated.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePublish() {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/estates/${estateId}/publish`, { method: 'PATCH', body: JSON.stringify({ isPublished: !form.isPublished }) }, token);
      setForm(data.estate);
      setMessage(data.estate.isPublished ? 'Estate is now public.' : 'Estate is now hidden from public listings.');
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  const propertyRows = properties.map((item) => ({
    id: item.id,
    identifier: item.propertyIdentifier || item.plotNumber || '-',
    type: labelize(item.propertyType),
    price: formatNaira(item.price),
    status: labelize(item.status),
  }));

  if (status !== 'ready' || !form) return null;

  return (
    <DashboardShell title="Estates" subtitle={form.name || 'Estate details'}>
      {error ? <div className={styles.loginError}>{error}</div> : null}
      {message ? <div className={styles.credentialBanner}><strong>{message}</strong></div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Estate Details</h2><p>Estate ID #{estateId}. Status: {labelize(form.status)}.</p></div>
        </div>
        <form className={styles.managerForm} onSubmit={handleSave}>
          <div className={styles.formGrid}>
            <label><span>Estate name</span><input required value={form.name || ''} onChange={(event) => setField('name', event.target.value)} /></label>
            <label><span>Location</span><input required value={form.location || ''} onChange={(event) => setField('location', event.target.value)} /></label>
            <label><span>Contact email</span><input type="email" value={form.contactEmail || ''} onChange={(event) => setField('contactEmail', event.target.value)} /></label>
            <label><span>Contact phone</span><input value={form.contactPhone || ''} onChange={(event) => setField('contactPhone', event.target.value)} /></label>
          </div>
          <label><span>Description</span><input value={form.description || ''} onChange={(event) => setField('description', event.target.value)} /></label>
          <ActionButton icon={Save} tone="positive" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</ActionButton>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Public Visibility</h2><p>Interested buyers can only see this estate exists once it is both approved by the platform owner and switched public here.</p></div>
        </div>
        {form.status !== 'approved' ? (
          <p className={styles.cameraHint}>This estate must be approved by the platform owner before it can be made public.</p>
        ) : (
          <ActionButton icon={form.isPublished ? EyeOff : Eye} tone={form.isPublished ? 'warning' : 'positive'} onClick={togglePublish}>
            {form.isPublished ? 'Hide from public listings' : 'Make public'}
          </ActionButton>
        )}
      </section>

      <DataTable
        title="Plots in this estate"
        subtitle="Add plots from the Plots tab."
        columns={[
          { key: 'identifier', label: 'Identifier' },
          { key: 'type', label: 'Type' },
          { key: 'price', label: 'Price' },
          { key: 'status', label: 'Status', pill: true },
        ]}
        rows={propertyRows}
        emptyTitle="No plots in this estate yet"
        emptyBody="Add a plot from the Plots tab and select this estate."
        actions={
          <Link className={styles.actionButton} href={`/dashboard/properties/new?estateId=${estateId}`}>
            <Home size={17} />
            <span>Add plot</span>
          </Link>
        }
        onRowClick={(row) => router.push(`/dashboard/properties/${row.id}?estateId=${estateId}`)}
      />
    </DashboardShell>
  );
}
