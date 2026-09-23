import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, CalendarCheckIn01Icon, SearchIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { fetchVisitorHistory } from '../../api/analytics';
import { colors, spacing } from '../../theme';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

const FILTERS = ['today', '7 days', '30 days'];

export function VisitorAnalyticsScreen({ navigation }) {
  const { passes } = useVisitorPasses();
  const [filter, setFilter] = useState('today');
  const [remote, setRemote] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchVisitorHistory();
        if (active) {
          setRemote(data);
          setLoadError(null);
        }
      } catch (err) {
        if (active) setLoadError(err.message || 'Using local visitor analytics.');
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const statusCounts = useMemo(() => {
    if (remote?.statuses?.length) {
      return remote.statuses.map((item) => ({ label: item.status, value: item.count }));
    }
    const counts = passes.reduce((acc, pass) => {
      acc[pass.status] = (acc[pass.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [passes, remote]);

  const total = statusCounts.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Visitor analytics</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filterRow}>
          {FILTERS.map((item) => (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
              <AppText style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</AppText>
            </Pressable>
          ))}
        </View>
        {loadError ? <AppText muted style={styles.notice}>{loadError}</AppText> : null}

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <HugeiconsIcon icon={CalendarCheckIn01Icon} size={20} color={colors.primary} />
            <AppText style={styles.metricValue}>{total}</AppText>
            <AppText muted style={styles.metricLabel}>Total passes</AppText>
          </View>
          <View style={styles.metricCard}>
            <HugeiconsIcon icon={SearchIcon} size={20} color={colors.warning} />
            <AppText style={styles.metricValue}>{statusCounts.find((item) => item.label === 'checked_in')?.value || 0}</AppText>
            <AppText muted style={styles.metricLabel}>Checked in</AppText>
          </View>
        </View>

        <View style={styles.card}>
          <AppText variant="heading">Status breakdown</AppText>
          {statusCounts.map((item) => {
            const width = `${Math.max(8, Math.round((Number(item.value || 0) / total) * 100))}%`;
            return (
              <View key={item.label} style={styles.chartRow}>
                <View style={styles.chartHeader}>
                  <AppText style={styles.chartLabel}>{String(item.label).replace(/_/g, ' ')}</AppText>
                  <AppText muted style={styles.chartValue}>{item.value}</AppText>
                </View>
                <View style={styles.track}>
                  <View style={[styles.bar, { width }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <AppText variant="heading">Purpose breakdown</AppText>
          {(remote?.purposes || [
            { purpose: 'Family', count: 12 },
            { purpose: 'Business', count: 8 },
            { purpose: 'Delivery', count: 5 },
          ]).map((item) => (
            <View key={item.purpose} style={styles.purposeRow}>
              <AppText style={styles.chartLabel}>{item.purpose}</AppText>
              <AppText muted>{item.count}</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md, marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backButtonSpacer: { width: 40 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  filterTextActive: { color: colors.onPrimary },
  notice: { fontSize: 12 },
  metricRow: { flexDirection: 'row', gap: spacing.md },
  metricCard: { flex: 1, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.lg },
  metricValue: { fontFamily: 'DMSans_800ExtraBold', fontSize: 24 },
  metricLabel: { fontSize: 12 },
  card: { gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: spacing.lg },
  chartRow: { gap: spacing.xs },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  chartLabel: { fontFamily: 'DMSans_700Bold', fontSize: 13, textTransform: 'capitalize' },
  chartValue: { fontSize: 12 },
  track: { height: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceMuted },
  bar: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  purposeRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
});
