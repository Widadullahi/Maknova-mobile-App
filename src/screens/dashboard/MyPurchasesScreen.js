import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { ShoppingBag01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { PropertyListingCard } from '../../components/PropertyListingCard';
import { useAuth } from '../../context/AuthContext';
import { useSavedListings } from '../../context/SavedListingsContext';
import { usePropertyDeals } from '../../context/PropertyDealsContext';
import { spacing } from '../../theme';

export function MyPurchasesScreen({ navigation }) {
  const { user } = useAuth();
  const { getMyPurchases } = usePropertyDeals();
  const { isSaved, toggleSaved } = useSavedListings();
  const purchases = getMyPurchases(user);

  function handleContact(listing) {
    Alert.alert(listing.plotNumber, `Contact request sent for ${listing.estateName}.`);
  }

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={purchases}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">My purchases</AppText>
            <AppText muted>
              Properties sold or allocated to you, with deeds and forms from your estate manager.
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={ShoppingBag01Icon}
            title="No purchases yet"
            body="Once a property is marked sold or allocated to you, it will appear here with its documents."
          />
        }
        renderItem={({ item }) => (
          <PropertyListingCard
            isSaved={isSaved(item.id)}
            listing={item}
            onContact={() => handleContact(item)}
            onPress={() => navigation.navigate('PurchaseDetail', { listing: item })}
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
