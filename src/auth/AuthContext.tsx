// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { tokenStorage } from "@/auth/tokenStorage";
import { setOnAuthFailure, authApi } from "@/services/api";

export interface UserJWT {
  username: string;
  role: string;
  pays?: string;
  exp: number;
  [key: string]: any;
}

type AuthCtx = {
  user: UserJWT | null;
  access: string | null;
  isAuthenticated: boolean;
  login: (access: string, refresh: string) => void;
  logout: () => void;
  refreshNow: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

function isExpired(access: string) {
  try {
    const { exp } = jwtDecode<{ exp: number }>(access);
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<string | null>(() => tokenStorage.getAccess());
  const [user, setUser] = useState<UserJWT | null>(null);

  const logout = () => {
    tokenStorage.clear();
    setAccess(null);
    setUser(null);
  };

  const login = (accessToken: string, refreshToken: string) => {
    tokenStorage.setTokens(accessToken, refreshToken);
    setAccess(accessToken);
  };

  const refreshNow = async () => {
    const refresh = tokenStorage.getRefresh();
    if (!refresh) return logout();

    const res = await authApi.post<{ access: string }>("/auth/refresh/", { refresh });
    if (!res.data?.access) return logout();

    tokenStorage.setAccess(res.data.access);
    setAccess(res.data.access);
  };

  // connect api interceptor => logout si refresh fail
  useEffect(() => {
    setOnAuthFailure(() => logout);
  }, []);

  // decode user à chaque access
  useEffect(() => {
    if (!access) {
      setUser(null);
      return;
    }
    try {
      setUser(jwtDecode<UserJWT>(access));
    } catch {
      setUser(null);
    }
  }, [access]);

  // au boot: si access expiré mais refresh existe => refresh 1x
  useEffect(() => {
    const a = tokenStorage.getAccess();
    const r = tokenStorage.getRefresh();
    if (!a || !r) return;
    if (isExpired(a)) {
      refreshNow().catch(() => logout());
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      access,
      isAuthenticated: !!access && !!user,
      login,
      logout,
      refreshNow,
    }),
    [user, access]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
