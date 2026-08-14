const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://prince-iyke-inventory-system-5.onrender.com/api/v1";
let accessToken: string | null = null;
export function setAccessToken(token: string | null) { accessToken = token; }
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && path !== "/auth/refresh") {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) { const data = await refreshed.json() as { accessToken: string }; setAccessToken(data.accessToken); headers.set("Authorization", `Bearer ${data.accessToken}`); response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" }); }
  }
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { message?: string }; throw new Error(body.message ?? `Request failed (${response.status})`); }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function cloudLogin(email: string, password: string) {
  const result = await apiRequest<{ accessToken: string; user: unknown; shop: unknown }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  setAccessToken(result.accessToken);
  return result;
}
