import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";

type UserRole = "SUPER_ADMIN" | "COMPANY" | "CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  customer: null | {
    id: string;
    fullName: string;
    city: string | null;
  };
  company: null | {
    id: string;
    name: string;
    city: string | null;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    membershipType: "TRIAL" | "PLUS";
    trialEndsAt: string | null;
    sectors: Array<{ id: string; name: string }>;
    competencies: Array<{ id: string; name: string }>;
  };
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isHydrating: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCustomer: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    city?: string;
  }) => Promise<void>;
  registerCompany: (payload: {
    email: string;
    password: string;
    companyName: string;
    taxNumber?: string;
    city?: string;
    sectors?: string[];
  }) => Promise<void>;
  bootstrapAdmin: (payload: { email: string; password: string; bootstrapKey: string }) => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = "uc_teklif_token";
const USER_KEY = "uc_teklif_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadTokenFromStorage(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function loadUserFromStorage(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch (_error) {
    return null;
  }
}

function saveSessionToStorage(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSessionFromStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => loadTokenFromStorage());
  const [user, setUser] = useState<AuthUser | null>(() => loadUserFromStorage());
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      if (!token) {
        setIsHydrating(false);
        return;
      }

      try {
        const response = await apiRequest<{ user: AuthUser }>("/api/auth/me", { token });
        setUser(response.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      } catch (_error) {
        clearSessionFromStorage();
        setToken(null);
        setUser(null);
      } finally {
        setIsHydrating(false);
      }
    };

    hydrate().catch(() => {
      clearSessionFromStorage();
      setToken(null);
      setUser(null);
      setIsHydrating(false);
    });
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isHydrating,
      isAuthenticated: !!token && !!user,
      login: async (email, password) => {
        const response = await apiRequest<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: { email, password }
        });
        setToken(response.token);
        setUser(response.user);
        saveSessionToStorage(response.token, response.user);
      },
      registerCustomer: async (payload) => {
        const response = await apiRequest<AuthResponse>("/api/auth/register/customer", {
          method: "POST",
          body: payload
        });
        setToken(response.token);
        setUser(response.user);
        saveSessionToStorage(response.token, response.user);
      },
      registerCompany: async (payload) => {
        const response = await apiRequest<AuthResponse>("/api/auth/register/company", {
          method: "POST",
          body: payload
        });
        setToken(response.token);
        setUser(response.user);
        saveSessionToStorage(response.token, response.user);
      },
      bootstrapAdmin: async (payload) => {
        const response = await apiRequest<AuthResponse>("/api/auth/bootstrap-admin", {
          method: "POST",
          body: payload
        });
        setToken(response.token);
        setUser(response.user);
        saveSessionToStorage(response.token, response.user);
      },
      logout: () => {
        clearSessionFromStorage();
        setToken(null);
        setUser(null);
      }
    }),
    [isHydrating, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
