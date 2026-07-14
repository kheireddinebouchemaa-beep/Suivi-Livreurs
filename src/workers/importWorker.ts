// Web Worker d'import : décodage du fichier, parsing CSV/Excel et agrégation KPI
// s'exécutent ici, hors du thread principal, pour ne jamais geler l'interface
// même sur de très gros exports (plusieurs centaines de milliers de lignes).
//
// Protocole :
//   main → worker : { type: "parse", buffer, isCsv }   (buffer transféré, pas copié)
//   worker → main : { type: "parsed", rowCount, headers, sheetName } | { type: "error", message }
//   main → worker : { type: "aggregate" }
//   worker → main : { type: "progress", pct } … { type: "done", data } | { type: "error", message }
//
// Les lignes parsées restent dans le worker entre les deux phases : seul le résultat
// agrégé (léger) est renvoyé au thread principal.

import * as XLSX from "xlsx";
import { parseCSV, decodeCsvBuffer } from "../lib/csv";
import { parseEcotrackRawData } from "../parser";

let parsedRows: Record<string, any>[] | null = null;

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
      self.postMessage({ type: "done", data: result });
      parsedRows = null; // libérer la mémoire
      return;
    }
  } catch (err: any) {
    self.postMessage({ type: "error", message: err?.message || String(err) });
  }
};
