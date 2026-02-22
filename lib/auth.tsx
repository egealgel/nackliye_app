import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { LogBox } from 'react-native';
import { supabase } from '@/services/supabase';
import { clearPushToken } from '@/services/notifications';

const INVALID_REFRESH_TOKEN_PATTERNS = [
  'Invalid Refresh Token',
  'Refresh Token Not Found',
  'refresh_token_not_found',
  'AuthApiError',
];

function isInvalidRefreshTokenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INVALID_REFRESH_TOKEN_PATTERNS.some((p) =>
    msg.toLowerCase().includes(p.toLowerCase())
  );
}

async function clearSessionSilently(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Ignore - we're clearing invalid session
  }
}

type Profile = {
  id: string;
  name: string;
  phone: string;
  city: string;
  vehicle_type: string | null;
  rating_avg: number | null;
  total_jobs: number | null;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  profileComplete: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  isLoading: true,
  profileComplete: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, phone, city, vehicle_type, rating_avg, total_jobs')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  };

  const signOut = async () => {
    if (session?.user?.id) {
      await clearPushToken(session.user.id);
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  useEffect(() => {
    LogBox.ignoreLogs([
      'AuthApiError',
      'Invalid Refresh Token',
      'Refresh Token Not Found',
    ]);

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user?.id) {
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          await clearSessionSilently();
        }
        setSession(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (event === 'SIGNED_OUT' && !session) {
          setSession(null);
          setProfile(null);
          return;
        }
        setSession(session);
        if (session?.user?.id) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        if (isInvalidRefreshTokenError(err)) {
          clearSessionSilently().then(() => {
            setSession(null);
            setProfile(null);
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const profileComplete = !!(
    profile &&
    profile.name &&
    profile.name !== 'User' &&
    profile.city
  );

  return (
    <AuthContext.Provider
      value={{ session, profile, isLoading, profileComplete, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
