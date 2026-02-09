export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;

  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (init.method ?? 'GET').toUpperCase();

  return fetch(input, {
    ...init,
    headers,
    // Prevent browser disk churn from repeatedly cached API GET responses.
    cache: init.cache ?? (method === 'GET' ? 'no-store' : undefined),
  });
}
