'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../../lib/api';
import { useManagerSession } from '../../../../lib/auth';
import { DashboardShell } from '../../../../components/DashboardShell';
import { ActionButton } from '../../../../components/ActionButton';
import { CameraCapture } from '../../../../components/CameraCapture';
import styles from '../../../../components/dashboard.module.css';

const PROPERTY_TYPES = ['Residential plot', 'Commercial plot', 'Industrial plot'];

function NewPropertyForm() {
  const { token, status } = useManagerSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [estates, setEstates] = useState([]);
  const [form, setForm] = useState({
    estateId: searchParams.get('estateId') || '',
    propertyIdentifier: '',
    plotNumber: '',
    propertyType: PROPERTY_TYPES[0],
    plotSize: '',
    price: '',
    description: '',
  });
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token).then((data) => {
      const rows = arrayFrom(data, 'estates');
      setEstates(rows);
      setForm((current) => ({ ...current, estateId: current.estateId || rows[0]?.id || '' }));
    });
  }, [token]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!photos.length) {
      setError('Capture at least one live camera photo of the plot before saving. Gallery uploads are not accepted.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await apiRequest(
        `/estates/${form.estateId}/properties`,
        {
          method: 'POST',
          body: JSON.stringify({
            propertyIdentifier: form.propertyIdentifier,
            plotNumber: form.plotNumber,
            propertyType: form.propertyType,
            plotSize: form.plotSize,
            price: Number(form.price || 0),
            description: form.description,
            status: 'available',
          }),
        },
        token,
      );
      const propertyId = created.property.id;

      const photoForm = new FormData();
      photoForm.append('category', 'image');
      photos.forEach((photo) => photoForm.append('files', photo.file, photo.file.name));
      await apiRequest(`/estates/${form.estateId}/properties/${propertyId}/documents/upload`, { method: 'POST', body: photoForm }, token);

      router.push(`/dashboard/properties/${propertyId}?estateId=${form.estateId}`);
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  }

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Plots" subtitle="Add a new plot.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>New Plot</h2><p>Property photos require a live camera capture — no gallery uploads, to prevent fraudulent or stale listings.</p></div>
          <Home size={20} />
        </div>
        <form className={styles.managerForm} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label>
              <span>Estate</span>
              <select value={form.estateId} onChange={(event) => setField('estateId', event.target.value)}>
                {estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name}</option>)}
              </select>
            </label>
            <label>
              <span>Property type</span>
              <select value={form.propertyType} onChange={(event) => setField('propertyType', event.target.value)}>
                {PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label><span>Property identifier</span><input required value={form.propertyIdentifier} onChange={(event) => setField('propertyIdentifier', event.target.value)} placeholder="e.g. GM-PLT-001" /></label>
            <label><span>Plot number</span><input value={form.plotNumber} onChange={(event) => setField('plotNumber', event.target.value)} placeholder="e.g. Plot 12B" /></label>
            <label><span>Plot size</span><input value={form.plotSize} onChange={(event) => setField('plotSize', event.target.value)} placeholder="e.g. 500 sqm" /></label>
            <label><span>Price (₦)</span><input inputMode="numeric" required value={form.price} onChange={(event) => setField('price', event.target.value)} placeholder="e.g. 25000000" /></label>
          </div>
          <label><span>Description</span><input value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Road access, allocation notes, or development constraints" /></label>

          <div>
            <span style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 900, color: 'var(--soft)' }}>Plot photos (live camera capture required)</span>
            <CameraCapture photos={photos} onChange={setPhotos} />
          </div>

          <ActionButton icon={Home} tone="positive" type="submit" disabled={isSubmitting || !form.estateId}>
            {isSubmitting ? 'Saving...' : 'Save plot'}
          </ActionButton>
        </form>
      </section>
    </DashboardShell>
  );
}

export default function NewPropertyPage() {
  return (
    <Suspense fallback={null}>
      <NewPropertyForm />
    </Suspense>
  );
}
