import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import {
  BubbleChatIcon,
  Building05Icon,
  Home01Icon,
  SaleTag02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { AppTabBar } from './AppTabBar';
import { CommunicationStack } from './CommunicationStack';
import { HomeStack } from './HomeStack';
import { ProfileStack } from './ProfileStack';
import { EstatesScreen } from '../screens/estates/EstatesScreen';
import { PropertiesScreen } from '../screens/estates/PropertiesScreen';
import { SalesScreen } from '../screens/sales/SalesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export function EstateManagerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={({ route }) => ({
          tabBarIconRef: Home01Icon,
          tabBarAccessibilityLabel: 'Home',
          tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ListingDetail' ? { display: 'none' } : undefined,
        })}
      />
      <Tab.Screen
        name="EstatesStack"
        component={EstatesStack}
        options={{ tabBarIconRef: Building05Icon, tabBarAccessibilityLabel: 'Estates' }}
      />
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{ tabBarIconRef: SaleTag02Icon, tabBarAccessibilityLabel: 'Sales' }}
      />
      <Tab.Screen
        name="CommunicationStack"
        component={CommunicationStack}
        options={({ route }) => ({
          tabBarIconRef: BubbleChatIcon,
          tabBarAccessibilityLabel: 'Messages',
          tabBarStyle: getFocusedRouteNameFromRoute(route) && getFocusedRouteNameFromRoute(route) !== 'CommunicationHub'
            ? { display: 'none' }
            : undefined,
        })}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{ tabBarIconRef: UserIcon, tabBarAccessibilityLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function EstatesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Estates" component={EstatesScreen} />
      <Stack.Screen name="Properties" component={PropertiesScreen} />
    </Stack.Navigator>
  );
}
