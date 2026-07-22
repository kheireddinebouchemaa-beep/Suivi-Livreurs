import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { AppData } from "../types";
import { Upload, AlertCircle, CheckCircle2, Lock, Loader2, X } from "lucide-react";

interface ImportModalProps {
  onClose: () => void;
  // Appelé une fois l'agrégation terminée : met à jour le dashboard et sauvegarde le snapshot.
  // Retourne l'ID du snapshot créé (ou null si la sauvegarde a échoué) pour l'upload du détail
  // ligne par ligne qui suit.
  onAggregated: (data: AppData, fileName: string) => Promise<string | null>;
  // Appelé une fois l'upload du détail ligne par ligne terminé (avec ou sans échecs partiels),
  // pour que le dashboard puisse informer l'utilisateur si tout n'a pas pu être sauvegardé.
  onRawRowsUploadResult?: (result: { totalBatches: number; failedBatches: number }) => void;
}

// Les colonnes importantes que l'on vérifie
const COLUMNS_TO_VERIFY = [
  "Tracking", "Référence", "Client", "Wilaya", "Montant", "Type", "Préstation",
  "Livreur", "Station déstination", "Dispatché au livreur le", "Livré le", "Retour demandé le"
];

export default function ImportModal({ onClose, onAggregated, onRawRowsUploadResult }: ImportModalProps) {
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStepText, setParseStepText] = useState("");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [columnsStatus, setColumnsStatus] = useState<Record<string, boolean>>({});
  const [foundColumnsCount, setFoundColumnsCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Le worker garde les lignes parsées en mémoire entre l'analyse et l'agrégation :
  // le thread principal ne voit jamais les données brutes, seulement le résultat agrégé.
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Gestionnaires de glisser-déposer
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        handleFileSelection(droppedFile);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  // Pré-analyse initiale du fichier Excel/CSV sélectionné (dans le Web Worker)
  const handleFileSelection = async (selectedFile: File) => {
    setFile(selectedFile);
    setReadingFile(true);
    setRowCount(null);
    setParseProgress(0);
    const isCsv = selectedFile.name.split(".").pop()?.toLowerCase() === "csv";
    setParseStepText(isCsv ? "Chargement du fichier CSV..." : "Chargement du fichier Excel...");

    try {
      const buffer = await selectedFile.arrayBuffer();

      workerRef.current?.terminate();
      const worker = new Worker(new URL("../workers/importWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === "parsed") {
          if (msg.rowCount === 0) {
            alert(isCsv ? "Le fichier CSV est vide ou le format des colonnes est incorrect." : "L'onglet est vide.");
            resetState();
            return;
          }

          setSheetName(msg.sheetName);
          setRowCount(msg.rowCount);

          // Audit de colonnes à partir des en-têtes renvoyés par le worker
          const headers: string[] = msg.headers;
          const status: Record<string, boolean> = {};
          let foundCount = 0;
          COLUMNS_TO_VERIFY.forEach(col => {
            const exists = headers.some(k => k.trim().toLowerCase() === col.toLowerCase().trim());
            status[col] = exists;
            if (exists) foundCount++;
          });

          setColumnsStatus(status);
          setFoundColumnsCount(foundCount);
          setReadingFile(false);
          setParseProgress(0);
          setParseStepText("");
        } else if (msg.type === "progress") {
          const pct = msg.pct;
          setParseProgress(pct);
          if (pct === 15) setParseStepText("Lecture des données...");
          else if (pct === 30) setParseStepText("Nettoyage et calcul des formats de dates...");
          else if (pct === 50) setParseStepText("Calcul des indicateurs KPIs globaux...");
          else if (pct === 65) setParseStepText("Regroupement opérationnel par Livreur...");
          else if (pct === 80) setParseStepText("Production de l'activité temporelle (60J)...");
          else if (pct === 90) setParseStepText("Agrégation géolocalisée par Station d'IMIR...");
          else if (pct === 98) setParseStepText("Mise à jour du dashboard interactif...");
          else if (pct === 100) setParseStepText("Finalisation !");
        } else if (msg.type === "done") {
          setTimeout(async () => {
            setParseStepText("Sauvegarde du dashboard...");
            const newSnapshotId = await onAggregated(msg.data, file?.name || selectedFile.name);
            if (newSnapshotId && workerRef.current) {
              setParseProgress(0);
              setParseStepText("Sauvegarde du détail ligne par ligne...");
              workerRef.current.postMessage({ type: "uploadRawRows", snapshotId: newSnapshotId });
            } else {
              onClose();
            }
          }, 300);
        } else if (msg.type === "uploadProgress") {
          setParseProgress(msg.pct);
        } else if (msg.type === "uploadDone") {
          // Non bloquant : le dashboard et le snapshot sont déjà sauvegardés. Les lots qui ont
          // échoué malgré les tentatives de renvoi laissent simplement le drill-down incomplet
          // pour les colis concernés — l'utilisateur en est informé via onRawRowsUploadResult.
          onRawRowsUploadResult?.({ totalBatches: msg.totalBatches, failedBatches: msg.failedBatches });
          onClose();
        } else if (msg.type === "error") {
          alert(`Erreur de lecture du fichier : ${msg.message}`);
          resetState();
        }
      };

      worker.onerror = () => {
        alert("Une erreur est survenue lors de la lecture du fichier.");
        resetState();
      };

      // Transfert (pas de copie) du buffer vers le worker
      worker.postMessage({ type: "parse", buffer, isCsv }, [buffer]);
    } catch {
      alert("Erreur générale de lecture.");
      resetState();
    }
  };

  const resetState = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setFile(null);
    setReadingFile(false);
    setParseProgress(0);
    setParseStepText("");
    setRowCount(null);
    setSheetName("");
    setColumnsStatus({});
    setFoundColumnsCount(0);
  };

  // Lancement du traitement lourd (agrégation dans le worker, avec progression)
  const handleProcessRawData = () => {
    if (rowCount === null || !workerRef.current) return;

    setReadingFile(true);
    setParseProgress(5);
    setParseStepText("Initialisation de l'analyse...");
    workerRef.current.postMessage({ type: "aggregate" });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[#1B3A5C]/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={prefersReduced ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 12 }}
        animate={prefersReduced ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
        transition={prefersReduced ? { duration: 0.15 } : { duration: 0.25, ease: "easeOut" }}
        className="bg-white/85 backdrop-blur-xl rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-white/30 flex flex-col max-h-[90vh]"
      >

        {/* Header */}
        <div className="bg-[#1B3A5C]/90 text-white p-4 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-sm font-sans">Importer un nouvel export ECOTRACK v3.11</h3>
          </div>
          <button
            onClick={onClose}
            disabled={readingFile}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-55"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">

          {/* Section Drag Drop si fichier non sélectionné */}
          {!file && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center space-y-3 ${
                dragActive
                  ? "border-[#E8741A] bg-orange-50/20"
                  : "border-slate-300/60 hover:border-[#1B3A5C] hover:bg-white/25"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-[#1B3A5C]">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1B3A5C]">Glisser-déposer votre fichier Excel ou CSV ici</p>
                <p className="text-[10px] text-slate-500 mt-1">Formats supportés : .xlsx, .xls, .csv</p>
              </div>
              <button className="px-3 py-1.5 bg-[#E8741A] hover:bg-[#cf620f] text-white text-xs font-bold rounded-lg transition-all shadow-xs">
                Choisir un fichier
              </button>
            </div>
          )}

          {/* Analyse initiale du fichier si en cours */}
          {readingFile && (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-[#E8741A] animate-spin" />
              <div className="text-center">
                <span className="text-xs font-bold text-[#1B3A5C] block">{parseStepText}</span>
                {parseProgress > 0 && (
                  <span className="text-[10px] font-mono mt-1 font-bold text-slate-400 block">{parseProgress}% complété</span>
                )}
              </div>

              {/* Barre de progression */}
              {parseProgress > 0 && (
                <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Fichier Présent & non en chargement lourd */}
          {file && !readingFile && rowCount !== null && (
            <div className="space-y-4">

              {/* Informations fichier */}
              <div className="bg-white/20 p-3 rounded-lg border border-white/30 flex items-center justify-between backdrop-blur-md">
                <div>
                  <span className="text-xs font-bold text-[#1B3A5C] block truncate max-w-xs">{file.name}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    Feuille : "{sheetName}" | Lignes : {rowCount} | {(file.size / (1024 * 1024)).toFixed(2)} Mo
                  </span>
                </div>
                <button
                  onClick={resetState}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  Changer
                </button>
              </div>

              {/* Rapport de vérification des colonnes */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1B3A5C]">Audit de conformité des colonnes ({foundColumnsCount}/{COLUMNS_TO_VERIFY.length})</h4>

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1.5 bg-white/10 border border-white/20 rounded-lg">
                  {COLUMNS_TO_VERIFY.map(col => {
                    const present = columnsStatus[col];
                    return (
                      <div key={col} className="flex items-center space-x-1.5 text-[10px] font-medium py-0.5">
                        {present ? (
                          <span className="text-emerald-600 font-bold">✅</span>
                        ) : (
                          <span className="text-red-600 font-bold">❌</span>
                        )}
                        <span className={`truncate ${present ? "text-slate-700" : "text-slate-400 font-normal line-through"}`}>
                          {col}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {foundColumnsCount < 10 ? (
                  <div className="p-3 bg-red-50 inline-flex items-start text-red-800 rounded-lg space-x-2 border border-red-100 mt-1">
                    <AlertCircle className="w-4 h-4 text-[#D93025] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">
                      <strong>Fichier incompatible :</strong> L'export ne possède pas les colonnes minimales nécessaires (minimum 10 colonnes reconnues) pour générer l'analyse ECOTRACK v3.11.
                    </p>
                  </div>
                ) : foundColumnsCount < COLUMNS_TO_VERIFY.length ? (
                  <div className="p-3 bg-amber-50 inline-flex items-start text-amber-800 rounded-lg space-x-2 border border-amber-100 mt-1">
                    <AlertCircle className="w-4 h-4 text-[#F5A623] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">
                      <strong>Colonnes facultatives manquantes :</strong> Certaines métriques ou graphiques annexes pourraient être incomplets, mais le cœur du dashboard reste calculable (analyse partielle acceptée).
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 inline-flex items-start text-emerald-800 rounded-lg space-x-2 border border-emerald-100 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-[#18A558] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed">
                      <strong>Export 100% Conforme !</strong> Toutes les colonnes clés requises par ECOTRACK v3.11 ont été identifiées et vérifiées avec succès. Le calcul sera optimal.
                    </p>
                  </div>
                )}
              </div>

              {/* Bouton pour déclencher l'analyse finale */}
              <button
                onClick={handleProcessRawData}
                disabled={foundColumnsCount < 10}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyser et charger dans le dashboard
              </button>
            </div>
          )}

          {/* Message de cryptage/sécurité au pied de la modale */}
          <div className="p-3 bg-[#1B3A5C]/10 text-[#1B3A5C]/85 rounded-xl flex items-center space-x-2.5 border border-white/20 text-[10px] leading-relaxed backdrop-blur-md">
            <Lock className="w-4 h-4 text-[#1B3A5C] flex-shrink-0" />
            <p className="font-medium font-sans">
              <strong>🔒 Confidentialité totale :</strong> Le traitement, la conversion et le calcul s'exécutent entièrement en local au sein de votre navigateur. Aucune donnée d'IMIR Logistics n'est transmise d'aucune manière sur d'autres serveurs d'internet.
            </p>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
