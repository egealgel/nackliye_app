import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Updates from 'expo-updates';

type Props = {
  children: React.ReactNode;
  onToast?: (msg: string) => void;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    try {
      // Avoid crashing due to logging failures
      console.error('Unhandled error:', error);
    } catch {
      // ignore
    }
  }

  private handleRetry = async () => {
    try {
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
        return;
      }
    } catch {
      // ignore
    }
    // Fallback: reset boundary state
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.safe}>
        <View style={styles.center}>
          <Image
            source={require('@/assets/icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={styles.title}>Bir hata oluştu</Text>
          <Text style={styles.subtitle}>Lütfen uygulamayı yeniden başlatın.</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  button: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});

