import { AppData, FlatRow, BreakdownRow } from "../types";

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

export function uploadRawRowsBatch(snapshotId: string, rows: FlatRow[]) {
  return apiFetch(`/api/snapshots/${snapshotId}/raw-rows`, {
    method: "POST",
    body: JSON.stringify({ rows }),
  }) as Promise<{ inserted: number }>;
}

export interface RawRowsFilter {
  livreur?: string;
  noLivreur?: boolean; // lignes ignorées "sans livreur assigné" (champ stocké NULL)
  station?: string;
  statut?: string;
  expediteur?: string;
  commune?: string;
  isDispatched?: boolean;
  isLivre?: boolean;
  isRetour?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RawRowsResult {
  rows: FlatRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function queryRawRows(snapshotId: string, filter: RawRowsFilter) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  return apiFetch(`/api/snapshots/${snapshotId}/raw-rows?${params.toString()}`) as Promise<RawRowsResult>;
}

export function queryBreakdown(snapshotId: string, livreur: string, station: string, groupBy: "expediteur" | "zone") {
  const params = new URLSearchParams({ livreur, station, groupBy });
  return apiFetch(`/api/snapshots/${snapshotId}/breakdown?${params.toString()}`) as Promise<{ rows: BreakdownRow[] }>;
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
