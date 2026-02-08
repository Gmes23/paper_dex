export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null;

  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
