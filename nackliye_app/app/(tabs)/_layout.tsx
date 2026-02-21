import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

const PRIMARY = '#FF6B35';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          borderTopColor: '#F3F4F6',
          backgroundColor: '#FFFFFF',
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'İlanlar',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Yük Oluştur',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.createButton,
                focused && styles.createButtonActive,
              ]}
            >
              <FontAwesome
                name="plus"
                size={22}
                color={focused ? '#FFFFFF' : PRIMARY}
              />
            </View>
          ),
          tabBarLabel: 'Oluştur',
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  createButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
});
