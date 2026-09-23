import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SavedListingsScreen } from '../screens/dashboard/SavedListingsScreen';
import { ListingDetailScreen } from '../screens/dashboard/ListingDetailScreen';
import { ReportIssueScreen } from '../screens/resident/ReportIssueScreen';

const Stack = createNativeStackNavigator();

export function SavedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Saved" component={SavedListingsScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
    </Stack.Navigator>
  );
}
