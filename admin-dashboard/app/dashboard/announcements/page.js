'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { ActionButton } from '../../../components/ActionButton';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

const CATEGORIES = ['general', 'maintenance', 'security', 'event', 'billing'];

export default function AnnouncementsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data, reload } = useResource('/communication/announcements', token, { enabled: status === 'ready' && isSuperAdmin });
  const [estates, setEstates] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', pinned: false, estateId: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    apiRequest('/estates', {}, token).then((result) => setEstates(arrayFrom(result, 'estates'))).catch(() => setEstates([]));
  }, [token, isSuperAdmin]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await apiRequest(
        '/communication/announcements',
        { method: 'POST', body: JSON.stringify({ ...form, estateId: form.estateId || undefined }) },
        token,
      );
      setForm({ title: '', body: '', category: 'general', pinned: false, estateId: '' });
      await reload();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const rows = arrayFrom(data, 'announcements').map((item) => ({
    id: item.id,
    title: item.title,
    scope: item.estateId ? `Estate #${item.estateId}` : 'Platform-wide',
    category: labelize(item.category),
    pinned: item.pinned ? 'Pinned' : 'Not pinned',
    acknowledged: `${item.acknowledgedCount} acknowledged`,
    age: ageLabel(item.createdAt),
  }));

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Announcements" subtitle="Broadcast platform-wide or estate-specific announcements.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Announcements" subtitle="Broadcast platform-wide or estate-specific announcements.">
      {error ? <div className={styles.loginError}>{error}</div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>New Announcement</h2><p>Leave estate blank to broadcast to every estate on the platform.</p></div>
          <Megaphone size={20} />
        </div>
        <form className={styles.managerForm} onSubmit={handleSubmit}>
          <label><span>Title</span><input required value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="e.g. Platform maintenance window" /></label>
          <label><span>Message</span><input required value={form.body} onChange={(event) => setField('body', event.target.value)} placeholder="Details" /></label>
          <div className={styles.formGrid}>
            <label>
              <span>Estate (optional)</span>
              <select value={form.estateId} onChange={(event) => setField('estateId', event.target.value)}>
                <option value="">Platform-wide</option>
                {estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name}</option>)}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={form.category} onChange={(event) => setField('category', event.target.value)}>
                {CATEGORIES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
              </select>
            </label>
          </div>
          <label className={styles.checkRow}>
            <input checked={form.pinned} onChange={(event) => setField('pinned', event.target.checked)} type="checkbox" />
            <span>Pin to top of Communication Hub</span>
          </label>
          <ActionButton icon={Pin} tone="positive" type="submit" disabled={isSubmitting || !form.title || !form.body}>
            {isSubmitting ? 'Publishing...' : 'Publish announcement'}
          </ActionButton>
        </form>
      </section>

      <DataTable
        title="Published Announcements"
        subtitle="Most recent first."
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'scope', label: 'Scope' },
          { key: 'category', label: 'Category', pill: true },
          { key: 'pinned', label: 'Pinned', pill: true },
          { key: 'acknowledged', label: 'Acknowledged' },
          { key: 'age', label: 'Published' },
        ]}
        rows={rows}
        emptyTitle="No announcements yet"
        emptyBody="Publish your first announcement above."
      />
    </DashboardShell>
  );
}
