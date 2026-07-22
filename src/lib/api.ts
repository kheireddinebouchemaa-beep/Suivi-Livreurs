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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_DELAYS_MS = [1000, 3000, 8000];

// Comme uploadBatchWithRetry côté worker (import raw-rows) : un import de 500k+ lignes se fait
// souvent sur un réseau instable (mobile, 3G), et une simple coupure ne doit pas faire perdre
// l'import entier. On ne retente que sur une erreur réseau (fetch qui échoue avant même de
// recevoir une réponse) ou un 5xx/429 — un 4xx propre (payload rejeté, validation) ne changera
// pas d'issue en réessayant.
async function apiFetchWithRetry(path: string, options: RequestInit = {}) {
  let lastErr: any;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      const res = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      });
      if (res.ok) return res.json();
      if (res.status < 500 && res.status !== 429) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur serveur (${res.status})`);
      }
      lastErr = new Error(`Erreur serveur (${res.status})`);
    } catch (err: any) {
      lastErr = err;
    }
    if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
  }
  throw lastErr;
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

// Garde-fou de taille pour la sauvegarde du snapshot : sur un import réel avec des saisies
// incohérentes (fautes de frappe dans les noms d'expéditeurs/communes), ces listes peuvent
// compter beaucoup plus d'entrées distinctes qu'il n'y a réellement d'expéditeurs/communes,
// et gonfler le payload envoyé à /api/snapshots bien au-delà de ce qui est utile à conserver.
// On ne tronque QUE ce qui est envoyé au serveur (l'onglet Expéditeurs/Zones de la session en
// cours affiche toujours la liste complète, tirée de `data` en mémoire, pas de ce payload).
const MAX_BREAKDOWN_ENTRIES_SAVED = 2000;

function capForSave(data: AppData): AppData {
  if (data.expediteurs.length <= MAX_BREAKDOWN_ENTRIES_SAVED && data.zones.length <= MAX_BREAKDOWN_ENTRIES_SAVED) {
    return data;
  }
  return {
    ...data,
    expediteurs: [...data.expediteurs].sort((a, b) => b.dispatches - a.dispatches).slice(0, MAX_BREAKDOWN_ENTRIES_SAVED),
    zones: [...data.zones].sort((a, b) => b.dispatches - a.dispatches).slice(0, MAX_BREAKDOWN_ENTRIES_SAVED),
  };
}

export async function saveSnapshot(fileName: string, data: AppData, source: "import" | "api" = "import", periodLabel?: string) {
  const body = JSON.stringify({ file_name: fileName, data: capForSave(data), source, period_label: periodLabel });
  const sizeMb = (body.length / (1024 * 1024)).toFixed(2);
  console.log(`[saveSnapshot] taille du payload : ${sizeMb} Mo`);

  try {
    return (await apiFetchWithRetry("/api/snapshots", { method: "POST", body })) as SnapshotMeta;
  } catch (err: any) {
    // Enrichir le message d'erreur avec la taille du payload : sur un très gros import, c'est
    // le premier réflexe de diagnostic (limite de taille de requête côté plateforme d'hébergement).
    throw new Error(`${err.message} (payload envoyé : ${sizeMb} Mo)`);
  }
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
