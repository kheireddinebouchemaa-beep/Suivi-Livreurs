import { useState, useEffect, useCallback, useMemo } from "react";
import { AppData } from "./types";
import OverviewTab from "./components/OverviewTab";
import LivreursTab from "./components/LivreursTab";
import RetoursTab from "./components/RetoursTab";
import DelaisTab from "./components/DelaisTab";
import PerformanceTab from "./components/PerformanceTab";
import StationsTab from "./components/StationsTab";
import ExpediteursTab from "./components/ExpediteursTab";
import ZonesTab from "./components/ZonesTab";
import LignesIgnoreesTab from "./components/LignesIgnoreesTab";
import ImportModal from "./components/ImportModal";
import PdfModal from "./components/PdfModal";
import AlertsPanel from "./components/AlertsPanel";
import SettingsModal from "./components/SettingsModal";
import { AlertTriangle, Upload, FileText, CheckCircle2, Info, Loader2, Settings, Inbox } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { getLatestSnapshot, getSnapshot, listSnapshots, saveSnapshot, getThresholds, Threshold } from "./lib/api";
import { computeAlerts, computeDegradations } from "./lib/alerts";
import { computeTrends } from "./lib/trends";
import { generateResume } from "./lib/summary";

export default function App() {
  const [bootLoading, setBootLoading] = useState<boolean>(true);

  // Données : null tant qu'aucun snapshot n'est chargé (pas de données de démonstration)
  const [data, setData] = useState<AppData | null>(null);
  const [previousData, setPreviousData] = useState<AppData | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [thresholdsLoaded, setThresholdsLoaded] = useState<boolean>(false);

  // Barre de navigation
  const [selectedPage, setSelectedPage] = useState<string>("overview");

  // Modales & Notifications
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });

  // Horloge de la barre d'en-tête (HH:MM:SS)
  const [currentTime, setCurrentTime] = useState<string>("");

  // Détection prefers-reduced-motion
  const [prefersReduced, setPrefersReduced] = useState<boolean>(false);

  // Déclencher un Toast temporaire
  const triggerToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 4500);
  }, []);

  // ── Charger le dernier snapshot + le précédent (pour les dégradations) + les seuils ──
  useEffect(() => {
    (async () => {
      setBootLoading(true);
      try {
        const snapshot = await getLatestSnapshot();
        setData(snapshot.data);
        setFileName(snapshot.file_name);
        setSnapshotId(snapshot.id);

        // Snapshot précédent : sert à détecter les livreurs en forte baisse
        try {
          const all = await listSnapshots();
          const idx = all.findIndex((s) => s.id === snapshot.id);
          const prevMeta = idx >= 0 ? all[idx + 1] : all[1];
          if (prevMeta) {
            const prevSnapshot = await getSnapshot(prevMeta.id);
            setPreviousData(prevSnapshot.data);
          }
        } catch {
          // silencieux : pas de comparaison possible, les alertes de seuils restent actives
        }
      } catch {
        // Pas de snapshot en base : écran vide, en attente d'un premier import
      }
      try {
        const t = await getThresholds();
        setThresholds(t);
        setThresholdsLoaded(true);
      } catch {
        // silencieux : le panneau d'alertes se masque simplement
      }
      setBootLoading(false);
    })();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("fr-DZ", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Alertes : seuils (triées par gravité) + dégradations vs import précédent ──
  const alerts = useMemo(
    () => (data ? computeAlerts(data.recap, thresholds) : []),
    [data, thresholds]
  );
  const degradations = useMemo(
    () => (data && previousData && previousData.recap.length > 0 ? computeDegradations(data.recap, previousData.recap) : []),
    [data, previousData]
  );
  const totalAlertCount = alerts.length + degradations.length;

  // ── Tendances vs snapshot précédent + résumé en langage naturel (Niveau 1 de l'écran d'accueil) ──
  const tendances = useMemo(
    () => (data ? computeTrends(data, previousData) : []),
    [data, previousData]
  );
  const resumeNaturel = useMemo(
    () => (data ? generateResume(data, tendances, totalAlertCount) : ""),
    [data, tendances, totalAlertCount]
  );

  // Traiter le résultat de l'agrégation (avant l'upload du détail ligne par ligne) :
  // le dashboard s'affiche immédiatement, la modale reste ouverte pour uploader le détail.
  // Retourne l'ID du nouveau snapshot (ou null si la sauvegarde a échoué) pour que la modale
  // sache où rattacher les lignes brutes.
  const handleAggregated = async (newData: AppData, importedFileName: string): Promise<string | null> => {
    // L'ancien jeu de données devient la référence de comparaison
    if (data) setPreviousData(data);
    setData(newData);
    setFileName(importedFileName);
    setSelectedPage("overview");
    const skipped = newData.global.lignes_ignorees_sans_livreur + newData.global.lignes_ignorees_sans_dispatch;
    const skippedNote = skipped > 0
      ? ` (${skipped.toLocaleString('fr-DZ')} lignes ignorées : sans livreur ou jamais dispatchées — voir Vue d'ensemble)`
      : "";
    triggerToast(`✅ ${newData.global.total_dispatches.toLocaleString('fr-DZ')} colis chargés avec succès !${skippedNote}`, "success");

    try {
      const saved = await saveSnapshot(importedFileName, newData, "import");
      setSnapshotId(saved.id);
      return saved.id;
    } catch (err: any) {
      triggerToast(`⚠️ Import affiché mais non sauvegardé en base : ${err.message}`, "error");
      return null;
    }
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#E8741A]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#1B3A5C] pb-12 flex flex-col antialiased relative overflow-hidden">

      {/* Decorative blurred background blobs for Frosted Glass effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[5%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-300/12 blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-[#E8741A]/10 blur-[150px]" />
        <div className="absolute top-[45%] right-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-emerald-300/8 blur-[110px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-grow min-h-screen">
        {/* HEADER STICKY (Navy 56px de hauteur) d'après les instructions */}
        <header className="sticky top-0 z-40 glass-header text-white shadow-md select-none h-14 flex items-center px-4 md:px-6 justify-between border-b border-[#E8741A]">
          {/* Logo IMIR + Titre */}
          <div className="flex items-center space-x-3 min-w-0">
            {/* Logo carré orange 32x32px, radius 8px d'après l'instruction */}
            <div className="w-8 h-8 rounded-lg bg-[#E8741A] flex items-center justify-center flex-shrink-0 shadow-sm border border-orange-400">
              <span className="text-white font-extrabold text-[12px] font-mono tracking-tighter">IM</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs md:text-sm font-bold tracking-tight truncate font-sans">IMIR Logistics</h1>
              <p className="text-[9px] text-slate-350 font-medium truncate tracking-wide text-slate-300">OPERATIONAL DRIVER PERFORMANCE SYSTEM</p>
            </div>
          </div>

          {/* Section Actions de centre (Status d'import et boutons complémentaires) */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Badge compteur d'alertes — visible depuis tous les onglets */}
            {data && totalAlertCount > 0 && (
              <button
                onClick={() => { setSelectedPage("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                title="Voir les alertes"
                className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1.5 bg-red-950/70 text-red-300 border border-red-500/40 hover:bg-red-900/70 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>{totalAlertCount} alerte{totalAlertCount > 1 ? "s" : ""}</span>
              </button>
            )}

            {/* Badge d'état de la source d'information */}
            {data && (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 border bg-emerald-950/70 text-emerald-300 border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="truncate max-w-[170px] font-medium text-white">{fileName}</span>
              </div>
            )}

            {/* Import Excel */}
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm border border-emerald-500 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>EXCEL</span>
            </button>

            {/* Export PDF */}
            {data && (
              <button
                onClick={() => setShowPdfModal(true)}
                className="px-3 py-1 bg-[#E8741A] hover:bg-[#cf620f] text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm border border-orange-500 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF rapport</span>
              </button>
            )}

            {/* Réglages des seuils */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title="Réglages des seuils d'alerte"
              className="p-1.5 bg-slate-800/80 border border-slate-700/50 rounded-md hover:bg-slate-700 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Header Buttons */}
          <div className="flex sm:hidden items-center space-x-2">
            {data && totalAlertCount > 0 && (
              <button
                onClick={() => { setSelectedPage("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="px-1.5 py-1 bg-red-950/80 border border-red-500/40 rounded-md flex items-center space-x-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-bold text-red-300">{totalAlertCount}</span>
              </button>
            )}
            <button onClick={() => setShowImportModal(true)} className="p-1.5 bg-emerald-600 rounded-md">
              <Upload className="w-4 h-4" />
            </button>
            {data && (
              <button onClick={() => setShowPdfModal(true)} className="p-1.5 bg-[#E8741A] rounded-md">
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowSettingsModal(true)} className="p-1.5 bg-slate-800 rounded-md">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Horloge d'en-tête */}
          <div className="text-xs font-mono font-bold tracking-widest text-[#F5A623] pl-2 border-l border-white/10 hidden md:block">
            {currentTime || "00:00:00"}
          </div>
        </header>

        {/* NAV BAR BLANCHE REFAITE EN GLASSMORTPHISM */}
        {data && (
          <nav className="glass-nav sticky top-14 z-30 overflow-x-auto custom-scrollbar shadow-xs select-none">
            <div className="max-w-7xl mx-auto px-4 flex space-x-6 min-w-[700px]">
              {[
                { id: "overview", label: "📊 Vue d'ensemble", count: null },
                { id: "livreurs", label: `👤 Livreurs`, count: data.recap.length },
                { id: "retours", label: "↩️ Retours & Incidents", count: null },
                { id: "delais", label: "⏱️ Délais de transit", count: null },
                { id: "performance", label: "🏆 Classement SOC", count: null },
                { id: "stations", label: "🏢 Par Station", count: null },
                { id: "expediteurs", label: "📦 Expéditeurs", count: null },
                { id: "zones", label: "🗺️ Zones", count: null },
                { id: "lignes-ignorees", label: "🔍 Lignes ignorées", count: data.global.lignes_ignorees_sans_livreur + data.global.lignes_ignorees_sans_dispatch }
              ].map((tab) => {
                const isActive = selectedPage === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedPage(tab.id)}
                    className={`py-3.5 text-xs font-medium relative flex items-center font-sans tracking-wide transition-colors cursor-pointer ${
                      isActive
                        ? "font-extrabold text-[#1B3A5C]"
                        : "text-slate-600 hover:text-[#1B3A5C]"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                        isActive ? "bg-[#1B3A5C] text-white/90" : "bg-slate-200/90 text-slate-700"
                      }`}>
                        {tab.count}
                      </span>
                    )}

                    {/* Soulignement orange d'après les consignes */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8741A]"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* CORP PRINCIPAL (CONTENEUR LIMITÉ À 7XL) */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6 flex-1 w-full box-border">

          {/* Écran vide : aucun snapshot en base, en attente du premier import */}
          {!data && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/60 border border-slate-200 shadow-sm flex items-center justify-center mb-5">
                <Inbox className="w-10 h-10 text-slate-400" />
              </div>
              <h2 className="text-base font-bold text-[#1B3A5C] mb-2">Aucune donnée pour le moment</h2>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
                Importez un export ECOTRACK v3.11 (Excel ou CSV) pour générer le dashboard KPI des livreurs du réseau IMIR.
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-2 shadow-md cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importer un export ECOTRACK</span>
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Affichage informatif de démarrage mobile sur la source */}
              <div className="sm:hidden mb-4 bg-slate-800/85 text-slate-200 p-2.5 rounded-lg text-[10px] flex items-center justify-between shadow-xs">
                <span className="truncate">📁 {fileName}</span>
              </div>

              {/* Panneau d'alertes KPI — visible sur toutes les pages */}
              <AlertsPanel
                alerts={alerts}
                degradations={degradations}
                thresholdsLoaded={thresholdsLoaded}
                onSelectLivreur={() => setSelectedPage("livreurs")}
              />

              {/* Transition de page animée */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedPage}
                  initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -16 }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
                  className="w-full"
                >
                  {selectedPage === "overview" && (
                    <OverviewTab
                      data={data}
                      snapshotId={snapshotId}
                      tendances={tendances}
                      resumeNaturel={resumeNaturel}
                      nbAlertes={totalAlertCount}
                      onNavigateToLivreurs={() => setSelectedPage("livreurs")}
                      onNavigateToRetours={() => setSelectedPage("retours")}
                      onNavigateToDelais={() => setSelectedPage("delais")}
                      onNavigateToLignesIgnorees={() => setSelectedPage("lignes-ignorees")}
                    />
                  )}

                  {selectedPage === "livreurs" && (
                    <LivreursTab data={data} snapshotId={snapshotId} />
                  )}

                  {selectedPage === "retours" && (
                    <RetoursTab data={data} />
                  )}

                  {selectedPage === "delais" && (
                    <DelaisTab data={data} />
                  )}

                  {selectedPage === "performance" && (
                    <PerformanceTab data={data} />
                  )}

                  {selectedPage === "stations" && (
                    <StationsTab data={data} />
                  )}

                  {selectedPage === "expediteurs" && (
                    <ExpediteursTab data={data} />
                  )}

                  {selectedPage === "zones" && (
                    <ZonesTab data={data} />
                  )}

                  {selectedPage === "lignes-ignorees" && (
                    <LignesIgnoreesTab data={data} snapshotId={snapshotId} />
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </main>

        {/* FOOTER */}
        <footer className="max-w-7xl mx-auto px-4 md:px-6 mt-12 pt-6 border-t border-[#DDE3EE] w-full text-center md:flex md:justify-between text-[11px] text-[#6B7A99] font-medium box-border">
          <p className="font-sans">IMIR Logistics © {new Date().getFullYear()} — Direction des Méthodes &amp; Procédures.</p>
          <p className="mt-1 md:mt-0 font-sans flex items-center justify-center">
            <Info className="w-3.5 h-3.5 mr-1" />
            Suivi-Livreurs — synchronisé avec la base IMIR (Supabase).
          </p>
        </footer>

        {/* TOAST NOTIFICATEUR */}
        <AnimatePresence>
          {toast.message && (
            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
              className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-2 bg-slate-900 text-white min-w-[280px] border border-slate-800"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-semibold font-sans">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODALES D'ACTIONS */}
        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onAggregated={handleAggregated}
            onRawRowsUploadResult={({ totalBatches, failedBatches }) => {
              if (failedBatches === 0) return;
              const complet = totalBatches - failedBatches;
              triggerToast(
                `⚠️ Détail ligne par ligne partiellement sauvegardé (${complet}/${totalBatches} lots) : le drill-down sera incomplet pour certains colis de cet import.`,
                "error"
              );
            }}
          />
        )}

        {showPdfModal && data && (
          <PdfModal
            data={data}
            onClose={() => setShowPdfModal(false)}
            onShowToast={triggerToast}
          />
        )}

        {showSettingsModal && (
          <SettingsModal
            thresholds={thresholds}
            onClose={() => setShowSettingsModal(false)}
            onSaved={(updated) => setThresholds(updated)}
          />
        )}

      </div>
    </div>
  );
}
