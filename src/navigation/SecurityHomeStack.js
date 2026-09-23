import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SecurityHomeScreen } from '../screens/security/SecurityHomeScreen';
import { VerifyPassScreen } from '../screens/security/VerifyPassScreen';
import { VisitorLogScreen } from '../screens/security/VisitorLogScreen';
import { VisitorAnalyticsScreen } from '../screens/security/VisitorAnalyticsScreen';

const Stack = createNativeStackNavigator();

export function SecurityHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SecurityHome" component={SecurityHomeScreen} />
      <Stack.Screen name="VerifyPass" component={VerifyPassScreen} />
      <Stack.Screen name="VisitorLog" component={VisitorLogScreen} />
      <Stack.Screen name="VisitorAnalytics" component={VisitorAnalyticsScreen} />
    </Stack.Navigator>
  );
}
