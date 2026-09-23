import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { fetchMyVerificationApplication } from '../api/verification';
import { colors, spacing } from '../theme';
import { EstateManagerNavigator } from './EstateManagerNavigator';
import { VerificationStatusScreen } from '../screens/verification/VerificationStatusScreen';
import { VerificationWizardScreen } from '../screens/verification/VerificationWizardScreen';

const VerificationStack = createNativeStackNavigator();

function VerificationOnlyNavigator() {
  return (
    <VerificationStack.Navigator screenOptions={{ headerShown: false }}>
      <VerificationStack.Screen name="Verification" component={VerificationStatusScreen} />
      <VerificationStack.Screen name="VerificationWizard" component={VerificationWizardScreen} />
    </VerificationStack.Navigator>
  );
}

export function EstateManagerVerificationGate() {
  const [state, setState] = useState({ isLoading: true, isApproved: false });

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchMyVerificationApplication();
      setState({
        isLoading: false,
        isApproved: data.application?.status === 'approved',
      });
    } catch {
      setState({ isLoading: false, isApproved: false });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadFocusedStatus() {
        try {
          const data = await fetchMyVerificationApplication();
          if (mounted) {
            setState({
              isLoading: false,
              isApproved: data.application?.status === 'approved',
            });
          }
        } catch {
          if (mounted) {
            setState({ isLoading: false, isApproved: false });
          }
        }
      }

      loadFocusedStatus();

      return () => {
        mounted = false;
      };
    }, [])
  );

  useEffect(() => {
    if (state.isApproved) return undefined;
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [loadStatus, state.isApproved]);

  if (state.isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText muted>Checking manager verification...</AppText>
        </View>
      </Screen>
    );
  }

  if (!state.isApproved) {
    return <VerificationOnlyNavigator />;
  }

  return <EstateManagerNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
