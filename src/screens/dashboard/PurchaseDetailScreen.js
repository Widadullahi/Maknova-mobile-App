import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft02Icon, File01Icon, ShoppingBag01Icon, Wallet01Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { formatNaira } from '../../utils/format';
import { resolvePropertyDocumentUrl } from '../../utils/documentUrl';
import { fetchInstallmentPlan, initializeInstallmentPayment } from '../../api/payments';
import { colors, spacing } from '../../theme';

const DOCUMENT_LABELS = {
  image: 'Plot photo',
  deed_of_assignment: 'Deed of Assignment',
};

async function handleOpenDocument(doc) {
  try {
    const url = await resolvePropertyDocumentUrl(doc);
    if (!url) {
      Alert.alert(doc.fileName, 'This document is not available to view right now.');
      return;
    }
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Could not open document', error.message);
  }
}

const INSTALLMENT_TONES = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger',
  cancelled: 'neutral',
};

const NOTE_LABELS = {
  1: '1st installment',
  2: '2nd installment',
  3: '3rd installment',
  4: '4th installment',
};

function installmentLabel(installment, index) {
  return NOTE_LABELS[String(index + 1)] || `Installment ${index + 1}`;
}

function formatDueDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PurchaseDetailScreen({ route, navigation }) {
  const listing = route.params?.listing;
  const saleId = listing?.saleId || listing?.id;
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(Boolean(saleId));
  const [planError, setPlanError] = useState(null);
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    if (!saleId) {
      setPlanLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInstallmentPlan(saleId);
        if (!cancelled) setPlan(data.plan || null);
      } catch (error) {
        if (!cancelled) {
          setPlanError(error.message);
          setPlan(null);
        }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const installments = plan?.installments || [];
  const payable = installments.filter((item) => item.status === 'pending' || item.status === 'overdue');
  const totalPaid = plan?.progress?.paidAmount || 0;
  const totalAmount = plan?.totalAmount || listing?.price || 0;
  const paidCount = plan?.progress?.paidCount || 0;
  const totalCount = plan?.progress?.totalCount || 0;

  async function handlePayInstallment(installment) {
    setPayingId(installment.id);
    try {
      const data = await initializeInstallmentPayment(installment.id);
      if (data.authorizationUrl) {
        await Linking.openURL(data.authorizationUrl);
      } else {
        Alert.alert('Payment', 'Payment could not be initialized. Please try again.');
      }
    } catch (error) {
      Alert.alert('Payment', error.message);
    } finally {
      setPayingId(null);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Purchase detail</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={ShoppingBag01Icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.titleCopy}>
              <AppText style={styles.title}>{listing?.plotNumber}, {listing?.estateName}</AppText>
              <AppText muted style={styles.meta}>{listing?.location}</AppText>
            </View>
            <StatusChip label={listing?.status || 'sold'} tone="success" />
          </View>
          <View style={styles.amountRow}>
            <View>
              <AppText muted style={styles.meta}>Purchase price</AppText>
              <AppText style={styles.amount}>{formatNaira(totalAmount)}</AppText>
            </View>
            <View>
              <AppText muted style={styles.meta}>Installments paid</AppText>
              <AppText style={styles.amount}>{formatNaira(totalPaid)}</AppText>
            </View>
          </View>
          {totalAmount > 0 ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${totalCount ? Math.min(100, (paidCount / totalCount) * 100) : 0}%` }]} />
              </View>
              <AppText muted style={styles.meta}>
                {paidCount} of {totalCount} installments paid
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <AppText variant="heading">Installment schedule</AppText>
          {planLoading ? <AppText muted>Loading your payment plan...</AppText> : null}
          {!planLoading && planError ? <AppText muted>Could not load your plan. {planError}</AppText> : null}
          {!planLoading && !planError && !plan ? (
            <AppText muted>No installment plan has been set up for this purchase yet.</AppText>
          ) : null}
          {!planLoading && plan ? (
            <>
              {installments.map((item, index) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowCopy}>
                    <AppText style={styles.rowTitle}>{installmentLabel(item, index)}</AppText>
                    <AppText muted style={styles.meta}>{formatDueDate(item.dueDate)}</AppText>
                  </View>
                  <AppText style={styles.rowAmount}>{formatNaira(item.amount)}</AppText>
                  <StatusChip label={item.status} tone={INSTALLMENT_TONES[item.status] || 'info'} />
                </View>
              ))}
              {payable.length ? (
                <Button
                  icon={Wallet01Icon}
                  title={payingId ? 'Opening checkout...' : 'Pay due installment'}
                  disabled={Boolean(payingId)}
                  onPress={() => handlePayInstallment(payable[0])}
                />
              ) : (
                <AppText muted>This installment plan is fully paid.</AppText>
              )}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <AppText variant="heading">Receipts and documents</AppText>
          {(listing?.documents || []).map((doc) => (
            <Pressable key={doc.id} style={styles.documentRow} onPress={() => handleOpenDocument(doc)}>
              <View style={styles.iconWrapSmall}>
                <HugeiconsIcon icon={File01Icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <AppText style={styles.rowTitle}>{DOCUMENT_LABELS[doc.category] || doc.category}</AppText>
                <AppText muted style={styles.meta}>{doc.fileName}</AppText>
              </View>
            </Pressable>
          ))}
          {!listing?.documents?.length ? <AppText muted>No documents have been uploaded for this purchase yet.</AppText> : null}
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
  card: { gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  iconWrapSmall: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  titleCopy: { flex: 1, gap: 3 },
  title: { fontFamily: 'DMSans_800ExtraBold', fontSize: 17 },
  meta: { fontSize: 11 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  amount: { color: colors.primary, fontFamily: 'DMSans_800ExtraBold', fontSize: 18 },
  progressBlock: { gap: spacing.xs, marginTop: spacing.xs },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  rowAmount: { fontFamily: 'DMSans_800ExtraBold', fontSize: 13 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md },
});