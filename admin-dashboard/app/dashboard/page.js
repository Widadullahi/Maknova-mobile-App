'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  TicketCheck,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { apiRequest, arrayFrom } from '../../lib/api';
import { ageLabel, labelize } from '../../lib/format';
import { useAdminSession } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';
import { MetricCard } from '../../components/MetricCard';
import { DataTable } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import styles from '../../components/dashboard.module.css';

export default function OverviewPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const [data, setData] = useState({ applications: [], estates: [], reports: [], maintenance: [], visitors: [], users: [], forms: [] });
  const [loadStatus, setLoadStatus] = useState('idle');

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    setLoadStatus('loading');
    Promise.all([
      apiRequest('/admin/verification/applications', {}, token).catch(() => ({})),
      apiRequest('/estates', {}, token).catch(() => ({})),
      apiRequest('/reports', {}, token).catch(() => ({})),
      apiRequest('/maintenance/requests', {}, token).catch(() => ({})),
      apiRequest('/visitor-passes', {}, token).catch(() => ({})),
      apiRequest('/users', {}, token).catch(() => ({})),
      apiRequest('/forms/templates', {}, token).catch(() => ({})),
    ])
      .then(([applications, estates, reports, maintenance, visitors, users, forms]) => {
        setData({
          applications: arrayFrom(applications, 'applications'),
          estates: arrayFrom(estates, 'estates'),
          reports: arrayFrom(reports, 'reports'),
          maintenance: arrayFrom(maintenance, 'requests', 'maintenanceRequests'),
          visitors: arrayFrom(visitors, 'passes', 'visitorPasses'),
          users: arrayFrom(users, 'users'),
          forms: arrayFrom(forms, 'templates', 'forms'),
        });
        setLoadStatus('ready');
      })
      .catch(() => setLoadStatus('error'));
  }, [token, isSuperAdmin]);

  const applications = useMemo(
    () =>
      data.applications.map((item) => ({
        id: item.id,
        estate: item.estateName || 'Unnamed estate',
        manager: item.managerName || item.user?.fullName || 'Unknown manager',
        status: labelize(item.status),
        age: ageLabel(item.submittedAt || item.updatedAt || item.createdAt),
      })),
    [data.applications],
  );

  const metrics = useMemo(() => {
    const approvedApplications = data.applications.filter((item) => item.status === 'approved').length;
    const pendingApplications = data.applications.filter((item) => String(item.status || '').includes('pending')).length;
    const openReports = data.reports.filter((item) => !['closed', 'dismissed', 'resolved'].includes(String(item.status || '').toLowerCase())).length;
    const openMaintenance = data.maintenance.filter((item) => !['resolved', 'closed'].includes(String(item.status || '').toLowerCase())).length;
    const activeVisitors = data.visitors.filter((item) => ['checked_in', 'approved'].includes(String(item.status || '').toLowerCase())).length;

    return [
      { label: 'Estates', value: data.estates.length, trend: `${approvedApplications} approved applications`, tone: 'success', icon: ShieldCheck },
      { label: 'Pending reviews', value: pendingApplications, trend: `${data.applications.length} applications total`, tone: 'warning', icon: ClipboardCheck },
      { label: 'Open reports', value: openReports, trend: `${data.reports.length} reports loaded`, tone: 'danger', icon: AlertTriangle },
      { label: 'Maintenance open', value: openMaintenance, trend: `${data.maintenance.length} tickets loaded`, tone: 'warning', icon: Wrench },
      { label: 'Active visitors', value: activeVisitors, trend: `${data.visitors.length} passes loaded`, tone: 'info', icon: TicketCheck },
      { label: 'Users', value: data.users.length, trend: 'All platform accounts', tone: 'info', icon: Users },
      { label: 'Digital forms', value: data.forms.length, trend: 'Templates from backend', tone: 'success', icon: FileText },
    ];
  }, [data]);

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Overview" subtitle="Live control center for estates, users, reports, visitors, and maintenance.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification only. Only the Master Owner can view the platform overview." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Overview" subtitle="Live control center for estates, users, reports, visitors, and maintenance.">
      <div className={`${styles.backendNotice} ${loadStatus === 'ready' ? styles.successPill : loadStatus === 'error' ? styles.dangerPill : styles.warningPill}`}>
        {loadStatus === 'ready' ? 'Connected to backend' : loadStatus === 'error' ? 'Failed to load some records' : 'Loading backend records...'}
      </div>

      <section className={styles.metricGrid}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>

      <DataTable
        title="Verification Queue"
        subtitle="Live estate-manager applications awaiting review."
        columns={[
          { key: 'estate', label: 'Estate' },
          { key: 'manager', label: 'Manager' },
          { key: 'status', label: 'Status', pill: true },
          { key: 'age', label: 'Updated' },
        ]}
        rows={applications.slice(0, 8)}
        emptyTitle="No verification applications"
        emptyBody="Applications submitted from the mobile app will appear here."
        actions={
          <Link className={`${styles.actionButton}`} href="/dashboard/verification">
            <span>Open verification</span>
            <ArrowRight size={15} />
          </Link>
        }
      />
    </DashboardShell>
  );
}
