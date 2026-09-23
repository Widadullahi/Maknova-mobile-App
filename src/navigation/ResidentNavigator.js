import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { BubbleChatIcon, Home01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { AppTabBar } from './AppTabBar';
import { CommunicationStack } from './CommunicationStack';
import { ProfileStack } from './ProfileStack';
import { ResidentHomeStack } from './ResidentHomeStack';

const Tab = createBottomTabNavigator();

export function ResidentNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tab.Screen
        name="Home"
        component={ResidentHomeStack}
        options={({ route }) => ({
          tabBarIconRef: Home01Icon,
          tabBarAccessibilityLabel: 'Home',
          tabBarStyle: getFocusedRouteNameFromRoute(route) && getFocusedRouteNameFromRoute(route) !== 'ResidentHome'
            ? { display: 'none' }
            : undefined,
        })}
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
