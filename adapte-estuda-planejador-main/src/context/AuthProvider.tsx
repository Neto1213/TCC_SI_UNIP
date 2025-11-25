import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  type AuthenticatedUser,
  login as apiLogin,
  register as apiRegister,
  clearToken as dropToken,
  getToken,
  fetchCurrentUser,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const loadUser = useCallback(async () => {
    // Evita chamadas ao backend quando não há token salvo.
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const profile = await fetchCurrentUser();
      setUser(profile);
    } catch (error) {
      dropToken();
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        await loadUser();
      } catch {
        // Já tratamos limpando o token em loadUser; apenas evitamos console noise aqui.
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    };

    if (!getToken()) {
      setBootstrapping(false);
      return;
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      await loadUser();
    },
    [loadUser]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await apiRegister(email, password);
      await loadUser();
    },
    [loadUser]
  );

  const logout = useCallback(() => {
    dropToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading: bootstrapping,
      login,
      register,
      logout,
      refreshUser: loadUser,
    }),
    [user, bootstrapping, login, register, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
};
