import { useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Alert02Icon,
  ArrowLeft02Icon,
  Building05Icon,
  Call02Icon,
  DocumentValidationIcon,
  FavouriteIcon,
  File01Icon,
  FileUploadIcon,
  HashtagIcon,
  Message01Icon,
  PinLocation01Icon,
  RulerIcon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { StatusChip } from '../../components/StatusChip';
import { formatNaira } from '../../utils/format';
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_TONES } from '../../constants/propertyStatuses';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useSavedListings } from '../../context/SavedListingsContext';
import { usePropertyDeals } from '../../context/PropertyDealsContext';

export function ListingDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { listingId } = route.params;
  const { user } = useAuth();
  const { getListing, getNextStatuses, updateStatus, addDocument, canViewDocuments } = usePropertyDeals();
  const { isSaved, toggleSaved } = useSavedListings();
  const [isBusy, setIsBusy] = useState(false);

  const listing = getListing(listingId);

  if (!listing) {
    return (
      <View style={styles.notFound}>
        <AppText variant="heading">Listing not found</AppText>
        <Button onPress={() => navigation.goBack()} title="Go back" variant="secondary" />
      </View>
    );
  }

  const saved = isSaved(listing.id);
  const isManager = ['estate_manager', 'admin', 'super_admin'].includes(user?.role);
  const nextStatuses = getNextStatuses(listing.id);
  const showDocuments = canViewDocuments(listing, user);

  function handleContact() {
    Alert.alert(listing.plotNumber, `Contact request sent for ${listing.estateName}.`);
  }

  async function handleStatusChange(nextStatus) {
    try {
      setIsBusy(true);
      await updateStatus(listing.id, nextStatus);
      Alert.alert('Status updated', `${listing.plotNumber} is now ${PROPERTY_STATUS_LABELS[nextStatus]}.`);
    } catch (error) {
      Alert.alert('Status update failed', error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadDocument(category) {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setIsBusy(true);
    try {
      await addDocument(listing.id, {
        category: 'other',
        assets: [asset],
      });
      Alert.alert('Document added', `${category} uploaded for ${listing.plotNumber}.`);
    } catch (error) {
      Alert.alert('Document upload failed', error.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ImageBackground source={listing.image} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={[styles.heroTopRow, { paddingTop: Math.max(insets.top, spacing.md) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={() => navigation.goBack()}
              style={styles.heroButton}
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save listing'}
              hitSlop={8}
              onPress={() => toggleSaved(listing.id)}
              style={styles.heroButton}
            >
              <HugeiconsIcon icon={FavouriteIcon} size={20} color={saved ? colors.primary : colors.text} />
            </Pressable>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <AppText style={styles.price}>{formatNaira(listing.price)}</AppText>
              <AppText style={styles.title}>{listing.plotNumber}, {listing.estateName}</AppText>
            </View>
            <StatusChip
              label={PROPERTY_STATUS_LABELS[listing.status] || 'For Sale'}
              tone={PROPERTY_STATUS_TONES[listing.status] || 'success'}
            />
          </View>

          <View style={styles.metaRow}>
            <HugeiconsIcon icon={PinLocation01Icon} size={15} color={colors.textMuted} />
            <AppText muted>{listing.location}</AppText>
          </View>

          <View style={styles.metaRow}>
            <HugeiconsIcon icon={Building05Icon} size={15} color={colors.textMuted} />
            <AppText muted>{listing.propertyType}</AppText>
            {listing.verified ? <StatusChip label="Verified" tone="info" /> : null}
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <HugeiconsIcon icon={RulerIcon} size={20} color={colors.primary} />
              <AppText style={styles.statValue}>{listing.plotSizeSqm}</AppText>
              <AppText muted style={styles.statLabel}>Sqm</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <HugeiconsIcon icon={HashtagIcon} size={20} color={colors.primary} />
              <AppText style={styles.statValue}>{listing.plotNumber.replace(/^Plot\s*/i, '')}</AppText>
              <AppText muted style={styles.statLabel}>Plot No.</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <HugeiconsIcon icon={DocumentValidationIcon} size={20} color={colors.primary} />
              <AppText style={styles.statValue} numberOfLines={1}>{listing.titleType}</AppText>
              <AppText muted style={styles.statLabel}>Title</AppText>
            </View>
          </View>

          <View style={styles.section}>
            <AppText variant="heading">About this listing</AppText>
            <AppText muted style={styles.description}>{listing.description}</AppText>
            {!isManager ? (
              <Button
                icon={Alert02Icon}
                onPress={() => navigation.navigate('ReportIssue', { listing })}
                title="Report this listing"
                variant="secondary"
              />
            ) : null}
          </View>

          {isManager ? (
            <View style={styles.managerCard}>
              <AppText variant="heading">Manage sale</AppText>
              {listing.buyerName ? (
                <View style={styles.buyerRow}>
                  <HugeiconsIcon icon={UserAdd01Icon} size={16} color={colors.primary} />
                  <AppText muted style={styles.buyerText}>Assigned to {listing.buyerName}</AppText>
                </View>
              ) : null}

              {nextStatuses.length ? (
                <View style={styles.statusButtonsRow}>
                  {nextStatuses.map((status) => (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      onPress={() => handleStatusChange(status)}
                      style={styles.statusButton}
                    >
                      <AppText style={styles.statusButtonText}>Mark {PROPERTY_STATUS_LABELS[status]}</AppText>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <AppText muted style={styles.noTransitions}>No further status changes available.</AppText>
              )}

              <View style={styles.uploadRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => handleUploadDocument('Deed of Assignment')}
                  style={styles.uploadButton}
                >
                  <HugeiconsIcon icon={FileUploadIcon} size={16} color={colors.primary} />
                  <AppText style={styles.uploadButtonText}>Upload Deed</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={() => handleUploadDocument('Sale Agreement')}
                  style={styles.uploadButton}
                >
                  <HugeiconsIcon icon={FileUploadIcon} size={16} color={colors.primary} />
                  <AppText style={styles.uploadButtonText}>Upload Form</AppText>
                </Pressable>
              </View>

              {listing.documents.length ? (
                <View style={styles.docList}>
                  {listing.documents.map((doc) => (
                    <View key={doc.id} style={styles.docRow}>
                      <HugeiconsIcon icon={File01Icon} size={14} color={colors.textMuted} />
                      <AppText muted style={styles.docText} numberOfLines={1}>{doc.category}: {doc.fileName}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {showDocuments ? (
            <View style={styles.section}>
              <AppText variant="heading">Documents</AppText>
              <AppText muted style={styles.docsIntro}>
                These were uploaded by your estate manager now that this property is {PROPERTY_STATUS_LABELS[listing.status].toLowerCase()}.
              </AppText>
              {listing.documents.length ? (
                listing.documents.map((doc) => (
                  <Pressable
                    key={doc.id}
                    accessibilityRole="button"
                    onPress={() => Alert.alert(doc.fileName, 'Opening documents will be connected once storage is configured.')}
                    style={styles.buyerDocRow}
                  >
                    <View style={styles.docIconWrap}>
                      <HugeiconsIcon icon={File01Icon} size={16} color={colors.primary} />
                    </View>
                    <View style={styles.docCopy}>
                      <AppText style={styles.docTitle}>{doc.category}</AppText>
                      <AppText muted style={styles.docSubtitle} numberOfLines={1}>{doc.fileName}</AppText>
                    </View>
                  </Pressable>
                ))
              ) : (
                <AppText muted>No documents uploaded yet.</AppText>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Message about this listing"
          onPress={() => Alert.alert(listing.plotNumber, 'Messaging will be connected once the messaging module ships.')}
          style={styles.iconButton}
        >
          <HugeiconsIcon icon={Message01Icon} size={20} color={colors.text} />
        </Pressable>
        <View style={styles.contactWrap}>
          <Button icon={Call02Icon} onPress={handleContact} title="Contact" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  hero: {
    height: 320,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 245, 247, 0.9)',
  },
  body: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  price: {
    color: colors.primary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
  },
  title: {
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: colors.border,
  },
  statValue: {
    color: colors.text,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 16,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  description: {
    lineHeight: 22,
  },
  managerCard: {
    gap: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    padding: spacing.lg,
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buyerText: {
    fontSize: 13,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusButtonText: {
    color: colors.primary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  noTransitions: {
    fontSize: 12,
  },
  uploadRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  uploadButtonText: {
    color: colors.text,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
  },
  docList: {
    gap: spacing.xs,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  docText: {
    flex: 1,
    fontSize: 12,
  },
  docsIntro: {
    fontSize: 12,
  },
  buyerDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  docIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCopy: {
    flex: 1,
    gap: 2,
  },
  docTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  docSubtitle: {
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactWrap: {
    flex: 1,
  },
});
