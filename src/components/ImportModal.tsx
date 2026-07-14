import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import * as XLSX from "xlsx";
import { AppData } from "../types";
import { parseEcotrackRawData } from "../parser";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Lock, Loader2, X } from "lucide-react";

interface ImportModalProps {
  onClose: () => void;
  onImportSuccess: (data: AppData, fileName: string) => void;
}

// Les colonnes importantes que l'on vérifie
const COLUMNS_TO_VERIFY = [
  "Tracking", "Référence", "Client", "Wilaya", "Montant", "Type", "Préstation", 
  "Livreur", "Station déstination", "Dispatché au livreur le", "Livré le", "Retour demandé le"
];

// Fonction utilitaire de parsing CSV robuste qui s'auto-adapte aux délimiteurs (, ou ;) et gère le BOM UTF-8
function parseCSV(text: string): Record<string, any>[] {
  let cleanedText = text;
  // Retirer le BOM s'il existe (généré souvent par Excel pour signaler du UTF-8)
  if (cleanedText.startsWith("\ufeff")) {
    cleanedText = cleanedText.substring(1);
  }

  const lines: string[][] = [];
  let row: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  
  // Compter les délimiteurs potentiels sur le début de texte pour deviner le séparateur
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  
  let firstLineLength = cleanedText.indexOf("\n");
  if (firstLineLength === -1) firstLineLength = cleanedText.length;
  const limit = Math.min(firstLineLength, 2000);
  
  let inQ = false;
  for (let i = 0; i < limit; i++) {
    const char = cleanedText[i];
    if (char === '"') {
      inQ = !inQ;
    }
    if (!inQ) {
      if (char === ',') commaCount++;
      else if (char === ';') semiCount++;
      else if (char === '\t') tabCount++;
    }
  }
  
  let sep = ',';
  if (semiCount > commaCount && semiCount > tabCount) {
    sep = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    sep = '\t';
  }
  
  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    const nextChar = cleanedText[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Sauter le second guillemet
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === sep && !insideQuotes) {
      row.push(currentField);
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentField);
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
        lines.push(row);
      }
      row = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  
  if (currentField !== "" || row.length > 0) {
    row.push(currentField);
    if (row.length > 0 && !(row.length === 1 && row[0] === "")) {
      lines.push(row);
    }
  }
  
  if (lines.length === 0) return [];
  
  // Nettoyage et trim des en-têtes
  const headers = lines[0].map(h => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, any>[] = [];
  
  for (let r = 1; r < lines.length; r++) {
    const values = lines[r];
    const obj: Record<string, any> = {};
    let hasData = false;
    
    headers.forEach((header, index) => {
      let val = values[index];
      if (val === undefined) {
        val = "";
      } else {
        val = val.trim().replace(/^"|"$/g, "");
      }
      if (val !== "") {
        hasData = true;
      }
      if (header) {
        obj[header] = val;
      }
    });
    
    if (hasData) {
      rows.push(obj);
    }
  }
  return rows;
}

export default function ImportModal({ onClose, onImportSuccess }: ImportModalProps) {
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStepText, setParseStepText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[] | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [columnsStatus, setColumnsStatus] = useState<Record<string, boolean>>({});
  const [foundColumnsCount, setFoundColumnsCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Pré-analyse initiale du fichier Excel/CSV sélectionné
  const handleFileSelection = async (selectedFile: File) => {
    setFile(selectedFile);
    setReadingFile(true);
    setParsedRows(null);
    setParseProgress(0);
    const isCsv = selectedFile.name.split(".").pop()?.toLowerCase() === "csv";
    setParseStepText(isCsv ? "Chargement du fichier CSV..." : "Chargement du fichier Excel...");

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error("Fichier vide ou illisible.");

          let jsonRows: any[] = [];
          if (isCsv) {
            setSheetName("Export CSV");
            const buffer = data as ArrayBuffer;
            let text = new TextDecoder("utf-8").decode(buffer);
            // Détection de mojibake (encodage mal interprété, ex: fichiers issus d'un script de fusion Python/pandas non-UTF-8)
            const sample = text.slice(0, 5000);
            const looksLikeMojibake = /�/.test(sample) || /Ã./.test(sample) || /â€/.test(sample);
            if (looksLikeMojibake) {
              text = new TextDecoder("windows-1252").decode(buffer);
            }
            jsonRows = parseCSV(text);
          } else {
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            setSheetName(firstSheetName);

            const worksheet = workbook.Sheets[firstSheetName];
            jsonRows = XLSX.utils.sheet_to_json(worksheet);
          }

          if (jsonRows.length === 0) {
            throw new Error(isCsv ? "Le fichier CSV est vide ou le format des colonnes est incorrect." : "L'onglet est vide.");
          }

          setParsedRows(jsonRows);

          // Analyser les colonnes
          const firstRow = jsonRows[0] as Record<string, any>;
          const status: Record<string, boolean> = {};
          let foundCount = 0;

          COLUMNS_TO_VERIFY.forEach(col => {
            // tolérance fine pour trim et ignorecase
            const match = Object.keys(firstRow).find(
              k => k.trim().toLowerCase() === col.toLowerCase().trim()
            );
            const exists = match !== undefined;
            status[col] = exists;
            if (exists) foundCount++;
          });

          setColumnsStatus(status);
          setFoundColumnsCount(foundCount);
          setReadingFile(false);
          setParseProgress(0);
          setParseStepText("");
        } catch (err: any) {
          alert(`Erreur de lecture du fichier : ${err.message || err}`);
          resetState();
        }
      };
      
      reader.onerror = () => {
        alert("Une erreur est survenue lors de la lecture du fichier.");
        resetState();
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      alert("Erreur générale de lecture.");
      resetState();
    }
  };

  const resetState = () => {
    setFile(null);
    setReadingFile(false);
    setParseProgress(0);
    setParseStepText("");
    setParsedRows(null);
    setSheetName("");
    setColumnsStatus({});
    setFoundColumnsCount(0);
  };

  // Lancement du traitement lourd avec progression
  const handleProcessRawData = async () => {
    if (!parsedRows) return;

    setReadingFile(true);
    setParseProgress(5);
    setParseStepText("Initialisation de l'analyse...");

    setTimeout(() => {
      try {
        const result = parseEcotrackRawData(parsedRows, (pct) => {
          setParseProgress(pct);
          // Évolutions des textes de traitement d'après le brief
          if (pct === 15) setParseStepText("Lecture des données (SheetJS)...");
          else if (pct === 30) setParseStepText("Nettoyage et calcul des formats de dates...");
          else if (pct === 50) setParseStepText("Calcul des indicateurs KPIs globaux...");
          else if (pct === 65) setParseStepText("Regroupement opérationnel par Livreur...");
          else if (pct === 80) setParseStepText("Production de l'activité temporelle (60J)...");
          else if (pct === 90) setParseStepText("Agrégation géolocalisée par Station d'IMIR...");
          else if (pct === 98) setParseStepText("Mise à jour du dashboard interactif...");
          else if (pct === 100) setParseStepText("Finalisation !");
        });

        setTimeout(() => {
          onImportSuccess(result, file?.name || "Données importées.xlsx");
        }, 300);
      } catch (err: any) {
        alert(`Erreur d'analyse : ${err?.message || err}`);
        setReadingFile(false);
        setParseProgress(0);
        setParseStepText("");
      }
    }, 100);
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
          {file && !readingFile && parsedRows && (
            <div className="space-y-4">
              
              {/* Informations fichier */}
              <div className="bg-white/20 p-3 rounded-lg border border-white/30 flex items-center justify-between backdrop-blur-md">
                <div>
                  <span className="text-xs font-bold text-[#1B3A5C] block truncate max-w-xs">{file.name}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    Feuille : "{sheetName}" | Lignes : {parsedRows.length} | {(file.size / (1024 * 1024)).toFixed(2)} Mo
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
