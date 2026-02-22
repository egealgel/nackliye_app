import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { clearPushToken } from '@/services/notifications';

type Profile = {
  id: string;
  name: string;
  phone: string;
  city: string;
  vehicle_type: string | null;
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
        .select('id, name, phone, city, vehicle_type')
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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user?.id) {
          return fetchProfile(session.user.id);
        }
      })
      .catch(() => {
        setSession(null);
        setProfile(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
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
