import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User } from "./api";

interface AppState {
  user: User | null;
  loading: boolean;
  settings: Record<string, string>;
  currency: string;
  appName: string;
  refreshSettings: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AppState>(null as any);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});

  async function refreshSettings() {
    try {
      const { settings } = await api.getSettings();
      setSettings(settings);
    } catch {
      /* not logged in yet */
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        await refreshSettings();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username: string, password: string) {
    const { user } = await api.login(username, password);
    setUser(user);
    await refreshSettings();
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        settings,
        currency: settings.currency || "USD",
        appName: settings.appName || "Home Expense Manager",
        refreshSettings,
        login,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);

export function useMoney() {
  const { currency } = useApp();
  return (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  };
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
