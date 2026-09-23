import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { FavouriteIcon, Home01Icon, ShoppingBag01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { AppTabBar } from './AppTabBar';
import { HomeStack } from './HomeStack';
import { SavedStack } from './SavedStack';
import { PurchasesStack } from './PurchasesStack';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator();

function hideTabBarOnDetail(route) {
  const focusedRoute = getFocusedRouteNameFromRoute(route);
  return focusedRoute === 'ListingDetail' ? { display: 'none' } : undefined;
}

export function BuyerNavigator() {
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
          tabBarStyle: hideTabBarOnDetail(route),
        })}
      />
      <Tab.Screen
        name="SavedStack"
        component={SavedStack}
        options={({ route }) => ({
          tabBarIconRef: FavouriteIcon,
          tabBarAccessibilityLabel: 'Saved',
          tabBarStyle: hideTabBarOnDetail(route),
        })}
      />
      <Tab.Screen
        name="PurchasesStack"
        component={PurchasesStack}
        options={({ route }) => ({
          tabBarIconRef: ShoppingBag01Icon,
          tabBarAccessibilityLabel: 'Purchases',
          tabBarStyle: hideTabBarOnDetail(route),
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
