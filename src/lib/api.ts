import { AppData } from "../types";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur serveur (${res.status})`);
  }

  return res.json();
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
  return apiFetch("/api/snapshots", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, data, source, period_label: periodLabel }),
  }) as Promise<SnapshotMeta>;
}

export function listSnapshots() {
  return apiFetch("/api/snapshots") as Promise<SnapshotMeta[]>;
}

export function getLatestSnapshot() {
  return apiFetch("/api/snapshots/latest") as Promise<Snapshot>;
}

export function getSnapshot(id: string) {
  return apiFetch(`/api/snapshots/${id}`) as Promise<Snapshot>;
}

export interface Threshold {
  key: string;
  label: string;
  comparison: "min" | "max";
  value: number;
  updated_at: string;
}

export function getThresholds() {
  return apiFetch("/api/thresholds") as Promise<Threshold[]>;
}

export function updateThreshold(key: string, value: number) {
  return apiFetch(`/api/thresholds/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  }) as Promise<Threshold>;
}
