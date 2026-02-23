import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUnreadCount } from '@/lib/UnreadCountContext';

function CreateTabIcon() {
  return (
    <View style={styles.createButton}>
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </View>
  );
}

const MessageBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
};

export default function TabLayout() {
  const { count: unreadCount } = useUnreadCount();

  return (
    <Tabs
      initialRouteName="rooms"
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { flex: 1 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F0F0',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          paddingHorizontal: 8,
        },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#1A1A1A',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Odalar',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: 'İşlerim',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="clipboard-text-outline" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: '',
          headerShown: false,
          tabBarIcon: () => <CreateTabIcon />,
          tabBarLabel: () => null,
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="chatbubbles" size={26} color={color} />
              <MessageBadge count={unreadCount} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
