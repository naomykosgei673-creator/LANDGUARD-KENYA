import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

const ACCESS_KEY = 'lg_access';
const REFRESH_KEY = 'lg_refresh';

// One-time cleanup: remove any legacy tokens written to localStorage by older
// builds, so they can't shadow the per-tab sessionStorage sessions.
if (typeof window !== 'undefined') {
  localStorage.removeItem('lg_access');
  localStorage.removeItem('lg_refresh');
}

// Tokens live in sessionStorage (NOT localStorage) so every browser tab keeps its
// own independent session. This lets you sign in as Admin in one tab, Seller in
// another, Buyer in a third — all at once — which is ideal for demos/presentations.
export const tokenStore = {
  get access() { return typeof window !== 'undefined' ? sessionStorage.getItem(ACCESS_KEY) : null; },
  get refresh() { return typeof window !== 'undefined' ? sessionStorage.getItem(REFRESH_KEY) : null; },
  set(access: string, refresh: string) {
    sessionStorage.setItem(ACCESS_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Transparent refresh on 401 (once), then retry the original request.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original?._retry && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing ??= (async () => {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: tokenStore.refresh });
          tokenStore.set(data.data.accessToken, data.data.refreshToken);
          return data.data.accessToken as string;
        })();
        const newToken = await refreshing;
        refreshing = null;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        refreshing = null;
        tokenStore.clear();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper that unwraps the { success, data } envelope.
export async function apiGet<T>(url: string, params?: any): Promise<T> {
  const { data } = await api.get(url, { params });
  return data.data ?? data;
}
export async function apiPost<T>(url: string, body?: any): Promise<T> {
  const { data } = await api.post(url, body);
  return data.data ?? data;
}
export async function apiPatch<T>(url: string, body?: any): Promise<T> {
  const { data } = await api.patch(url, body);
  return data.data ?? data;
}

export function apiError(err: unknown): string {
  const e = err as AxiosError<any>;
  const error = e.response?.data?.error;
  const details = error?.details as Array<{ message?: string }> | undefined;

  // Show the field-specific Zod feedback instead of only "Validation failed".
  if (error?.message === 'Validation failed' && Array.isArray(details) && details.length) {
    return details.map((detail) => detail.message).filter(Boolean).join(' ');
  }

  return error?.message ?? e.message ?? 'Something went wrong';
}

// For endpoints that return the full paginated envelope.
export async function apiGetRaw<T>(url: string, params?: any): Promise<T> {
  const { data } = await api.get(url, { params });
  return data;
}
