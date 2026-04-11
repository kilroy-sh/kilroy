import { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../lib/auth-client';

interface User { id: string; email: string; name: string; }
interface Account { id: string; slug: string; display_name: string; }
interface AuthState {
  loading: boolean;
  user: User | null;
  account: Account | null;
  signIn: (provider: 'github' | 'google', callbackURL?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/account', { credentials: 'include' });
      if (!res.ok) { setAccount(null); return; }
      const data = await res.json();
      setAccount(data.has_account ? data.account : null);
    } catch { setAccount(null); }
  };

  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session?.data?.user) {
        setUser({ id: session.data.user.id, email: session.data.user.email!, name: session.data.user.name });
        fetchAccount().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  const signIn = async (provider: 'github' | 'google', callbackURL?: string) => {
    await authClient.signIn.social({ provider, callbackURL: callbackURL || '/' });
  };
  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setAccount(null);
  };

  return (
    <AuthContext.Provider value={{ loading, user, account, signIn, signOut, refreshAccount: fetchAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within AuthProvider');
  return ctx;
}
