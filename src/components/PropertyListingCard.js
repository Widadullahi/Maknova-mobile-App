import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  RulerIcon,
  DocumentValidationIcon,
  FavouriteIcon,
  PinLocation01Icon,
  Call02Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from './AppText';
import { StatusChip } from './StatusChip';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONES } from '../constants/propertyStatuses';
import { formatNaira } from '../utils/format';
import { colors, spacing } from '../theme';

export function PropertyListingCard({ listing, onPress, onContact, isSaved, onToggleSave }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <ImageBackground source={listing.image} style={styles.image} imageStyle={styles.imageStyle}>
        <View style={styles.imageTopRow}>
          <StatusChip
            label={PROPERTY_STATUS_LABELS[listing.status] || 'Available'}
            tone={PROPERTY_STATUS_TONES[listing.status] || 'success'}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save listing'}
            hitSlop={8}
            onPress={onToggleSave}
            style={styles.saveButton}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              size={18}
              color={isSaved ? colors.primary : colors.surface}
            />
          </Pressable>
        </View>

        {listing.verified ? (
          <View style={styles.verifiedBadge}>
            <AppText style={styles.verifiedText}>Verified</AppText>
          </View>
        ) : null}
      </ImageBackground>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <AppText style={styles.price}>{formatNaira(listing.price)}</AppText>
        </View>

        <AppText style={styles.title}>{listing.plotNumber}, {listing.estateName}</AppText>

        <View style={styles.locationRow}>
          <HugeiconsIcon icon={PinLocation01Icon} size={14} color={colors.textMuted} />
          <AppText muted style={styles.locationText}>{listing.location}</AppText>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <HugeiconsIcon icon={RulerIcon} size={16} color={colors.textMuted} />
            <AppText muted style={styles.metaText}>{listing.plotSizeSqm} sqm</AppText>
          </View>
          <View style={styles.metaItem}>
            <HugeiconsIcon icon={DocumentValidationIcon} size={16} color={colors.textMuted} />
            <AppText muted style={styles.metaText}>{listing.titleType}</AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contact about this listing"
            hitSlop={8}
            onPress={onContact}
            style={styles.contactButton}
          >
            <HugeiconsIcon icon={Call02Icon} size={16} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.92,
  },
  image: {
    height: 170,
    justifyContent: 'space-between',
  },
  imageStyle: {
    resizeMode: 'cover',
  },
  imageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 12, 0.5)',
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    margin: spacing.md,
    marginTop: 0,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(10, 10, 12, 0.5)',
  },
  verifiedText: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    color: colors.primary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 18,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  locationText: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 12,
  },
  contactButton: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
