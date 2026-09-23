import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowDownLeft01Icon,
  ArrowLeft02Icon,
  ArrowUpRight01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { fetchMyWallet, initializeWalletTopup, verifyWalletTopup } from '../../api/wallet';
import { formatNaira } from '../../utils/format';
import { colors, spacing } from '../../theme';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

const TRANSACTION_LABELS = {
  topup: 'Wallet top-up',
  guest_pass_fee: 'Guest pass fee',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

export function WalletScreen({ navigation }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [guestPassFee, setGuestPassFee] = useState(null);
  const [amount, setAmount] = useState('');
  const [pendingReference, setPendingReference] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyWallet();
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
      setGuestPassFee(data.guestPassFee);
    } catch (error) {
      Alert.alert('Wallet', error.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleTopUp() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Top up wallet', 'Enter a valid amount.');
      return;
    }
    setIsBusy(true);
    try {
      const data = await initializeWalletTopup(numericAmount);
      setPendingReference(data.reference);
      Alert.alert(
        'Top-up initialized',
        `You'll pay ₦${numericAmount.toLocaleString()}. ₦${data.feeAmount.toLocaleString()} platform fee is deducted, so ₦${data.netAmount.toLocaleString()} will be credited to your wallet once payment completes.`,
      );
      if (data.authorizationUrl) {
        await Linking.openURL(data.authorizationUrl);
      }
    } catch (error) {
      Alert.alert('Top up wallet', error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckStatus() {
    if (!pendingReference) return;
    setIsBusy(true);
    try {
      const data = await verifyWalletTopup(pendingReference);
      if (data.transaction.status === 'success') {
        setPendingReference(null);
        setAmount('');
        Alert.alert('Top-up complete', `₦${data.transaction.netAmount.toLocaleString()} has been credited to your wallet.`);
      } else {
        Alert.alert('Payment status', `Status: ${data.transaction.status}`);
      }
      await load();
    } catch (error) {
      Alert.alert('Check status', error.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Visitor Wallet</AppText>
        <View style={styles.backButtonSpacer} />
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.balanceCard}>
              <View style={styles.balanceIconWrap}>
                <HugeiconsIcon icon={Wallet01Icon} size={24} color={colors.primary} />
              </View>
              <AppText muted style={styles.balanceLabel}>Wallet balance</AppText>
              <AppText style={styles.balanceValue}>{formatNaira(wallet?.balance || 0)}</AppText>
              {guestPassFee != null ? (
                <AppText muted style={styles.feeHint}>Each guest pass costs {formatNaira(guestPassFee)} from this wallet.</AppText>
              ) : null}
            </View>

            <View style={styles.topUpCard}>
              <AppText variant="heading">Top up wallet</AppText>
              <AppText muted style={styles.feeHint}>A 2% platform processing fee applies to every top-up.</AppText>
              <View style={styles.quickAmountRow}>
                {QUICK_AMOUNTS.map((value) => (
                  <Pressable key={value} onPress={() => setAmount(String(value))} style={styles.quickAmountChip}>
                    <AppText style={styles.quickAmountText}>₦{value.toLocaleString()}</AppText>
                  </Pressable>
                ))}
              </View>
              <TextField label="Amount (₦)" keyboardType="number-pad" value={amount} onChangeText={setAmount} placeholder="e.g. 5000" />
              <Button title={isBusy ? 'Please wait...' : 'Top up via Paystack'} disabled={isBusy} onPress={handleTopUp} />
              {pendingReference ? (
                <Button title="Check payment status" variant="secondary" disabled={isBusy} onPress={handleCheckStatus} />
              ) : null}
            </View>

            <AppText variant="heading" style={styles.historyHeading}>Transaction history</AppText>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Wallet01Icon} title="No transactions yet" body="Top-ups and guest pass fees will appear here." />}
        renderItem={({ item }) => {
          const isCredit = item.netAmount >= 0;
          return (
            <View style={styles.transactionRow}>
              <View style={[styles.transactionIconWrap, isCredit ? styles.creditIconWrap : styles.debitIconWrap]}>
                <HugeiconsIcon icon={isCredit ? ArrowDownLeft01Icon : ArrowUpRight01Icon} size={16} color={isCredit ? colors.success : colors.danger} />
              </View>
              <View style={styles.transactionCopy}>
                <AppText style={styles.transactionTitle}>{TRANSACTION_LABELS[item.type] || item.type}</AppText>
                <AppText muted style={styles.transactionMeta}>{item.status}</AppText>
              </View>
              <AppText style={[styles.transactionAmount, isCredit ? styles.creditText : styles.debitText]}>
                {isCredit ? '+' : ''}{formatNaira(item.netAmount)}
              </AppText>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  backButtonSpacer: { width: 40 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
    gap: spacing.md,
  },
  headerBlock: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  balanceCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  balanceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: 12,
  },
  balanceValue: {
    color: colors.primary,
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 30,
  },
  feeHint: {
    fontSize: 11,
    textAlign: 'center',
  },
  topUpCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAmountChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAmountText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  historyHeading: {
    marginTop: spacing.sm,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  transactionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditIconWrap: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  debitIconWrap: {
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  transactionCopy: {
    flex: 1,
    gap: 2,
  },
  transactionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  transactionMeta: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  transactionAmount: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 13,
  },
  creditText: {
    color: colors.success,
  },
  debitText: {
    color: colors.danger,
  },
});
