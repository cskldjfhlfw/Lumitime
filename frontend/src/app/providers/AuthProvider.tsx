import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loginApi, logoutApi, meApi, registerWithInviteApi, type BackendUser } from '../../shared/api/lumitimeApi';

type UserRole = 'invited' | 'admin';

interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
}

interface AuthState {
  isLoggedIn: boolean;
  isAdmin: boolean;
  isAuthReady: boolean;
  user: AuthUser | null;
  login: (admin: boolean, username?: string) => void;
  loginWithPassword: (username: string, password: string) => Promise<{ backend: boolean; redirectTo: string; message?: string }>;
  registerWithInvite: (body: { inviteCode: string; username: string; displayName: string; password: string }) => Promise<{ backend: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isAdmin: false,
  isAuthReady: false,
  user: null,
  login: () => {},
  loginWithPassword: async () => ({ backend: false, redirectTo: '/' }),
  registerWithInvite: async () => ({ backend: false }),
  logout: () => {},
});

const STORAGE_KEY = 'lumitime.auth';
const ENABLE_DEMO_AUTH = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true';

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed.username || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (ENABLE_DEMO_AUTH ? readStoredUser() : null));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const authVersionRef = useRef(0);

  const persistUser = (nextUser: AuthUser) => {
    authVersionRef.current += 1;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = (admin: boolean, username = admin ? 'admin' : 'member') => {
    const nextUser: AuthUser = {
      username,
      displayName: admin ? 'Admin' : username,
      role: admin ? 'admin' : 'invited',
    };
    persistUser(nextUser);
  };

  const loginWithPassword = async (username: string, password: string) => {
    try {
      const payload = await loginApi(username, password);
      persistUser(mapBackendUser(payload.data.user));
      return { backend: true, redirectTo: payload.data.redirect_to };
    } catch (error) {
      if (!ENABLE_DEMO_AUTH) throw error;
      const admin = username === 'admin' && password === 'admin';
      const invitedDemo = username.trim().length > 0 && password.trim().length > 0 && username !== 'wrong' && password !== 'wrong';
      if (!admin && !invitedDemo) throw error;
      login(admin, username.trim());
      return {
        backend: false,
        redirectTo: admin ? '/admin' : '/',
        message: error instanceof Error ? error.message : '后端不可用，已进入前端演示登录。',
      };
    }
  };

  const registerWithInvite = async (body: { inviteCode: string; username: string; displayName: string; password: string }) => {
    try {
      await registerWithInviteApi({
        invite_code: body.inviteCode,
        username: body.username,
        display_name: body.displayName,
        password: body.password,
      });
      await loginWithPassword(body.username, body.password);
      return { backend: true };
    } catch (error) {
      if (!ENABLE_DEMO_AUTH) throw error;
      login(false, body.username.trim());
      return {
        backend: false,
        message: error instanceof Error ? error.message : '后端不可用，已完成前端演示注册。',
      };
    }
  };

  const logout = () => {
    authVersionRef.current += 1;
    logoutApi().catch(() => {});
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  useEffect(() => {
    let mounted = true;
    const authVersion = authVersionRef.current;
    meApi()
      .then(payload => {
        if (!mounted || authVersion !== authVersionRef.current) return;
        persistUser(mapBackendUser(payload.data));
      })
      .catch(() => {
        if (!mounted || authVersion !== authVersionRef.current) return;
        if (ENABLE_DEMO_AUTH) {
          const stored = readStoredUser();
          if (stored) {
            setUser(stored);
            return;
          }
        }
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setIsAuthReady(true);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!user,
        isAdmin: user?.role === 'admin',
        isAuthReady,
        user,
        login,
        loginWithPassword,
        registerWithInvite,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

function mapBackendUser(user: BackendUser): AuthUser {
  return {
    username: user.username,
    displayName: user.displayName || user.display_name || user.username,
    role: user.role === 'admin' ? 'admin' : 'invited',
  };
}
