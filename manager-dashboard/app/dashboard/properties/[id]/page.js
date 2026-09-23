'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, FileCheck, Save } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../../../lib/api';
import { labelize } from '../../../../lib/format';
import { useManagerSession } from '../../../../lib/auth';
import { DashboardShell } from '../../../../components/DashboardShell';
import { ActionButton } from '../../../../components/ActionButton';
import { Pill } from '../../../../components/Pill';
import { DocumentCards } from '../../../../components/DocumentCards';
import { CameraCapture } from '../../../../components/CameraCapture';
import styles from '../../../../components/dashboard.module.css';

// Client-facing lifecycle is exactly 3 statuses: Available, Reserved, Sold/Allocated.
function propertyStatusLabel(statusValue) {
  if (statusValue === 'sold' || statusValue === 'allocated') return 'Sold / Allocated';
  if (statusValue === 'under_offer') return 'Reserved';
  return labelize(statusValue);
}

// 'allocated' is set automatically by the backend once the Plot Allocation Form is
// generated (see sales.py) — it's not a manual manager action, so it isn't offered
// as a button here. 'under_offer' and 'unavailable' stay valid in the database for
// edge cases but are no longer surfaced as manual transitions.
const STATUS_TRANSITIONS = {
  available: ['reserved'],
  reserved: ['available', 'sold'],
  under_offer: [],
  sold: [],
  allocated: [],
  unavailable: ['available'],
};

function PropertyDetail() {
  const { token, status } = useManagerSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const propertyId = params.id;
  const estateId = searchParams.get('estateId');

  const [property, setProperty] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [deedFile, setDeedFile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function loadAll() {
    if (!token || !estateId) return;
    const [propertiesData, documentsData] = await Promise.all([
      apiRequest(`/estates/${estateId}/properties`, {}, token),
      apiRequest(`/estates/${estateId}/properties/${propertyId}/documents`, {}, token).catch(() => ({ documents: [] })),
    ]);
    const found = arrayFrom(propertiesData, 'properties').find((item) => String(item.id) === String(propertyId));
    setProperty(found || null);
    if (found) {
      setEditForm({
        propertyIdentifier: found.propertyIdentifier || '',
        plotNumber: found.plotNumber || '',
        propertyType: found.propertyType || '',
        plotSize: found.plotSize || '',
        price: String(found.price ?? ''),
        description: found.description || '',
      });
    }
    setDocuments(arrayFrom(documentsData, 'documents'));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estateId, propertyId]);

  async function transitionTo(nextStatus) {
    setError('');
    setMessage('');
    setIsBusy(true);
    try {
      await apiRequest(
        `/estates/${estateId}/properties/${propertyId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) },
        token,
      );
      setMessage(`Status updated to ${labelize(nextStatus)}.`);
      await loadAll();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveFields(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!confirmEdit) {
      setError('Check the confirmation box to save field changes — this is a deliberate extra step for editing listed plot details.');
      return;
    }

    setIsBusy(true);
    try {
      await apiRequest(
        `/estates/${estateId}/properties/${propertyId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            propertyIdentifier: editForm.propertyIdentifier,
            plotNumber: editForm.plotNumber,
            propertyType: editForm.propertyType,
            plotSize: editForm.plotSize,
            price: Number(editForm.price || 0),
            description: editForm.description,
            confirm: true,
          }),
        },
        token,
      );
      setMessage('Plot details updated.');
      setConfirmEdit(false);
      await loadAll();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadPhotos() {
    if (!newPhotos.length) return;
    setError('');
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.append('category', 'image');
      newPhotos.forEach((photo) => formData.append('files', photo.file, photo.file.name));
      await apiRequest(`/estates/${estateId}/properties/${propertyId}/documents/upload`, { method: 'POST', body: formData }, token);
      setNewPhotos([]);
      setMessage('Photos added.');
      await loadAll();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadDeed() {
    if (!deedFile) return;
    setError('');
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.append('category', 'deed_of_assignment');
      formData.append('files', deedFile);
      await apiRequest(`/estates/${estateId}/properties/${propertyId}/documents/upload`, { method: 'POST', body: formData }, token);
      setDeedFile(null);
      setMessage('Deed of Assignment delivered to the buyer.');
      await loadAll();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsBusy(false);
    }
  }

  if (status !== 'ready' || !property || !editForm) return null;

  const nextStatuses = STATUS_TRANSITIONS[property.status] || [];

  return (
    <DashboardShell title="Plots" subtitle={property.propertyIdentifier || property.plotNumber || `Plot #${propertyId}`}>
      {error ? <div className={styles.loginError}>{error}</div> : null}
      {message ? <div className={styles.credentialBanner}><strong>{message}</strong></div> : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Edit Plot Details</h2><p>Changing listed details (especially price) after buyers may have seen the plot requires explicit confirmation and is always logged to the audit trail.</p></div>
          <Pill>{propertyStatusLabel(property.status)}</Pill>
        </div>
        <form className={styles.managerForm} onSubmit={handleSaveFields}>
          <div className={styles.formGrid}>
            <label><span>Property identifier</span><input required value={editForm.propertyIdentifier} onChange={(event) => setEditForm((current) => ({ ...current, propertyIdentifier: event.target.value }))} /></label>
            <label><span>Plot number</span><input value={editForm.plotNumber} onChange={(event) => setEditForm((current) => ({ ...current, plotNumber: event.target.value }))} /></label>
            <label><span>Property type</span><input required value={editForm.propertyType} onChange={(event) => setEditForm((current) => ({ ...current, propertyType: event.target.value }))} /></label>
            <label><span>Plot size</span><input value={editForm.plotSize} onChange={(event) => setEditForm((current) => ({ ...current, plotSize: event.target.value }))} /></label>
            <label><span>Price (₦)</span><input inputMode="numeric" required value={editForm.price} onChange={(event) => setEditForm((current) => ({ ...current, price: event.target.value }))} /></label>
          </div>
          <label><span>Description</span><input value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className={styles.checkRow}>
            <input checked={confirmEdit} onChange={(event) => setConfirmEdit(event.target.checked)} type="checkbox" />
            <span>I understand this change is permanent and will be recorded in the audit log.</span>
          </label>
          <ActionButton icon={Save} tone="positive" type="submit" disabled={isBusy || !confirmEdit}>
            {isBusy ? 'Saving...' : 'Save plot details'}
          </ActionButton>
        </form>
      </section>

      <section className={styles.detailPanel}>
        <div className={styles.panelHeader}>
          <div><h2>Status Lifecycle</h2><p>Update the lifecycle status as buyers reserve or purchase this plot.</p></div>
        </div>

        {nextStatuses.length ? (
          <div className={styles.commandStack}>
            {nextStatuses.map((nextStatus) => (
              <ActionButton key={nextStatus} icon={CheckCircle2} tone={nextStatus === 'sold' || nextStatus === 'allocated' ? 'positive' : 'neutral'} disabled={isBusy} onClick={() => transitionTo(nextStatus)}>
                Mark as {propertyStatusLabel(nextStatus)}
              </ActionButton>
            ))}
          </div>
        ) : (
          <p className={styles.cameraHint}>This plot has reached a final status.</p>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Plot Photos & Documents</h2><p>All photos are live camera captures — add more from here as the plot changes.</p></div>
          <Camera size={20} />
        </div>
        <DocumentCards documents={documents} token={token} kind="property" emptyText="No photos or documents uploaded for this plot yet." />
        <CameraCapture photos={newPhotos} onChange={setNewPhotos} />
        {newPhotos.length ? (
          <ActionButton icon={Camera} tone="positive" disabled={isBusy} onClick={uploadPhotos}>Upload captured photos</ActionButton>
        ) : null}
      </section>

      {['sold', 'allocated'].includes(property.status) ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Deed of Assignment</h2><p>Once uploaded, this is delivered to the buyer through their Purchases tab — it is the only structural document buyers ever get access to.</p></div>
            <FileCheck size={20} />
          </div>
          <input onChange={(event) => setDeedFile(event.target.files?.[0] || null)} type="file" accept=".pdf,image/png,image/jpeg" />
          <ActionButton icon={FileCheck} tone="positive" disabled={isBusy || !deedFile} onClick={uploadDeed}>
            {isBusy ? 'Uploading...' : 'Deliver Deed of Assignment'}
          </ActionButton>
        </section>
      ) : (
        <p className={styles.cameraHint}>The Deed of Assignment can be uploaded once this plot is marked Sold or Allocated.</p>
      )}
    </DashboardShell>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense fallback={null}>
      <PropertyDetail />
    </Suspense>
  );
}
