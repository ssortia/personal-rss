import { env } from './env';

// На сервере — API_URL (внутренняя сеть/docker), на клиенте — NEXT_PUBLIC_API_URL
const API_BASE = typeof window === 'undefined' ? env.API_URL : env.NEXT_PUBLIC_API_URL;

type RequestOptions = RequestInit & {
  accessToken?: string;
  /** Query-параметры для GET-запросов. Undefined-значения игнорируются. */
  params?: Record<string, string | undefined>;
};

/** Типизированная HTTP-ошибка со статус-кодом для удобной обработки в UI. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, params, ...fetchOptions } = options;

  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, value);
    }
    const qs = search.toString();
    if (qs) path = `${path}?${qs}`;
  }

  // Content-Type ставим только для запросов с телом, иначе Fastify отвергает пустой body
  const hasBody = fetchOptions.body !== undefined;
  const headers: HeadersInit = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...fetchOptions.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new ApiError(res.status, error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Вариант apiFetch для операций без тела ответа (DELETE, 204 No Content). */
async function apiFetchVoid(path: string, options: RequestOptions = {}): Promise<void> {
  const { accessToken, ...fetchOptions } = options;

  const headers: HeadersInit = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...fetchOptions.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new ApiError(res.status, error || `HTTP ${res.status}`);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  /** Для запросов с телом ответа — используйте api.patch(). */
  patchVoid: (path: string, body: unknown, options?: RequestOptions) =>
    apiFetchVoid(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string, options?: RequestOptions) =>
    apiFetchVoid(path, { ...options, method: 'DELETE' }),
};
