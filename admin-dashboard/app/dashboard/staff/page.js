'use client';

import { useMemo, useState } from 'react';
import { KeyRound, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

function generateReadablePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let value = '';
  for (let i = 0; i < 12; i += 1) value += chars[Math.floor(Math.random() * chars.length)];
  return value;
}

export default function StaffPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data, reload } = useResource('/admin/staff', token, { enabled: status === 'ready' && isSuperAdmin });
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [lastCreated, setLastCreated] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const staff = useMemo(
    () =>
      arrayFrom(data, 'staff').map((item) => ({
        id: item.id,
        raw: item,
        name: item.fullName || item.email,
        email: item.email,
        role: labelize(item.role),
        statusLabel: labelize(item.accountStatus),
        joined: ageLabel(item.createdAt),
      })),
    [data],
  );

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setLastCreated(null);
    setIsSubmitting(true);
    try {
      const result = await apiRequest(
        '/admin/staff',
        { method: 'POST', body: JSON.stringify(form) },
        token,
      );
      setLastCreated({ email: form.email, password: result.generatedPassword || form.password });
      setForm({ fullName: '', email: '', password: '' });
      await reload();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(staffId) {
    setFormError('');
    try {
      await apiRequest(`/admin/staff/${staffId}`, { method: 'DELETE' }, token);
      await reload();
    } catch (error) {
      setFormError(error.message);
    }
  }

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Staff Accounts" subtitle="Create and manage verification staff accounts.">
        <EmptyState
          title="Master Owner access required"
          body="Only the Master Owner account can create, view, or remove staff admin accounts."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Staff Accounts" subtitle="Give your verification team their own logins — never share your Master Owner credentials.">
      {formError ? <div className={styles.loginError}>{formError}</div> : null}

      {lastCreated ? (
        <div className={styles.credentialBanner}>
          <strong>Staff account created for {lastCreated.email}</strong>
          <span>Share this password once — it cannot be retrieved again after you leave this page.</span>
          <code>{lastCreated.password}</code>
        </div>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Add staff admin</h2><p>Leave password blank to auto-generate a secure one-time password.</p></div>
          <UserPlus size={20} />
        </div>
        <form className={styles.inlineForm} onSubmit={handleCreate}>
          <label>
            <span>Full name</span>
            <input required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="e.g. Adaeze Okafor" />
          </label>
          <label>
            <span>Email</span>
            <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="staff@estateflow.com" />
          </label>
          <label>
            <span>Password (optional)</span>
            <input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to auto-generate" />
          </label>
          <ActionButton icon={KeyRound} tone="neutral" type="button" onClick={() => setForm((current) => ({ ...current, password: generateReadablePassword() }))}>
            Suggest password
          </ActionButton>
          <ActionButton icon={UserPlus} tone="positive" type="submit" disabled={isSubmitting || !form.fullName || !form.email}>
            {isSubmitting ? 'Creating...' : 'Create staff account'}
          </ActionButton>
        </form>
      </section>

      <DataTable
        title="Staff & Master Owner accounts"
        subtitle="Verification reviewers have restricted access: they can review and decide on documents, but cannot access payouts, financial settings, or download raw document files."
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', pill: true },
          { key: 'statusLabel', label: 'Status', pill: true },
          { key: 'joined', label: 'Added' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) =>
              row.raw.role === 'super_admin' ? (
                <small><ShieldAlert size={14} /> Master Owner</small>
              ) : (
                <ActionButton icon={Trash2} tone="danger" onClick={() => handleDelete(row.id)}>Remove</ActionButton>
              ),
          },
        ]}
        rows={staff}
        emptyTitle="No staff accounts yet"
        emptyBody="Create your first staff admin account above."
      />
    </DashboardShell>
  );
}
