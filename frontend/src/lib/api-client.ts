export interface ApiError extends Error {
  status: number;
  data: { message: string | string[]; [key: string]: unknown };
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    if (!refreshing) refreshing = tryRefresh().finally(() => { refreshing = null; });
    const ok = await refreshing;
    if (ok) return request<T>(method, path, body, true);
    if (typeof window !== 'undefined') window.location.href = '/auth/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(error.message) ? error.message.join(', ') : (error.message ?? 'Request failed');
    throw Object.assign(new Error(msg), { status: res.status, data: error });
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && 'status' in err && 'data' in err;
}

export function getApiErrorMessage(err: unknown, fallback = 'Error desconocido'): string {
  if (isApiError(err)) {
    const msg = err.data?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === 'string') return msg;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export const api = {
  get:    <T>(path: string)               => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};
