'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { labelize } from '../../../lib/format';
import { useManagerSession } from '../../../lib/auth';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import styles from '../../../components/dashboard.module.css';

export default function DocumentsPage() {
  const { token, status } = useManagerSession();
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token).then(async (estateData) => {
      const estates = arrayFrom(estateData, 'estates');
      const rows = [];
      for (const estate of estates) {
        const propertyData = await apiRequest(`/estates/${estate.id}/properties`, {}, token).catch(() => ({}));
        const properties = arrayFrom(propertyData, 'properties');
        for (const property of properties) {
          const docData = await apiRequest(`/estates/${estate.id}/properties/${property.id}/documents`, {}, token).catch(() => ({}));
          arrayFrom(docData, 'documents').forEach((doc) => {
            rows.push({
              id: doc.id,
              estate: estate.name,
              plot: property.propertyIdentifier || property.plotNumber,
              category: labelize(doc.category),
              fileName: doc.fileName,
            });
          });
        }
      }
      setDocuments(rows);
    });
  }, [token]);

  const rows = useMemo(() => documents, [documents]);

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Document Center" subtitle="Every photo and document uploaded against your plots, in one place.">
      <div className={styles.loginFooterNote}>
        Estate manager onboarding documents (title, survey plan, planning approval) live under the Verification tab —{' '}
        <Link href="/dashboard/verification">open Verification</Link>. This page covers plot-level photos and supporting
        documents only.
      </div>
      <DataTable
        title="Plot Documents & Photos"
        subtitle="Uploaded via each plot's detail page."
        columns={[
          { key: 'estate', label: 'Estate' },
          { key: 'plot', label: 'Plot' },
          { key: 'category', label: 'Category', pill: true },
          { key: 'fileName', label: 'File' },
        ]}
        rows={rows}
        emptyTitle="No documents yet"
        emptyBody="Photos and documents uploaded from a plot's detail page will appear here."
      />
    </DashboardShell>
  );
}
