import { AppData } from "../types";

const TOKEN_KEY = "suivi_livreurs_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur serveur (${res.status})`);
  }

  return res.json();
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Échec de connexion.");
  }
  const { token } = await res.json();
  setToken(token);
}

export interface SnapshotMeta {
  id: string;
  created_at: string;
  file_name: string;
  source: "import" | "api";
  period_label: string | null;
}

export interface Snapshot extends SnapshotMeta {
  data: AppData;
}

export function saveSnapshot(fileName: string, data: AppData, source: "import" | "api" = "import", periodLabel?: string) {
  return authFetch("/api/snapshots", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, data, source, period_label: periodLabel }),
  }) as Promise<SnapshotMeta>;
}

export function listSnapshots() {
  return authFetch("/api/snapshots") as Promise<SnapshotMeta[]>;
}

export function getLatestSnapshot() {
  return authFetch("/api/snapshots/latest") as Promise<Snapshot>;
}

export function getSnapshot(id: string) {
  return authFetch(`/api/snapshots/${id}`) as Promise<Snapshot>;
}

export interface Threshold {
  key: string;
  label: string;
  comparison: "min" | "max";
  value: number;
  updated_at: string;
}

export function getThresholds() {
  return authFetch("/api/thresholds") as Promise<Threshold[]>;
}

export function updateThreshold(key: string, value: number) {
  return authFetch(`/api/thresholds/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  }) as Promise<Threshold>;
}
