'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, CheckCircle2, MessageSquare, Trash2, XCircle } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { ageLabel, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';
import { ActionButton } from '../../../components/ActionButton';
import { DocumentCards } from '../../../components/DocumentCards';
import styles from '../../../components/dashboard.module.css';

export default function VerificationPage() {
  const { token, status, user, isSuperAdmin } = useAdminSession();
  const viewerLabel = user?.fullName || user?.email || 'Staff reviewer';
  const { data, reload } = useResource('/admin/verification/applications', token, { enabled: status === 'ready' });
  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState('');

  const applications = useMemo(
    () =>
      arrayFrom(data, 'applications').map((item) => ({
        id: item.id,
        raw: item,
        estate: item.estateName || 'Unnamed estate',
        manager: item.managerName || item.user?.fullName || item.user?.email || 'Unknown manager',
        location: item.estateLocation || 'No location',
        status: labelize(item.status),
        age: ageLabel(item.submittedAt || item.updatedAt || item.createdAt),
        documents: item.documents?.length || 0,
        signature: item.signatureMethod ? labelize(item.signatureMethod) : item.signatureText ? 'typed' : 'Not provided',
      })),
    [data],
  );

  const selected = applications.find((item) => item.id === selectedId) || applications[0] || null;

  async function updateStatus(nextStatus) {
    if (!selected || !token) return;
    setActionError('');
    try {
      await apiRequest(
        `/admin/verification/applications/${selected.raw.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
            adminNote: nextStatus === 'approved' ? 'Approved from admin dashboard.' : nextStatus === 'rejected' ? 'Rejected from admin dashboard.' : 'Additional information requested from admin dashboard.',
          }),
        },
        token,
      );
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function handleDelete() {
    if (!selected || !token) return;
    setActionError('');
    const typed = window.prompt(
      `This permanently deletes the "${selected.estate}" application and its uploaded documents. This cannot be undone.\n\nType "DELETE" to confirm:`,
    );
    if (typed !== 'DELETE') {
      if (typed !== null) setActionError('Confirmation text did not match — deletion cancelled.');
      return;
    }
    try {
      await apiRequest(`/admin/verification/applications/${selected.raw.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true }) }, token);
      setSelectedId(null);
      await reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  return (
    <DashboardShell title="Verification" subtitle="Review estate-manager onboarding applications and approval risk.">
      {actionError ? <div className={styles.loginError}>{actionError}</div> : null}
      <section className={styles.mainGrid}>
        <DataTable
          title="Verification Applications"
          subtitle="Click an application to inspect the estate before taking action."
          columns={[
            { key: 'estate', label: 'Estate' },
            { key: 'manager', label: 'Manager' },
            { key: 'location', label: 'Location' },
            { key: 'documents', label: 'Docs' },
            { key: 'status', label: 'Status', pill: true },
            { key: 'age', label: 'Updated' },
          ]}
          rows={applications}
          emptyTitle="No applications"
          emptyBody="Submitted verification applications will appear here."
          onRowClick={(row) => setSelectedId(row.id)}
          selectedId={selected?.id}
        />

        <section className={styles.detailPanel}>
          <div className={styles.panelHeader}>
            <div><h2>Selected Estate</h2><p>Review documents before approving anything.</p></div>
            <BadgeCheck size={20} />
          </div>

          {!selected ? (
            <EmptyState title="Select an application" body="Click a verification row to inspect the estate details and approval packet." />
          ) : (
            <>
              <div className={styles.detailHero}>
                <span>{selected.status}</span>
                <h3>{selected.estate}</h3>
                <p>{selected.location}</p>
              </div>

              <div className={styles.detailGrid}>
                <div><span>Manager</span><strong>{selected.manager}</strong></div>
                <div><span>Applicant type</span><strong>{labelize(selected.raw?.applicantType)}</strong></div>
                <div><span>Village / community</span><strong>{selected.raw?.villageName || 'Not provided'}</strong></div>
                <div><span>Parties involved</span><strong>{selected.raw?.partiesInvolved || 'Not provided'}</strong></div>
                <div><span>Price</span><strong>{selected.raw?.listingPrice != null ? `₦${Number(selected.raw.listingPrice).toLocaleString()}` : 'Not provided'}</strong></div>
                <div><span>Documents</span><strong>{selected.documents}</strong></div>
                <div><span>Signature</span><strong>{selected.signature}</strong></div>
                <div><span>Updated</span><strong>{selected.age}</strong></div>
              </div>

              <DocumentCards documents={selected.raw?.documents || []} token={token} allowDownload={isSuperAdmin} viewerLabel={viewerLabel} />

              <div className={styles.commandStack}>
                <ActionButton icon={CheckCircle2} tone="positive" disabled={selected.raw.status === 'approved'} onClick={() => updateStatus('approved')}>
                  Approve {selected.estate}
                </ActionButton>
                <ActionButton icon={MessageSquare} tone="warning" onClick={() => updateStatus('additional_info_required')}>
                  Request more info
                </ActionButton>
                <ActionButton icon={XCircle} tone="danger" onClick={() => updateStatus('rejected')}>
                  Reject this application
                </ActionButton>
                {isSuperAdmin && selected.raw.status !== 'approved' ? (
                  <ActionButton icon={Trash2} tone="danger" onClick={handleDelete}>
                    Delete this application
                  </ActionButton>
                ) : null}
              </div>
            </>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}
