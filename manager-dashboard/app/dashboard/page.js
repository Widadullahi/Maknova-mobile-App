'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, Hammer, Home, TicketCheck, Users } from 'lucide-react';
import { apiRequest, arrayFrom } from '../../lib/api';
import { useManagerSession } from '../../lib/auth';
import { DashboardShell } from '../../components/DashboardShell';
import { MetricCard } from '../../components/MetricCard';
import styles from '../../components/dashboard.module.css';

export default function OverviewPage() {
  const { token, status } = useManagerSession();
  const [data, setData] = useState({ estates: [], properties: [], residents: [], maintenance: [], visitors: [] });

  useEffect(() => {
    if (!token) return;
    apiRequest('/estates', {}, token)
      .then(async (estateData) => {
        const estates = arrayFrom(estateData, 'estates');
        const scoped = await Promise.all(
          estates.map((estate) =>
            Promise.all([
              apiRequest(`/estates/${estate.id}/properties`, {}, token).then((res) => arrayFrom(res, 'properties')).catch(() => []),
              apiRequest(`/estates/${estate.id}/residents`, {}, token).then((res) => arrayFrom(res, 'residents')).catch(() => []),
            ]),
          ),
        );
        const [maintenance, visitors] = await Promise.all([
          apiRequest('/maintenance/requests', {}, token).then((res) => arrayFrom(res, 'requests', 'maintenanceRequests')).catch(() => []),
          apiRequest('/visitor-passes', {}, token).then((res) => arrayFrom(res, 'passes', 'visitorPasses')).catch(() => []),
        ]);
        setData({
          estates,
          properties: scoped.flatMap(([properties]) => properties),
          residents: scoped.flatMap(([, residents]) => residents),
          maintenance,
          visitors,
        });
      })
      .catch(() => {});
  }, [token]);

  const metrics = useMemo(() => {
    const available = data.properties.filter((item) => item.status === 'available').length;
    const sold = data.properties.filter((item) => ['sold', 'allocated'].includes(item.status)).length;
    const openMaintenance = data.maintenance.filter((item) => !['resolved', 'closed'].includes(item.status)).length;

    return [
      { label: 'Estates', value: data.estates.length, trend: 'Managed by you', tone: 'success', icon: Building2 },
      { label: 'Plots', value: data.properties.length, trend: `${available} available`, tone: 'info', icon: Home },
      { label: 'Sold / Allocated', value: sold, trend: 'Completed transactions', tone: 'success', icon: CreditCard },
      { label: 'Residents', value: data.residents.length, trend: 'Across your estates', tone: 'info', icon: Users },
      { label: 'Maintenance open', value: openMaintenance, trend: `${data.maintenance.length} total tickets`, tone: 'warning', icon: Hammer },
      { label: 'Visitor passes', value: data.visitors.length, trend: 'Issued to residents', tone: 'info', icon: TicketCheck },
    ];
  }, [data]);

  if (status !== 'ready') return null;

  return (
    <DashboardShell title="Overview" subtitle="Your estate management workspace, connected to live backend data.">
      <section className={styles.metricGrid}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
    </DashboardShell>
  );
}
