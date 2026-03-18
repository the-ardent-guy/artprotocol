/**
 * Public user auth — uses JWT stored in localStorage.
 * Separate from NextAuth (which handles admin/client).
 */

export interface APUser {
  id:         string;
  email:      string;
  name:       string;
  credits:    number;
  trial_used: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ap_token");
}

export function getStoredUser(): APUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ap_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: APUser) {
  localStorage.setItem("ap_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("ap_token");
  localStorage.removeItem("ap_user");
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = `Request failed: ${res.status}`;
    try {
      const d = JSON.parse(text).detail;
      if (typeof d === "string") detail = d;
      else if (Array.isArray(d)) detail = d.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      else if (d) detail = JSON.stringify(d);
    } catch { if (text) detail = text.slice(0, 120); }
    if (res.status === 502 || res.status === 503 || (typeof detail === "string" && detail.toLowerCase().includes("econnrefused"))) {
      detail = "Cannot reach server — make sure the backend is running on port 8000.";
    }
    throw new Error(detail);
  }
  return res.json();
}
