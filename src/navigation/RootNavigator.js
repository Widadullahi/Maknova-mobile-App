import { NavigationContainer } from '@react-navigation/native';
import { useState } from 'react';
import { AuthNavigator } from './AuthNavigator';
import { RoleNavigator } from './RoleNavigator';
import { BootScreen } from '../screens/auth/BootScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { RestrictedScreen } from '../screens/auth/RestrictedScreen';
import { ACCOUNT_STATUSES } from '../constants/statuses';
import { useAuth } from '../context/AuthContext';

export function RootNavigator() {
  const { isAuthenticated, isBooting, user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(true);

  if (isBooting) {
    return <BootScreen />;
  }

  if (isAuthenticated && [ACCOUNT_STATUSES.SUSPENDED, ACCOUNT_STATUSES.REJECTED].includes(user?.accountStatus)) {
    return <RestrictedScreen />;
  }

  return (
    <NavigationContainer>
      {showOnboarding && !isAuthenticated ? (
        <OnboardingScreen onDone={() => setShowOnboarding(false)} />
      ) : isAuthenticated ? (
        <RoleNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
