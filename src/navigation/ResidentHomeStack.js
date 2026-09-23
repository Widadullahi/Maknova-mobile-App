import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ResidentHomeScreen } from '../screens/resident/ResidentHomeScreen';
import { RequestVisitorEntryScreen } from '../screens/resident/RequestVisitorEntryScreen';
import { BookMaintenanceScreen } from '../screens/resident/BookMaintenanceScreen';
import { MaintenanceDetailScreen } from '../screens/resident/MaintenanceDetailScreen';
import { MaintenanceRequestsScreen } from '../screens/resident/MaintenanceRequestsScreen';
import { ReportIssueScreen } from '../screens/resident/ReportIssueScreen';

const Stack = createNativeStackNavigator();

export function ResidentHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ResidentHome" component={ResidentHomeScreen} />
      <Stack.Screen name="RequestVisitorEntry" component={RequestVisitorEntryScreen} />
      <Stack.Screen name="BookMaintenance" component={BookMaintenanceScreen} />
      <Stack.Screen name="MaintenanceRequests" component={MaintenanceRequestsScreen} />
      <Stack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
    </Stack.Navigator>
  );
}
