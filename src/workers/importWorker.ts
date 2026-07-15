// Web Worker d'import : décodage du fichier, parsing CSV/Excel et agrégation KPI
// s'exécutent ici, hors du thread principal, pour ne jamais geler l'interface
// même sur de très gros exports (plusieurs centaines de milliers de lignes).
//
// Protocole :
//   main → worker : { type: "parse", buffer, isCsv }   (buffer transféré, pas copié)
//   worker → main : { type: "parsed", rowCount, headers, sheetName } | { type: "error", message }
//   main → worker : { type: "aggregate" }
//   worker → main : { type: "progress", pct } … { type: "done", data } | { type: "error", message }
//   main → worker : { type: "uploadRawRows", snapshotId }   (une fois le snapshot créé côté backend)
//   worker → main : { type: "uploadProgress", pct } … { type: "uploadDone" } | { type: "uploadError", message }
//
// Les lignes parsées restent dans le worker entre les phases : seul le résultat agrégé (léger)
// est renvoyé au thread principal après l'agrégation ; les lignes à plat ne quittent le worker
// que sous forme de petits lots envoyés directement au backend (jamais via postMessage).

import * as XLSX from "xlsx";
import { parseCSV, decodeCsvBuffer } from "../lib/csv";
import { parseEcotrackRawData } from "../parser";
import type { FlatRow } from "../types";

let parsedRows: Record<string, any>[] | null = null;
let flatRows: FlatRow[] | null = null;

const RAW_ROWS_BATCH_SIZE = 5000;

async function uploadRawRows(snapshotId: string) {
  if (!flatRows || flatRows.length === 0) {
    self.postMessage({ type: "uploadDone" });
    return;
  }

  const totalBatches = Math.ceil(flatRows.length / RAW_ROWS_BATCH_SIZE);
  for (let b = 0; b < totalBatches; b++) {
    const batch = flatRows.slice(b * RAW_ROWS_BATCH_SIZE, (b + 1) * RAW_ROWS_BATCH_SIZE);
    const res = await fetch(`/api/snapshots/${snapshotId}/raw-rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: batch }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      self.postMessage({ type: "uploadError", message: body.error || `Erreur serveur (${res.status})` });
      return;
    }
    self.postMessage({ type: "uploadProgress", pct: Math.round(((b + 1) / totalBatches) * 100) });
  }

  flatRows = null; // libérer la mémoire
  self.postMessage({ type: "uploadDone" });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  try {
    if (msg.type === "parse") {
      const buffer: ArrayBuffer = msg.buffer;

      if (msg.isCsv) {
        const text = decodeCsvBuffer(buffer);
        parsedRows = parseCSV(text);
        self.postMessage({
          type: "parsed",
          rowCount: parsedRows.length,
          headers: parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [],
          sheetName: "Export CSV",
        });
      } else {
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        parsedRows = XLSX.utils.sheet_to_json(worksheet);
        self.postMessage({
          type: "parsed",
          rowCount: parsedRows.length,
          headers: parsedRows.length > 0 ? Object.keys(parsedRows[0] as object) : [],
          sheetName: firstSheetName,
        });
      }
      return;
    }

    if (msg.type === "aggregate") {
      if (!parsedRows || parsedRows.length === 0) {
        self.postMessage({ type: "error", message: "Aucune donnée parsée à agréger." });
        return;
      }
      const result = parseEcotrackRawData(parsedRows, (pct) => {
        self.postMessage({ type: "progress", pct });
      });
      flatRows = result.flatRows; // conservé pour l'upload ultérieur du détail ligne par ligne
      parsedRows = null; // libérer la mémoire des lignes brutes non normalisées
      self.postMessage({ type: "done", data: result.data });
      return;
    }

    if (msg.type === "uploadRawRows") {
      uploadRawRows(msg.snapshotId);
      return;
    }
  } catch (err: any) {
    self.postMessage({ type: "error", message: err?.message || String(err) });
  }
};
