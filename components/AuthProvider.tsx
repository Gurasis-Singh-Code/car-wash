'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isConfigured: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      // If Supabase credentials aren't configured yet, mark loading as false
      // This allows the app to render gracefully while displaying setup instructions
      setIsLoading(false);
      return;
    }

    const authClient = (supabase as any).auth;
    if (!authClient) {
      setIsLoading(false);
      return;
    }

    // Get current session
    authClient.getSession?.().then(({ data }: any) => {
      const currentSession = data?.session ?? null;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: authListener } = authClient.onAuthStateChange?.((_event: string, session: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, [configured]);

  // Route protection check: redirect unauthenticated visits on `/` and `/admin` to `/login`
  useEffect(() => {
    if (isLoading) return;

    // If Supabase is configured and user is not logged in and not already on /login
    if (configured && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isLoading, pathname, configured, router]);

  const signIn = async (email: string, password: string) => {
    if (!configured) {
      return {
        error: new Error('Supabase is not configured yet. Please add your credentials to .env.local.'),
      };
    }

    const authClient = (supabase as any).auth;
    const { error } = await authClient.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    router.push('/');
    return { error: null };
  };

  const signOut = async () => {
    if (configured) {
      const authClient = (supabase as any).auth;
      await authClient.signOut?.();
    }
    setUser(null);
    setSession(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured: configured,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
