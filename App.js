import 'react-native-gesture-handler';
import { Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/dm-sans/useFonts';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans/800ExtraBold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SavedListingsProvider } from './src/context/SavedListingsContext';
import { FormSubmissionsProvider } from './src/context/FormSubmissionsContext';
import { VisitorPassesProvider } from './src/context/VisitorPassesContext';
import { PropertyDealsProvider } from './src/context/PropertyDealsContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { BootScreen } from './src/screens/auth/BootScreen';
import { AlertHost, showAlert } from './src/components/AlertPopup';

// react-native-web ships `Alert.alert` as a no-op, so error/success popups are
// invisible when previewing in a browser. Patch it on web only to render the
// app's styled AlertHost popup instead. Native keeps its own Alert behavior.
if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => showAlert(title, message, buttons);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <BootScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SavedListingsProvider>
          <FormSubmissionsProvider>
            <NotificationsProvider>
              <VisitorPassesProvider>
                <PropertyDealsProvider>
                  <RootNavigator />
                </PropertyDealsProvider>
              </VisitorPassesProvider>
            </NotificationsProvider>
          </FormSubmissionsProvider>
        </SavedListingsProvider>
      </AuthProvider>
      {Platform.OS === 'web' ? <AlertHost /> : null}
    </SafeAreaProvider>
  );
}
