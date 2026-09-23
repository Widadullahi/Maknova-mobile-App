import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, CheckmarkCircle02Icon, Clock01Icon, SearchIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { colors, spacing } from '../../theme';
import { useVisitorPasses } from '../../context/VisitorPassesContext';

export function VisitorLogScreen({ navigation }) {
  const { passes } = useVisitorPasses();
  const [query, setQuery] = useState('');

  const filtered = [...passes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((pass) => {
      if (!query.trim()) return true;
      const needle = query.trim().toLowerCase();
      return pass.visitorName.toLowerCase().includes(needle) || pass.code.toLowerCase().includes(needle);
    });

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Visitor log</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <TextField
        autoCapitalize="none"
        icon={SearchIcon}
        onChangeText={setQuery}
        placeholder="Search by visitor name or pass code"
        returnKeyType="search"
        style={styles.searchField}
        value={query}
      />

      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState icon={SearchIcon} title="No visitors found" body="Try a different name or pass code." />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <HugeiconsIcon
                icon={item.status === 'checked_in' ? CheckmarkCircle02Icon : Clock01Icon}
                size={18}
                color={item.status === 'checked_in' ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.cardCopy}>
              <AppText style={styles.name}>{item.visitorName}</AppText>
              <AppText muted style={styles.meta}>
                {item.code} · {item.purpose} · requested by {item.requestedBy}
              </AppText>
              <AppText muted style={styles.meta}>
                Expected {item.expectedDate} at {item.expectedTime}
              </AppText>
            </View>
            <StatusChip
              label={item.status === 'checked_in' ? 'Checked in' : 'Pending'}
              tone={item.status === 'checked_in' ? 'success' : 'warning'}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonSpacer: {
    width: 40,
  },
  searchField: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 140,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  meta: {
    fontSize: 11,
  },
  separator: {
    height: spacing.md,
  },
});
