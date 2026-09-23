'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { apiRequest } from '../../../../lib/api';
import { useManagerSession } from '../../../../lib/auth';
import { DashboardShell } from '../../../../components/DashboardShell';
import { ActionButton } from '../../../../components/ActionButton';
import styles from '../../../../components/dashboard.module.css';

export default function NewEstatePage() {
  const { token, status } = useManagerSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', location: '', description: '', contactEmail: '', contactPhone: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const data = await apiRequest('/estates', { method: 'POST', body: JSON.stringify(form) }, token);
      router.push(`/dashboard/estates/${data.estate.id}`);
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  }

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Estates" subtitle="Add a new estate.">
      {error ? <div className={styles.loginError}>{error}</div> : null}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>New Estate</h2><p>Estates start as drafts and require the estate name and location.</p></div>
          <Building2 size={20} />
        </div>
        <form className={styles.managerForm} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label><span>Estate name</span><input required value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. Greenstone Courts Estate" /></label>
            <label><span>Location</span><input required value={form.location} onChange={(event) => setField('location', event.target.value)} placeholder="e.g. Lekki, Lagos" /></label>
            <label><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(event) => setField('contactEmail', event.target.value)} placeholder="estate@example.com" /></label>
            <label><span>Contact phone</span><input value={form.contactPhone} onChange={(event) => setField('contactPhone', event.target.value)} placeholder="e.g. 08012345678" /></label>
          </div>
          <label><span>Description</span><input value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Short description of the estate" /></label>
          <ActionButton icon={Building2} tone="positive" type="submit" disabled={isSubmitting || !form.name || !form.location}>
            {isSubmitting ? 'Creating...' : 'Create estate'}
          </ActionButton>
        </form>
      </section>
    </DashboardShell>
  );
}
