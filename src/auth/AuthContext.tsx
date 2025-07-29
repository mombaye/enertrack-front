import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/services/api";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";

export interface UserJWT {
  username: string;
  role: string;
  pays?: string;
  exp: number;
  [key: string]: any;
}
interface AuthContextType {
  user: UserJWT | null;
  access: string | null;
  login: (token: string, refresh: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ACCESS_KEY = "enertrack_access";
const REFRESH_KEY = "enertrack_refresh";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [access, setAccess] = useState<string | null>(() => localStorage.getItem(ACCESS_KEY));
  const [refresh, setRefresh] = useState<string | null>(() => localStorage.getItem(REFRESH_KEY));
  const [user, setUser] = useState<UserJWT | null>(null);

  useEffect(() => {
    if (access) {
      try {
        setUser(jwtDecode<UserJWT>(access));
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, [access]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (access && refresh) {
      try {
        const { exp } = jwtDecode<{ exp: number }>(access);
        const expiresIn = exp * 1000 - Date.now() - 10000; // 10s avant
        if (expiresIn > 0) {
          timer = setTimeout(refreshToken, expiresIn);
        } else {
          refreshToken();
        }
      } catch {
        toast.error("Session expirée, veuillez vous reconnecter.", { autoClose: 5000 });
        logout();
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [access, refresh]);

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    setAccess(accessToken);
    setRefresh(refreshToken);
  };

  const logout = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAccess(null);
    setRefresh(null);
    setUser(null);
  };

  const refreshToken = async () => {
    if (!refresh) return logout();
    try {
      const res = await api.post<{ access: string }>("/auth/refresh/", { refresh });
      if (res.data.access) {
        login(res.data.access, refresh);
      } else {
        logout();
      }
    } catch {
      toast.error("Session expirée, veuillez vous reconnecter.", { autoClose: 5000 });
      logout();
    }
  };

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      res => res,
      async error => {
        const origRequest = error.config;
        if (
          error.response?.status === 401 &&
          !origRequest._retry &&
          refresh
        ) {
          origRequest._retry = true;
          await refreshToken();
          origRequest.headers["Authorization"] = `Bearer ${localStorage.getItem(ACCESS_KEY)}`;
          return api(origRequest);
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [access, refresh]);

  useEffect(() => {
    api.defaults.headers.common["Authorization"] = access ? `Bearer ${access}` : "";
  }, [access]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACCESS_KEY && !e.newValue) logout();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);



  return (
    <AuthContext.Provider value={{ user, access, login, logout, isAuthenticated: !!access }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
