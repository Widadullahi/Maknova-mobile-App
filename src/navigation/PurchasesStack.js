import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyPurchasesScreen } from '../screens/dashboard/MyPurchasesScreen';
import { ListingDetailScreen } from '../screens/dashboard/ListingDetailScreen';
import { PurchaseDetailScreen } from '../screens/dashboard/PurchaseDetailScreen';
import { ReportIssueScreen } from '../screens/resident/ReportIssueScreen';

const Stack = createNativeStackNavigator();

export function PurchasesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Purchases" component={MyPurchasesScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
    </Stack.Navigator>
  );
}
