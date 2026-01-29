// src/services/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "@/auth/tokenStorage";

const API_URL = import.meta.env.VITE_API_URL;

// axios “auth” sans interceptors (important)
export const authApi = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// axios principal
export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ---- hook pour informer l’app si auth KO (logout)
let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(cb: () => void) {
  onAuthFailure = cb;
}

// ---- Single-flight refresh
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) throw new Error("No refresh token");

  const res = await authApi.post<{ access: string }>("/auth/refresh/", { refresh });
  if (!res.data?.access) throw new Error("Refresh did not return access");
  tokenStorage.setAccess(res.data.access);
  return res.data.access;
}

// ---- Request interceptor: attach access
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// ---- Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // si pas de config => on sort
    if (!original) return Promise.reject(error);

    // évite les loops sur login/refresh
    const url = original.url || "";
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/refresh");
    if (isAuthRoute) return Promise.reject(error);

    if (status !== 401) return Promise.reject(error);
    if (original._retry) return Promise.reject(error);

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccess = await refreshPromise;

      // rejouer la requête
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (e) {
      tokenStorage.clear();
      onAuthFailure?.();
      return Promise.reject(e);
    }
  }
);
