'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest, arrayFrom } from '../../../lib/api';
import { formatNaira, labelize } from '../../../lib/format';
import { useAdminSession } from '../../../lib/auth';
import { useResource } from '../../../lib/useResource';
import { DashboardShell } from '../../../components/DashboardShell';
import { DataTable } from '../../../components/DataTable';
import { MetricCard } from '../../../components/MetricCard';
import { Banknote, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { EmptyState } from '../../../components/EmptyState';
import styles from '../../../components/dashboard.module.css';

export default function PaymentsPage() {
  const { token, status, isSuperAdmin } = useAdminSession();
  const { data } = useResource('/payments', token, { enabled: status === 'ready' && isSuperAdmin });
  const [summary, setSummary] = useState(null);
  const [commissionSummary, setCommissionSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    apiRequest('/payments/summary', {}, token).then((result) => setSummary(result.summary)).catch(() => setSummary(null));
  }, [token, isSuperAdmin]);

  useEffect(() => {
    if (!token || !isSuperAdmin) return;
    apiRequest('/payments/commission-summary', {}, token).then((result) => setCommissionSummary(result.summary)).catch(() => setCommissionSummary(null));
    apiRequest('/payments/transactions', {}, token).then((result) => setTransactions(arrayFrom(result, 'transactions'))).catch(() => setTransactions([]));
  }, [token, isSuperAdmin]);

  const payments = useMemo(
    () =>
      arrayFrom(data, 'payments').map((item) => ({
        id: item.id,
        buyer: item.buyerName || `Buyer #${item.buyerId || '-'}`,
        estate: item.estateName || `Estate #${item.estateId || '-'}`,
        property: item.propertyIdentifier || `Property #${item.propertyId || '-'}`,
        amount: formatNaira(item.amount),
        status: labelize(item.paymentStatus || item.status),
      })),
    [data],
  );

  const metrics = summary
    ? [
        { label: 'Total collected value', value: summary.totalAmount, trend: `${summary.totalCount} sales records`, tone: 'success', icon: TrendingUp },
        { label: 'Paid', value: summary.byStatus?.find((row) => row.status === 'paid')?.count || 0, trend: 'Fully paid sales', tone: 'success', icon: Banknote },
        { label: 'Pending', value: summary.byStatus?.find((row) => row.status === 'pending')?.count || 0, trend: 'Awaiting payment', tone: 'warning', icon: CreditCard },
      ]
    : [];

  const commissionMetrics = commissionSummary
    ? [
        { label: 'Buyer-side platform revenue', value: commissionSummary.totalBuyerFeeRevenue, trend: 'Included in buyer final payments', tone: 'success', icon: Wallet },
        { label: 'Seller-side commission', value: commissionSummary.totalSellerCommission, trend: 'Estate-company commission', tone: 'success', icon: Wallet },
        { label: 'Gross collected via Paystack', value: commissionSummary.totalGrossCollected, trend: 'Successful transactions only', tone: 'info', icon: TrendingUp },
      ]
    : [];

  const transactionRows = useMemo(
    () =>
      transactions.map((item) => ({
        id: item.id,
        reference: item.reference,
        estate: item.estateName || `Estate #${item.estateId || '-'}`,
        buyer: item.buyerName || `Buyer #${item.buyerId || '-'}`,
        amount: formatNaira(item.amount),
        buyerFee: formatNaira(item.buyerFeeAmount),
        sellerCommission: formatNaira(item.sellerCommissionAmount),
        status: labelize(item.status),
      })),
    [transactions],
  );

  if (status !== 'ready') return null;

  if (!isSuperAdmin) {
    return (
      <DashboardShell title="Payments" subtitle="Review Paystack transactions and sales payment state.">
        <EmptyState title="Master Owner access required" body="Financial data and settings are Master Owner-only. Staff accounts are scoped to Verification and Support." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Payments" subtitle="Review Paystack transactions and sales payment state (platform commission applies automatically).">
      {metrics.length ? <section className={styles.metricGrid}>{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section> : null}
      <DataTable
        title="Payments"
        subtitle="Payment-state records derived from sales, updated by Paystack initialize/verify/webhook."
        columns={[
          { key: 'buyer', label: 'Buyer' },
          { key: 'estate', label: 'Estate' },
          { key: 'property', label: 'Property' },
          { key: 'amount', label: 'Amount' },
          { key: 'status', label: 'Status', pill: true },
        ]}
        rows={payments}
        emptyTitle="No payment records"
        emptyBody="Recorded sales with payment status will appear here."
      />

      {isSuperAdmin ? (
        <>
          <div className={styles.loginFooterNote}>Raw transaction and commission data below is visible to the Master Owner only.</div>
          {commissionMetrics.length ? <section className={styles.metricGrid}>{commissionMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section> : null}
          <DataTable
            title="Paystack Transaction Ledger"
            subtitle="Every initialize/verify/webhook-recorded transaction, with commission earned per transaction."
            columns={[
              { key: 'reference', label: 'Reference' },
              { key: 'estate', label: 'Estate' },
              { key: 'buyer', label: 'Buyer' },
              { key: 'amount', label: 'Amount' },
              { key: 'buyerFee', label: 'Buyer platform revenue' },
              { key: 'sellerCommission', label: 'Seller commission' },
              { key: 'status', label: 'Status', pill: true },
            ]}
            rows={transactionRows}
            emptyTitle="No transactions yet"
            emptyBody="Paystack transactions initialized from the mobile app or manager dashboard will appear here."
          />
        </>
      ) : null}
    </DashboardShell>
  );
}
