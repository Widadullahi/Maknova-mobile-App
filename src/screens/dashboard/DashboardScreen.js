import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowDown01Icon,
  Search01Icon,
  FilterIcon,
  Logout03Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { PropertyListingCard } from '../../components/PropertyListingCard';
import { EmptyState } from '../../components/EmptyState';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useSavedListings } from '../../context/SavedListingsContext';
import { usePropertyDeals } from '../../context/PropertyDealsContext';

const LISTING_FILTERS = ['All', 'Verified', 'Available'];

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function filterListings(listings, filter, query) {
  let result = listings;

  if (filter === 'Verified') {
    result = result.filter((item) => item.verified);
  } else if (filter === 'Available') {
    result = result.filter((item) => item.status === 'available');
  }

  if (query.trim()) {
    const needle = query.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.plotNumber.toLowerCase().includes(needle) ||
        item.location.toLowerCase().includes(needle) ||
        item.estateName.toLowerCase().includes(needle)
    );
  }

  return result;
}

export function DashboardScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { isSaved, toggleSaved } = useSavedListings();
  const { listings: allListings } = usePropertyDeals();
  const [activeFilter, setActiveFilter] = useState(LISTING_FILTERS[0]);
  const [query, setQuery] = useState('');

  const listings = useMemo(
    () => filterListings(allListings, activeFilter, query),
    [allListings, activeFilter, query]
  );

  function handleContact(listing) {
    Alert.alert(listing.plotNumber, `Contact request sent for ${listing.estateName}.`);
  }

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={listings}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" style={styles.locationBlock}>
                <AppText muted style={styles.locationLabel}>Location</AppText>
                <View style={styles.locationValueRow}>
                  <AppText style={styles.locationValue}>Lagos, Nigeria</AppText>
                  <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={colors.text} />
                </View>
              </Pressable>

              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  onPress={logout}
                  style={styles.logoutButton}
                >
                  <HugeiconsIcon icon={Logout03Icon} size={18} color={colors.primary} />
                </Pressable>
                <View style={styles.avatar}>
                  <AppText style={styles.avatarText}>{getInitials(user?.fullName)}</AppText>
                </View>
              </View>
            </View>

            <View style={styles.searchRow}>
              <TextField
                autoCapitalize="none"
                icon={Search01Icon}
                onChangeText={setQuery}
                placeholder="Search estate, plot number, or location"
                returnKeyType="search"
                style={styles.searchField}
                value={query}
              />
              <Pressable accessibilityRole="button" style={styles.filterButton}>
                <HugeiconsIcon icon={FilterIcon} size={18} color={colors.onPrimary} />
              </Pressable>
            </View>

            <FlatList
              contentContainerStyle={styles.filterList}
              data={LISTING_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === activeFilter;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setActiveFilter(item)}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                  >
                    <AppText style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                      {item}
                    </AppText>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Search01Icon}
            title="No listings match"
            body="Try a different filter or clear your search."
          />
        }
        renderItem={({ item }) => (
          <PropertyListingCard
            isSaved={isSaved(item.id)}
            listing={item}
            onContact={() => handleContact(item)}
            onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
            onToggleSave={() => toggleSaved(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationBlock: {
    gap: 2,
  },
  locationLabel: {
    fontSize: 12,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationValue: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 18,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatarText: {
    color: colors.onPrimary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 15,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  filterList: {
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  filterChipTextSelected: {
    color: colors.onPrimary,
  },
  separator: {
    height: spacing.lg,
  },
});
