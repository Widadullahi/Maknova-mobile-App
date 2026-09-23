import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { FavouriteIcon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { PropertyListingCard } from '../../components/PropertyListingCard';
import { useSavedListings } from '../../context/SavedListingsContext';
import { usePropertyDeals } from '../../context/PropertyDealsContext';
import { spacing } from '../../theme';

export function SavedListingsScreen({ navigation }) {
  const { savedIds, isSaved, toggleSaved } = useSavedListings();
  const { listings } = usePropertyDeals();
  const savedListings = listings.filter((listing) => savedIds.includes(listing.id));

  function handleContact(listing) {
    Alert.alert(listing.plotNumber, `Contact request sent for ${listing.estateName}.`);
  }

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={savedListings}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">Saved listings</AppText>
            <AppText muted>Properties you have bookmarked for later.</AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={FavouriteIcon}
            title="No saved listings yet"
            body="Tap the heart icon on any listing to save it here."
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
    gap: spacing.xs,
  },
  separator: {
    height: spacing.lg,
  },
});
