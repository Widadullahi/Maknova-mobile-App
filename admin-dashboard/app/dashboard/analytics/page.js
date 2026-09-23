'use client';

import { useMemo } from 'react';
import { AlertTriangle, Building2, CreditCard, Home, Users, Wrench } from 'lucide-react';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { MetricCard } from '../../../components/MetricCard';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function AnalyticsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data } = useResource('/analytics/summary', token, { enabled: status === 'ready' && isSuperAdmin });
  const summary = data?.summary || {};

  const metrics = useMemo(
    () => [
      { label: 'Users', value: summary.users, trend: 'Total platform accounts', tone: 'info', icon: Users },
      { label: 'Estates', value: summary.estates, trend: 'Across all managers', tone: 'success', icon: Building2 },
      { label: 'Properties', value: summary.properties, trend: `${summary.availableProperties || 0} available`, tone: 'success', icon: Home },
      { label: 'Sold plots', value: summary.soldProperties, trend: `${summary.allocatedProperties || 0} allocated`, tone: 'warning', icon: CreditCard },
      { label: 'Reports', value: summary.estateReports, trend: 'Public reporting volume', tone: 'danger', icon: AlertTriangle },
      { label: 'Maintenance open', value: summary.maintenanceOpen, trend: 'Active tickets', tone: 'warning', icon: Wrench },
    ],
    [summary],
  );

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Analytics" subtitle="Inspect live aggregates from connected backend routes.">
        <EmptyState title="Master Owner access required" body="Staff accounts are scoped to Verification and Support only." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Analytics" subtitle="Inspect live aggregates from connected backend routes.">
      <section className={styles.metricGrid}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
    </DashboardShell>
  );
}
