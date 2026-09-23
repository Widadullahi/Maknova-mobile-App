'use client';

import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Trash2, UserX } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { ActionButton } from '../../../components/ActionButton';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function UsersPage() {
  const { token, status, user: currentUser, isSuperAdmin } = useAdminSession();
  const { data, reload } = useResource('/users', token, { enabled: status === 'ready' && isSuperAdmin });
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');

  const users = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return arrayFrom(data, 'users')
      .map((item) => ({
        id: item.id,
        raw: item,
        name: item.fullName || item.email || 'Unnamed user',
        email: item.email || '-',
        role: labelize(item.role),
        accountStatus: item.accountStatus,
        statusLabel: labelize(item.accountStatus),
        joined: ageLabel(item.createdAt),
      }))
      .filter((row) => !needle || [row.name, row.email, row.role].some((field) => field.toLowerCase().includes(needle)));
  }, [data, search]);

  async function setStatus(userId, nextStatus) {
    setActionError('');
    try {
      await apiRequest(`/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }, token);
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function handleDelete(row) {
    setActionError('');
    const typed = window.prompt(
      `This permanently deletes ${row.name} (${row.email}). This cannot be undone.\n\nType "DELETE" to confirm:`,
    );
    if (typed !== 'DELETE') {
      if (typed !== null) setActionError('Confirmation text did not match — deletion cancelled.');
      return;
    }
    try {
      await apiRequest(`/users/${row.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true }) }, token);
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Users & Roles" subtitle="Manage roles, account restrictions, and estate assignments.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Users & Roles"
      subtitle="Manage roles, account restrictions, and estate assignments."
      headerActions={
        <label className={styles.searchBox}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" />
        </label>
      }
    >
      {actionError ? <div className={styles.loginError}>{actionError}</div> : null}
      <DataTable
        title="Users & Roles"
        subtitle="Admin view of accounts, roles, and restriction state. Permanent deletion is Master Owner-only, and only works for accounts with no linked records (suspend otherwise)."
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', pill: true },
          { key: 'statusLabel', label: 'Status', pill: true },
          { key: 'joined', label: 'Joined' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) =>
              row.id === currentUser?.id ? (
                <small>You</small>
              ) : (
                <div className={styles.rowActions}>
                  {row.accountStatus !== 'active' ? (
                    <ActionButton icon={CheckCircle2} tone="positive" onClick={() => setStatus(row.id, 'active')}>Activate</ActionButton>
                  ) : null}
                  {row.accountStatus !== 'suspended' ? (
                    <ActionButton icon={Ban} tone="warning" onClick={() => setStatus(row.id, 'suspended')}>Suspend</ActionButton>
                  ) : null}
                  {row.accountStatus !== 'rejected' ? (
                    <ActionButton icon={UserX} tone="danger" onClick={() => setStatus(row.id, 'rejected')}>Reject</ActionButton>
                  ) : null}
                  {isSuperAdmin && row.raw.role !== 'super_admin' ? (
                    <ActionButton icon={Trash2} tone="danger" onClick={() => handleDelete(row)}>Delete</ActionButton>
                  ) : null}
                </div>
              ),
          },
        ]}
        rows={users}
        emptyTitle="No users found"
        emptyBody="User accounts registered on the backend will appear here."
      />
    </DashboardShell>
  );
}
