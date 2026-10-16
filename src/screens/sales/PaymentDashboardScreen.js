import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PaymentSuccess01Icon } from '@hugeicons/core-free-icons';
import { fetchPaymentSummary } from '../../api/payments';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { formatNaira } from '../../utils/format';
import { colors, spacing } from '../../theme';

const STATUS_TONES = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
};

function statusTone(status) {
  return STATUS_TONES[String(status).toLowerCase()] || 'info';
}

// The mobile payment dashboard the audit flagged as missing: fetchPaymentSummary()
// existed in src/api/payments.js but nothing ever rendered it. Backed by
// GET /payments/summary, which now also returns a 6-month trend and a per-estate
// distribution, both scoped to the caller's estate access.
export function PaymentDashboardScreen() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPaymentSummary();
      setSummary(data.summary || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxMonthlyAmount = Math.max(1, ...(summary?.monthly || []).map((row) => row.amount));
  const maxEstateAmount = Math.max(1, ...(summary?.byEstate || []).map((row) => row.amount));

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={colors.text} />}
      >
        <View style={styles.header}>
          <AppText variant="title">Payment dashboard</AppText>
          <AppText muted>Collected sales, monthly trend, and estate distribution.</AppText>
          <Button title="Refresh" icon={PaymentSuccess01Icon} variant="secondary" onPress={load} />
          {error ? <StatusChip label={error} tone="danger" /> : null}
        </View>

        {summary ? (
          <>
            <View style={styles.card}>
              <AppText variant="heading">{formatNaira(summary.totalAmount)}</AppText>
              <AppText muted>Total recorded across {summary.totalCount} sale(s)</AppText>
            </View>

            <View style={styles.card}>
              <AppText variant="heading">By payment status</AppText>
              {(summary.byStatus || []).length ? (
                summary.byStatus.map((row) => (
                  <View key={row.status} style={styles.row}>
                    <StatusChip label={row.status} tone={statusTone(row.status)} />
                    <AppText muted>
                      {row.count} · {formatNaira(row.amount)}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText muted>No sales recorded yet.</AppText>
              )}
            </View>

            <View style={styles.card}>
              <AppText variant="heading">Last 6 months (paid)</AppText>
              {(summary.monthly || []).map((row) => (
                <View key={row.month} style={styles.barRow}>
                  <AppText variant="small" style={styles.barLabel}>
                    {row.month}
                  </AppText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round((row.amount / maxMonthlyAmount) * 100)}%` },
                      ]}
                    />
                  </View>
                  <AppText variant="small" style={styles.barValue}>
                    {formatNaira(row.amount)}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <AppText variant="heading">By estate</AppText>
              {(summary.byEstate || []).length ? (
                summary.byEstate.map((row) => (
                  <View key={row.estateId} style={styles.barRow}>
                    <AppText variant="small" style={[styles.barLabel, styles.estateLabel]} numberOfLines={1}>
                      {row.estateName}
                    </AppText>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFillEstate,
                          { width: `${Math.round((row.amount / maxEstateAmount) * 100)}%` },
                        ]}
                      />
                    </View>
                    <AppText variant="small" style={styles.barValue}>
                      {formatNaira(row.amount)}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText muted>No paid sales yet.</AppText>
              )}
            </View>
          </>
        ) : !isLoading ? (
          <View style={styles.card}>
            <AppText muted>Could not load the payment summary. Pull down to retry.</AppText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 60,
  },
  header: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    width: 64,
    color: colors.textMuted,
  },
  estateLabel: {
    width: 110,
    flexShrink: 1,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  barFillEstate: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  barValue: {
    width: 92,
    textAlign: 'right',
    color: colors.textMuted,
  },
});
