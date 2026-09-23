import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SaleTag02Icon } from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { TextField } from '../../components/TextField';
import { createAllocation, createBuyer, createReservation, createSale, fetchBuyers, fetchSales } from '../../api/sales';
import { initializeSalePayment, verifySalePayment } from '../../api/payments';
import { spacing, colors } from '../../theme';

export function SalesScreen() {
  const [estateId, setEstateId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [latest, setLatest] = useState(null);
  const [salesCount, setSalesCount] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);

  async function handleCreateBuyer() {
    try {
      const data = await createBuyer(estateId, {
        fullName: buyerName,
        phone: 'Pending',
      });
      setBuyerId(String(data.buyer.id));
      setLatest({ label: 'Buyer created', value: data.buyer.fullName, tone: 'success' });
    } catch (error) {
      Alert.alert('Buyer', error.message);
    }
  }

  async function handleReserve() {
    try {
      const data = await createReservation(estateId, {
        propertyId,
        buyerId,
        note: 'Reserved from mobile Phase 5 workflow.',
      });
      setLatest({ label: 'Reservation created', value: `#${data.reservation.id}`, tone: 'warning' });
    } catch (error) {
      Alert.alert('Reservation', error.message);
    }
  }

  async function handleSale() {
    try {
      const data = await createSale(estateId, {
        propertyId,
        buyerId,
        salePrice: Number(salePrice) || 0,
        paymentStatus: 'pending',
        note: 'Sale recorded from mobile Phase 5 workflow.',
      });
      setSaleId(String(data.sale.id));
      setLatest({ label: 'Sale recorded', value: `#${data.sale.id}`, tone: 'danger' });
    } catch (error) {
      Alert.alert('Sale', error.message);
    }
  }

  async function handleInitializePayment() {
    try {
      const data = await initializeSalePayment(saleId);
      setPaymentReference(data.reference);
      setPaymentStatus('initialized');
      setLatest({ label: 'Payment initialized', value: data.reference, tone: 'info' });
      if (data.authorizationUrl) {
        await Linking.openURL(data.authorizationUrl);
      }
    } catch (error) {
      Alert.alert('Payment', error.message);
    }
  }

  async function handleVerifyPayment() {
    try {
      const data = await verifySalePayment(paymentReference);
      setPaymentStatus(data.transaction.status);
      setLatest({ label: 'Payment status', value: data.transaction.status, tone: data.transaction.status === 'success' ? 'success' : 'warning' });
    } catch (error) {
      Alert.alert('Payment', error.message);
    }
  }

  async function handleAllocation() {
    try {
      const data = await createAllocation(estateId, {
        propertyId,
        buyerId,
        saleId: saleId || undefined,
        allocationReference: `ALLOC-${Date.now()}`,
        note: 'Allocation recorded from mobile Phase 5 workflow.',
      });
      setLatest({ label: 'Allocation recorded', value: data.allocation.allocationReference, tone: 'neutral' });
    } catch (error) {
      Alert.alert('Allocation', error.message);
    }
  }

  async function handleLoadSummary() {
    try {
      const [buyersData, salesData] = await Promise.all([fetchBuyers(estateId), fetchSales(estateId)]);
      setSalesCount(salesData.sales.length);
      setLatest({ label: 'Records loaded', value: `${buyersData.buyers.length} buyers`, tone: 'info' });
    } catch (error) {
      Alert.alert('Sales records', error.message);
    }
  }

  const canUseEstate = Boolean(estateId);
  const canUsePropertyBuyer = Boolean(estateId && propertyId && buyerId);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="title">Sales workflow</AppText>
            <AppText muted>Create buyers, reservations, sales, and allocation records for an estate property.</AppText>
            {latest ? <StatusChip label={`${latest.label}: ${latest.value}`} tone={latest.tone} /> : null}
          </View>

          <View style={styles.card}>
            <TextField label="Estate ID" keyboardType="number-pad" placeholder="e.g. 1" value={estateId} onChangeText={setEstateId} />
            <TextField label="Property ID" keyboardType="number-pad" placeholder="e.g. 42" value={propertyId} onChangeText={setPropertyId} />
            <TextField label="Buyer name" placeholder="e.g. Kemi Adewale" value={buyerName} onChangeText={setBuyerName} />
            <TextField label="Buyer ID" keyboardType="number-pad" placeholder="Created buyer ID or existing buyer ID" value={buyerId} onChangeText={setBuyerId} />
            <TextField label="Sale price (₦)" keyboardType="number-pad" placeholder="e.g. 5000000" value={salePrice} onChangeText={setSalePrice} />
            <TextField label="Sale ID" keyboardType="number-pad" placeholder="Optional sale ID for allocation" value={saleId} onChangeText={setSaleId} />
          </View>

          <View style={styles.actions}>
            <Button disabled={!canUseEstate || !buyerName} icon={SaleTag02Icon} title="Create buyer" onPress={handleCreateBuyer} />
            <Button disabled={!canUsePropertyBuyer} title="Reserve property" variant="secondary" onPress={handleReserve} />
            <Button disabled={!canUsePropertyBuyer || !salePrice} title="Record sale" variant="secondary" onPress={handleSale} />
            <Button disabled={!canUsePropertyBuyer} title="Record allocation" variant="secondary" onPress={handleAllocation} />
            <Button disabled={!canUseEstate} title="Load estate sales summary" variant="secondary" onPress={handleLoadSummary} />
          </View>

          <View style={styles.card}>
            <AppText variant="heading">Collect payment (Paystack)</AppText>
            <AppText muted>Initializes a Paystack checkout. Buyer charges and seller commission are calculated automatically.</AppText>
            <Button disabled={!saleId} title="Initialize payment" onPress={handleInitializePayment} />
            {paymentReference ? (
              <>
                <AppText muted>Reference: {paymentReference}</AppText>
                {paymentStatus ? <StatusChip label={`Status: ${paymentStatus}`} tone={paymentStatus === 'success' ? 'success' : 'warning'} /> : null}
                <Button variant="secondary" title="Check payment status" onPress={handleVerifyPayment} />
              </>
            ) : null}
          </View>

          {salesCount !== null ? (
            <View style={styles.summary}>
              <AppText variant="heading">{salesCount}</AppText>
              <AppText muted>sales records for this estate</AppText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 140,
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
  actions: {
    gap: spacing.md,
  },
  summary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
});
