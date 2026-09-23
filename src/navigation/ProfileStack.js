import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileDetailsScreen } from '../screens/profile/ProfileDetailsScreen';
import { VerificationStatusScreen } from '../screens/verification/VerificationStatusScreen';
import { VerificationWizardScreen } from '../screens/verification/VerificationWizardScreen';
import { FormsScreen } from '../screens/forms/FormsScreen';
import { FormFillScreen } from '../screens/forms/FormFillScreen';
import { ResidentsScreen } from '../screens/residents/ResidentsScreen';
import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen';
import { MyPropertyScreen } from '../screens/sell/MyPropertyScreen';
import { WalletScreen } from '../screens/wallet/WalletScreen';

const Stack = createNativeStackNavigator();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="Verification" component={VerificationStatusScreen} />
      <Stack.Screen name="VerificationWizard" component={VerificationWizardScreen} />
      <Stack.Screen name="MyProperty" component={MyPropertyScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Forms" component={FormsScreen} />
      <Stack.Screen name="FormFill" component={FormFillScreen} />
      <Stack.Screen name="Residents" component={ResidentsScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
    </Stack.Navigator>
  );
}
