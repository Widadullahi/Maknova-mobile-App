import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommunicationHubScreen } from '../screens/communication/CommunicationHubScreen';
import { ChatScreen } from '../screens/communication/ChatScreen';
import { NewMessageScreen } from '../screens/communication/NewMessageScreen';
import { CreateAnnouncementScreen } from '../screens/communication/CreateAnnouncementScreen';

const Stack = createNativeStackNavigator();

export function CommunicationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunicationHub" component={CommunicationHubScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} />
      <Stack.Screen name="CreateAnnouncement" component={CreateAnnouncementScreen} />
    </Stack.Navigator>
  );
}
