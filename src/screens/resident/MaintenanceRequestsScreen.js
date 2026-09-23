import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, Clock01Icon, Wrench01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { fetchMaintenanceRequests } from '../../api/maintenance';
import { colors, spacing } from '../../theme';

const FILTERS = ['all', 'open', 'assigned', 'in_progress', 'resolved', 'closed'];

function statusLabel(status) {
  return String(status || 'open').replace(/_/g, ' ');
}

export function MaintenanceRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setIsLoading(true);
        const data = await fetchMaintenanceRequests();
        if (active) {
          setRequests(data.requests || []);
          setLoadError(null);
        }
      } catch (err) {
        if (active) {
          setRequests([]);
          setLoadError(err.message || 'Unable to load maintenance requests.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => (
    filter === 'all' ? requests : requests.filter((item) => item.status === filter)
  ), [filter, requests]);

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Maintenance</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <AppText style={[styles.filterText, filter === item && styles.filterTextActive]}>{statusLabel(item)}</AppText>
          </Pressable>
        ))}
      </View>

      {loadError ? <AppText muted style={styles.notice}>{loadError}</AppText> : null}
      {isLoading ? <AppText muted style={styles.notice}>Loading maintenance requests...</AppText> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<EmptyState icon={Wrench01Icon} title="No requests here" body="Requests matching this filter will appear here." />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('MaintenanceDetail', { request: item })}
            style={styles.card}
          >
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={Wrench01Icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <AppText style={styles.title}>{item.title}</AppText>
              <AppText muted style={styles.meta}>{item.category} / {item.priority} priority</AppText>
              <View style={styles.timelineHint}>
                <HugeiconsIcon icon={Clock01Icon} size={13} color={colors.textMuted} />
                <AppText muted style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently opened'}</AppText>
              </View>
            </View>
            <StatusChip label={statusLabel(item.status)} tone={item.status === 'resolved' || item.status === 'closed' ? 'success' : 'warning'} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md, marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backButtonSpacer: { width: 40 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontFamily: 'DMSans_700Bold', fontSize: 12, textTransform: 'capitalize' },
  filterTextActive: { color: colors.onPrimary },
  notice: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm, fontSize: 12 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 140 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.md },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, gap: 3 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  meta: { fontSize: 11, textTransform: 'capitalize' },
  timelineHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  separator: { height: spacing.md },
});
