import { useState, useMemo, useEffect } from "react";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getPerfCategory, getDelaiCategory, getRetourCategory } from "../utils";
import { Search, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal, ArrowUpDown, Table as TableIcon, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportLivreursExcel } from "../exportExcel";
import { exportLivreursPdf } from "../exportPdf";
import LivreurDetailModal from "./LivreurDetailModal";

interface LivreursTabProps {
  data: AppData;
  snapshotId: string | null;
}

export default function LivreursTab({ data, snapshotId }: LivreursTabProps) {
  // Détection prefers-reduced-motion
  const [prefersReduced, setPrefersReduced] = useState<boolean>(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  // Filtres
  const [searchText, setSearchText] = useState("");
  const [selectedStation, setSelectedStation] = useState("Tous");
  const [tauxMin, setTauxMin] = useState<string>("");
  const [tauxMax, setTauxMax] = useState<string>("");
  const [dispMin, setDispMin] = useState<string>("");
  const [selectedPerf, setSelectedPerf] = useState("Tous");

  // Tri
  const [sortField, setSortField] = useState<keyof LivreurRecap>("taux_livraison");
  const [sortAsc, setSortAsc] = useState(false);

  // Fiche détaillée d'un livreur (colis, expéditeurs, communes)
  const [detailLivreur, setDetailLivreur] = useState<LivreurRecap | null>(null);

  // Extraire les stations uniques
  const stationsList = useMemo(() => {
    const list = new Set(data.recap.map(l => l.station));
    return ["Tous", ...Array.from(list).sort()];
  }, [data]);

  // Réinitialiser les filtres
  const handleResetFilters = () => {
    setSearchText("");
    setSelectedStation("Tous");
    setTauxMin("");
    setTauxMax("");
    setDispMin("");
    setSelectedPerf("Tous");
    setSortField("taux_livraison");
    setSortAsc(false);
  };

  // Filtrer les données
  const filteredData = useMemo(() => {
    return data.recap.filter(l => {
      // 1. Recherche plein texte
      const matchesSearch = 
        l.livreur.toLowerCase().includes(searchText.toLowerCase()) ||
        l.station.toLowerCase().includes(searchText.toLowerCase());

      // 2. Station
      const matchesStation = selectedStation === "Tous" || l.station === selectedStation;

      // 3. Taux Min / Max
      const valTaux = l.taux_livraison;
      const minT = tauxMin === "" ? -1 : parseFloat(tauxMin);
      const maxT = tauxMax === "" ? 101 : parseFloat(tauxMax);
      const matchesTaux = valTaux >= minT && valTaux <= maxT;

      // 4. Dispatches Min
      const minD = dispMin === "" ? -1 : parseInt(dispMin, 10);
      const matchesDisp = l.dispatches >= minD;

      // 5. Performance
      const perf = getPerfCategory(l.taux_livraison);
      const matchesPerf = selectedPerf === "Tous" || perf === selectedPerf;

      return matchesSearch && matchesStation && matchesTaux && matchesDisp && matchesPerf;
    });
  }, [data, searchText, selectedStation, tauxMin, tauxMax, dispMin, selectedPerf]);

  // Trier les données
  const sortedAndFilteredData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      // String comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortAsc ? -1 : 1;
      if (strA > strB) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortField, sortAsc]);

  // Déclencher le changement de tri
  const handleSort = (field: keyof LivreurRecap) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Rendu de bouton de tri pour l'en-tête
  const renderSortIndicator = (field: keyof LivreurRecap) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300 opacity-60 flex-shrink-0" />;
    return sortAsc 
      ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-orange-400 font-bold flex-shrink-0" />
      : <ChevronDown className="w-3.5 h-3.5 ml-1 text-orange-400 font-bold flex-shrink-0" />;
  };

  // Helper de couleur pour Taux Livraison
  const getTauxDeliveryStyle = (tx: number) => {
    if (tx >= 80) return "text-emerald-600 font-bold font-mono";
    if (tx >= 65) return "text-[#1B3A5C] font-semibold font-mono";
    return "text-red-600 font-bold font-mono";
  };

  // Helper de couleur pour Taux de retour
  const getTauxRetourStyle = (tx: number) => {
    if (tx < 10) return "text-emerald-600 font-medium font-mono";
    if (tx < 20) return "text-[#1B3A5C] font-mono";
    if (tx < 30) return "text-orange-600 font-semibold font-mono";
    return "text-red-600 font-bold font-mono";
  };

  // Helper de couleur pour SOC (Score Opérationnel Composite)
  const getSOCStyle = (soc: number) => {
    if (soc >= 80) return "text-emerald-600 font-extrabold font-mono";
    if (soc >= 60) return "text-[#1B3A5C] font-bold font-mono";
    if (soc >= 40) return "text-orange-600 font-semibold font-mono";
    return "text-red-600 font-bold font-mono";
  };

  // Helper de couleur pour Délais (heures)
  const getDelaiStyle = (val: number) => {
    if (val === 0) return "text-slate-400 font-mono";
    if (val <= 24) return "text-emerald-600 font-semibold font-mono";
    if (val <= 48) return "text-[#1B3A5C] font-mono";
    if (val <= 72) return "text-orange-500 font-semibold font-mono";
    return "text-red-650 text-red-600 font-bold font-mono";
  };

  // Déterminer la couleur de badge de performance
  const renderPerfBadge = (tx: number) => {
    const cat = getPerfCategory(tx);
    switch (cat) {
      case "Excellent":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Excellent</span>;
      case "Bon":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-[#1B3A5C] border border-[#1B3A5C]/20">Bon</span>;
      case "Moyen":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-[#E8741A] border border-orange-200">Moyen</span>;
      case "Faible":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">Faible</span>;
    }
  };

  // activeFiltersDescription calc
  const activeFiltersDescription = useMemo(() => {
    return [
      searchText && `recherche: "${searchText}"`,
      selectedStation !== "Tous" && `station: ${selectedStation}`,
      tauxMin && `taux min: ${tauxMin}%`,
      tauxMax && `taux max: ${tauxMax}%`,
      dispMin && `dispatches min: ${dispMin}`,
      selectedPerf !== "Tous" && `perf: ${selectedPerf}`
    ].filter(Boolean).join(", ") || "Aucun filtre";
  }, [searchText, selectedStation, tauxMin, tauxMax, dispMin, selectedPerf]);

  return (
    <div className="space-y-4">
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            👤 Suivi Individuel des Livreurs
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Analyse granulaire et filtrage de la flotte de drivers</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportLivreursExcel(sortedAndFilteredData, activeFiltersDescription);
              triggerLocalToast("✅ Export Excel généré");
            }}
            disabled={sortedAndFilteredData.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              sortedAndFilteredData.length === 0
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-250 text-slate-400"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
            }`}
          >
            <TableIcon size={13} /> Excel
          </motion.button>

          {/* PDF Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportLivreursPdf(sortedAndFilteredData, activeFiltersDescription);
              triggerLocalToast("✅ Rapport PDF généré");
            }}
            disabled={sortedAndFilteredData.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              sortedAndFilteredData.length === 0
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-250 text-slate-400"
                : "border-orange-300 bg-orange-50 text-[#E8741A] hover:bg-orange-100 cursor-pointer"
            }`}
          >
            <FileText size={13} /> PDF
          </motion.button>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-5 space-y-5">
      {/* 1. Barre de filtres */}
      <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 space-y-3">
        <div className="flex items-center space-x-2 pb-1.5 border-b border-[#DDE3EE]/50">
          <SlidersHorizontal className="w-4 h-4 text-[#1B3A5C]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B3A5C] font-sans">Filtres et Options de Recherche</h4>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {/* Recherche texte */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Recherche</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nom, station..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-sans font-medium"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Station dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Station Destination</label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full px-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-sans font-medium"
            >
              {stationsList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Taux min */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tx Livraison Min (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Ex: 80"
              value={tauxMin}
              onChange={(e) => setTauxMin(e.target.value)}
              className="w-full px-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-mono font-medium"
            />
          </div>

          {/* Taux max */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tx Livraison Max (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Ex: 95"
              value={tauxMax}
              onChange={(e) => setTauxMax(e.target.value)}
              className="w-full px-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-mono font-medium"
            />
          </div>

          {/* Dispatches min */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Dispatches Min</label>
            <input
              type="number"
              min="0"
              placeholder="Ex: 50"
              value={dispMin}
              onChange={(e) => setDispMin(e.target.value)}
              className="w-full px-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-mono font-medium"
            />
          </div>

          {/* Performance badge dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Niveau Performance</label>
            <select
              value={selectedPerf}
              onChange={(e) => setSelectedPerf(e.target.value)}
              className="w-full px-2 py-1.5 text-xs glass-input rounded-lg focus:outline-none font-sans font-medium"
            >
              <option value="Tous">Tous</option>
              <option value="Excellent">Excelent (≥ 90%)</option>
              <option value="Bon">Bon (75-90%)</option>
              <option value="Moyen">Moyen (60-75%)</option>
              <option value="Faible">Faible ({"<"} 60%)</option>
            </select>
          </div>
        </div>

        {/* Bouton de reset et Compteur */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-[11px] font-semibold text-slate-600 font-sans">
            🔥 <span className="font-mono text-xs">{sortedAndFilteredData.length}</span> résultat(s) trouvé(s) sur <span className="font-mono text-xs">{data.recap.length}</span> livreurs
          </span>
          <button
            onClick={handleResetFilters}
            className="flex items-center px-3 py-1.5 text-xs font-semibold text-[#1B3A5C] bg-white/20 border border-white/30 rounded-lg hover:bg-white/40 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* 2a. Tableau 1/2 : identité et performance */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Identité &amp; Performance</p>
        <div className="border border-white/20 rounded-xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
            <table className="w-full text-left border-collapse min-w-[1100px] text-xs font-sans">
              <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-3 w-12 text-center select-none">#</th>
                  <th className="px-4 py-3 min-w-[180px] cursor-pointer select-none" onClick={() => handleSort("livreur")}>
                    <div className="flex items-center">Livreur {renderSortIndicator("livreur")}</div>
                  </th>
                  <th className="px-4 py-3 min-w-[180px] cursor-pointer select-none" onClick={() => handleSort("station")}>
                    <div className="flex items-center">Station {renderSortIndicator("station")}</div>
                  </th>
                  <th className="px-3 py-3 w-28 cursor-pointer text-center select-none" onClick={() => handleSort("taux_livraison")}>
                    <div className="flex items-center justify-center">Performance {renderSortIndicator("taux_livraison")}</div>
                  </th>
                  <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("dispatches")}>
                    <div className="flex items-center justify-end">Dispatchs {renderSortIndicator("dispatches")}</div>
                  </th>
                  <th className="px-4 py-3 min-w-[150px] cursor-pointer select-none" onClick={() => handleSort("livres")}>
                    <div className="flex items-center">Livrés (Minibar) {renderSortIndicator("livres")}</div>
                  </th>
                  <th className="px-3 py-3 w-28 cursor-pointer text-center select-none" onClick={() => handleSort("taux_livraison")}>
                    <div className="flex items-center justify-center">Tx Livr. % {renderSortIndicator("taux_livraison")}</div>
                  </th>
                  <th className="px-3 py-3 w-32 cursor-pointer text-center select-none bg-indigo-900/40 border-l border-indigo-200/20" onClick={() => handleSort("soc")}>
                    <div className="flex items-center justify-center font-bold text-indigo-200">📊 SOC {renderSortIndicator("soc")}</div>
                  </th>
                  <th className="px-3 py-3 w-20 cursor-pointer text-right select-none" onClick={() => handleSort("retours")}>
                    <div className="flex items-center justify-end">Retours {renderSortIndicator("retours")}</div>
                  </th>
                  <th className="px-3 py-3 w-28 cursor-pointer text-center select-none" onClick={() => handleSort("taux_retour")}>
                    <div className="flex items-center justify-center">Tx Ret. % {renderSortIndicator("taux_retour")}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EE]/60 text-slate-800 font-medium">
                {sortedAndFilteredData.map((l, index) => {
                  // Déterminer la couleur de la ligne selon la spécification
                  // "Couleur ligne : vert pâle si ≥90%, rouge pâle si <60%"
                  let rowBg = "hover:bg-slate-50/70 transition-colors";
                  if (l.taux_livraison >= 90) {
                    rowBg = "bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors";
                  } else if (l.taux_livraison < 60) {
                    rowBg = "bg-red-50/30 hover:bg-red-50/50 transition-colors";
                  }

                  // Volume max pour calculer le % d'occupation de la minibar
                  const percentVolume = l.dispatches > 0 ? (l.livres / l.dispatches) * 100 : 0;

                  // Animation désactivée si prefersReduced ou index >= 50 pour performance
                  const animateRow = !prefersReduced && index < 50;

                  return (
                    <motion.tr
                      key={l.id}
                      className={`${rowBg} cursor-pointer`}
                      onClick={() => setDetailLivreur(l)}
                      title="Voir la fiche détaillée (colis, expéditeurs, communes)"
                      initial={animateRow ? { opacity: 0, x: -8 } : false}
                      animate={animateRow ? { opacity: 1, x: 0 } : false}
                      transition={animateRow ? { delay: index * 0.015, duration: 0.25 } : undefined}
                    >
                      {/* Index / Rang */}
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                        {index + 1}
                      </td>
                      {/* Nom livreur */}
                      <td className="px-4 py-2.5 font-bold text-[#1B3A5C] truncate max-w-[180px] underline decoration-dotted decoration-slate-300 underline-offset-2">
                        {l.livreur}
                      </td>
                      {/* Station */}
                      <td className="px-4 py-2.5 font-medium text-slate-600 truncate max-w-[180px]">
                        {l.station}
                      </td>
                      {/* Badge Performance */}
                      <td className="px-3 py-2.5 text-center">
                        {renderPerfBadge(l.taux_livraison)}
                      </td>
                      {/* Total dispatchés */}
                      <td className="px-3 py-2.5 text-right font-mono text-[#1B3A5C]">
                        {N(l.dispatches)}
                      </td>
                      {/* Livrés (Mini barre de progression) */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-emerald-600 w-10 text-right">{N(l.livres)}</span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${percentVolume}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Taux livraison */}
                      <td className={`px-3 py-2.5 text-center ${getTauxDeliveryStyle(l.taux_livraison)}`}>
                        {P(l.taux_livraison)}
                      </td>
                      {/* SOC Composite with tricolore progress indicator and clear breakdown tooltip on hover */}
                      <td
                        className="px-3 py-2 bg-indigo-50/5 border-l border-indigo-200/10 text-center"
                        title={`Taux Livraison : ${l.soc_taux.toFixed(1)}/30 · Rapidité : ${l.soc_rapidite.toFixed(1)}/20 · Encaissement : ${l.soc_enc.toFixed(1)}/50`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span className={`font-mono font-bold ${getSOCStyle(l.soc)} text-xs`}>
                            {l.soc.toFixed(1)}
                          </span>
                          <div className="flex h-1 w-16 rounded-full overflow-hidden bg-slate-200 border border-slate-300/30">
                            <div style={{ width: `${(l.soc_taux / 30) * 100}%` }} className="bg-indigo-600 h-full" />
                            <div style={{ width: `${(l.soc_rapidite / 20) * 100}%` }} className="bg-amber-500 h-full" />
                            <div style={{ width: `${(l.soc_enc / 50) * 100}%` }} className="bg-emerald-500 h-full" />
                          </div>
                        </div>
                      </td>
                      {/* Retours */}
                      <td className="px-3 py-2.5 text-right font-mono text-red-600">
                        {N(l.retours)}
                      </td>
                      {/* Taux retour */}
                      <td className={`px-3 py-2.5 text-center ${getTauxRetourStyle(l.taux_retour)}`}>
                        {P(l.taux_retour)}
                      </td>
                    </motion.tr>
                  );
                })}

                {sortedAndFilteredData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-450 font-semibold text-slate-500 font-sans">
                      🚫 Aucun livreur ne correspond aux filtres de recherche. Veuillez réinitialiser les filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2b. Tableau 2/2 : délais, opérations et montants (Livreur/Station répétés pour repère,
          car c'est un tableau indépendant du premier — même ordre de lignes) */}
      {sortedAndFilteredData.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Délais, Opérations &amp; Montants</p>
          <div className="border border-white/20 rounded-xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
              <table className="w-full text-left border-collapse min-w-[1400px] text-xs font-sans">
                <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="px-3 py-3 w-12 text-center select-none">#</th>
                    <th className="px-4 py-3 min-w-[180px] cursor-pointer select-none" onClick={() => handleSort("livreur")}>
                      <div className="flex items-center">Livreur {renderSortIndicator("livreur")}</div>
                    </th>
                    <th className="px-3 py-3 w-28 cursor-pointer text-right select-none" onClick={() => handleSort("delai_moy_h")}>
                      <div className="flex items-center justify-end">Délai Disp.(h) {renderSortIndicator("delai_moy_h")}</div>
                    </th>
                    <th className="px-3 py-3 w-28 cursor-pointer text-right select-none" onClick={() => handleSort("delai_fdr_h")}>
                      <div className="flex items-center justify-end">Délai FDR(h) {renderSortIndicator("delai_fdr_h")}</div>
                    </th>
                    <th className="px-3 py-3 w-28 cursor-pointer text-right select-none" onClick={() => handleSort("delai_enc_h")}>
                      <div className="flex items-center justify-end">Délai Enc.(h) {renderSortIndicator("delai_enc_h")}</div>
                    </th>
                    <th className="px-3 py-3 w-20 cursor-pointer text-right select-none" onClick={() => handleSort("jours_actifs")}>
                      <div className="flex items-center justify-end">J. Actifs {renderSortIndicator("jours_actifs")}</div>
                    </th>
                    <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("moy_colis_jour")}>
                      <div className="flex items-center justify-end">Moy./Jour {renderSortIndicator("moy_colis_jour")}</div>
                    </th>
                    <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("domicile")}>
                      <div className="flex items-center justify-end">Domicile {renderSortIndicator("domicile")}</div>
                    </th>
                    <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("stop_desk")}>
                      <div className="flex items-center justify-end">Stop Desk {renderSortIndicator("stop_desk")}</div>
                    </th>
                    <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("echanges")}>
                      <div className="flex items-center justify-end">Échanges {renderSortIndicator("echanges")}</div>
                    </th>
                    <th className="px-3 py-3 w-20 cursor-pointer text-right select-none" onClick={() => handleSort("wilayas")}>
                      <div className="flex items-center justify-end">Wilayas {renderSortIndicator("wilayas")}</div>
                    </th>
                    <th className="px-3 py-3 w-24 cursor-pointer text-right select-none" onClick={() => handleSort("communes")}>
                      <div className="flex items-center justify-end">Communes {renderSortIndicator("communes")}</div>
                    </th>
                    <th className="px-4 py-3 min-w-[120px] cursor-pointer text-right select-none" onClick={() => handleSort("remun")}>
                      <div className="flex items-center justify-end">Rémun.(DA) {renderSortIndicator("remun")}</div>
                    </th>
                    <th className="px-4 py-3 min-w-[150px] cursor-pointer text-right select-none" onClick={() => handleSort("montant_enc")}>
                      <div className="flex items-center justify-end">Montant Enc. {renderSortIndicator("montant_enc")}</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EE]/60 text-slate-800 font-medium">
                  {sortedAndFilteredData.map((l, index) => {
                    let rowBg = "hover:bg-slate-50/70 transition-colors";
                    if (l.taux_livraison >= 90) {
                      rowBg = "bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors";
                    } else if (l.taux_livraison < 60) {
                      rowBg = "bg-red-50/30 hover:bg-red-50/50 transition-colors";
                    }
                    const animateRow = !prefersReduced && index < 50;

                    return (
                      <motion.tr
                        key={l.id}
                        className={`${rowBg} cursor-pointer`}
                        onClick={() => setDetailLivreur(l)}
                        title="Voir la fiche détaillée (colis, expéditeurs, communes)"
                        initial={animateRow ? { opacity: 0, x: -8 } : false}
                        animate={animateRow ? { opacity: 1, x: 0 } : false}
                        transition={animateRow ? { delay: index * 0.015, duration: 0.25 } : undefined}
                      >
                        {/* Index / Rang (répété pour repère avec le 1er tableau) */}
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                          {index + 1}
                        </td>
                        {/* Nom livreur (répété pour repère) */}
                        <td className="px-4 py-2.5 font-bold text-[#1B3A5C] truncate max-w-[180px]">
                          {l.livreur}
                        </td>
                        {/* Délai Disp */}
                        <td className={`px-3 py-2.5 text-right ${getDelaiStyle(l.delai_moy_h)}`}>
                          {l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–"}
                        </td>
                        {/* Délai FDR */}
                        <td className={`px-3 py-2.5 text-right ${getDelaiStyle(l.delai_fdr_h)}`}>
                          {l.delai_fdr_h > 0 ? `${F(l.delai_fdr_h)}h` : "–"}
                        </td>
                        {/* Délai Enc */}
                        <td className={`px-3 py-2.5 text-right ${getDelaiStyle(l.delai_enc_h)}`}>
                          {l.delai_enc_h > 0 ? `${F(l.delai_enc_h)}h` : "–"}
                        </td>
                        {/* Jours actifs */}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {N(l.jours_actifs)}
                        </td>
                        {/* Moy Colis/Jour */}
                        <td className="px-3 py-2.5 text-right font-mono text-[#1B3A5C]">
                          {F(l.moy_colis_jour)}
                        </td>
                        {/* Domicile */}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {N(l.domicile)}
                        </td>
                        {/* Stop desk */}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {N(l.stop_desk)}
                        </td>
                        {/* Echanges */}
                        <td className="px-3 py-2.5 text-right font-mono text-amber-600">
                          {N(l.echanges)}
                        </td>
                        {/* Wilayas */}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {N(l.wilayas)}
                        </td>
                        {/* Communes */}
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                          {N(l.communes)}
                        </td>
                        {/* Rémunération */}
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-700">
                          {N(l.remun)} <span className="text-[9px] font-medium text-slate-400">DA</span>
                        </td>
                        {/* Montant encaissé */}
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          {N(l.montant_enc)} <span className="text-[9px] font-medium text-slate-400">DA</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notificateur Local */}
      <AnimatePresence>
        {localToast && (
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-2 bg-slate-900 text-white min-w-[280px] border border-slate-800"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold font-sans">{localToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fiche détaillée du livreur sélectionné */}
      <AnimatePresence>
        {detailLivreur && (
          <LivreurDetailModal
            snapshotId={snapshotId}
            livreur={detailLivreur}
            onClose={() => setDetailLivreur(null)}
          />
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
