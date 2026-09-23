import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Alert02Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  DocumentValidationIcon,
  Logout03Icon,
} from '@hugeicons/core-free-icons';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { StatusChip } from '../../components/StatusChip';
import { fetchMyVerificationApplication } from '../../api/verification';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme';

const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral', icon: DocumentValidationIcon },
  pending_review: { label: 'Pending review', tone: 'info', icon: Clock01Icon },
  approved: { label: 'Approved', tone: 'success', icon: CheckmarkBadge01Icon },
  rejected: { label: 'Rejected', tone: 'danger', icon: Alert02Icon },
  additional_info_required: { label: 'More info needed', tone: 'warning', icon: Alert02Icon },
};

export function VerificationStatusScreen({ navigation }) {
  const { logout, user } = useAuth();
  const isIndividualSeller = user?.role === 'buyer' || user?.role === 'public_user';
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function load() {
        setIsLoading(true);
        try {
          const data = await fetchMyVerificationApplication();
          if (mounted) {
            setApplication(data.application);
          }
        } catch (error) {
          if (mounted) {
            Alert.alert('Verification', error.message);
          }
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      }

      load();

      return () => {
        mounted = false;
      };
    }, [])
  );

  function openWizard() {
    navigation.navigate('VerificationWizard', { application });
  }

  function openMyProperty() {
    navigation.navigate('MyProperty');
  }

  const meta = application ? STATUS_META[application.status] : null;
  const canEdit = !application || ['draft', 'additional_info_required', 'rejected'].includes(application.status);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">{isIndividualSeller ? 'Property verification' : 'Estate verification'}</AppText>
        <AppText muted>
          {isIndividualSeller
            ? 'Your property must be reviewed and approved before it can be listed for sale.'
            : 'Every estate must be reviewed and approved before its plots can be published.'}
        </AppText>
      </View>

      <View style={styles.card}>
        {isLoading ? (
          <AppText muted>Checking your application status...</AppText>
        ) : !application ? (
          <NotStartedState onStart={openWizard} onLogout={logout} isIndividualSeller={isIndividualSeller} />
        ) : (
          <View style={styles.statusBlock}>
            <View style={styles.statusIconWrap}>
              <HugeiconsIcon icon={meta.icon} size={26} color={colors.primary} />
            </View>
            <StatusChip label={meta.label} tone={meta.tone} />
            <AppText style={styles.estateName}>{application.estateName}</AppText>
            <AppText muted style={styles.estateLocation}>{application.estateLocation}</AppText>

            {application.status === 'pending_review' ? (
              <AppText muted style={styles.helperText}>
                Your application is with an admin for review. You will be notified once a decision is made.
              </AppText>
            ) : null}

            {application.status === 'approved' ? (
              <AppText muted style={styles.helperText}>
                {isIndividualSeller
                  ? 'Your property is approved. Manage your listing and photos below.'
                  : 'Your estate is approved. Head to the Estates tab to start publishing plots.'}
              </AppText>
            ) : null}

            {(application.status === 'rejected' || application.status === 'additional_info_required') && application.adminNote ? (
              <View style={styles.noteBox}>
                <AppText style={styles.noteLabel}>Reviewer note</AppText>
                <AppText muted>{application.adminNote}</AppText>
              </View>
            ) : null}

            {application.status === 'approved' && isIndividualSeller ? (
              <Button onPress={openMyProperty} title="Manage my listing" />
            ) : null}
            {canEdit ? (
              <Button
                onPress={openWizard}
                title={application.status === 'draft' ? 'Continue application' : 'Resubmit application'}
              />
            ) : null}
            <Button icon={Logout03Icon} onPress={logout} title="Sign out" variant="secondary" />
          </View>
        )}
      </View>
    </Screen>
  );
}

function NotStartedState({ onStart, onLogout, isIndividualSeller }) {
  return (
    <View style={styles.statusBlock}>
      <View style={styles.statusIconWrap}>
        <HugeiconsIcon icon={DocumentValidationIcon} size={26} color={colors.primary} />
      </View>
      <AppText variant="heading">You haven't started yet</AppText>
      <AppText muted style={styles.helperText}>
        {isIndividualSeller
          ? 'Start your verification application to list your property for sale.'
          : 'Start your estate verification application to begin onboarding your estate and publishing plots.'}
      </AppText>
      <Button onPress={onStart} title="Start application" />
      <Button icon={Logout03Icon} onPress={onLogout} title="Sign out" variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  statusBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  estateName: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 18,
    marginTop: spacing.sm,
  },
  estateLocation: {
    fontSize: 13,
  },
  helperText: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  noteBox: {
    width: '100%',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  noteLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
});
