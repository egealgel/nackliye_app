import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Merhaba, {profile?.name ?? 'Kullanıcı'}!
      </Text>
      <Text style={styles.subtitle}>Nackliye'ye hoş geldiniz</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
