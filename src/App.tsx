import { useState, useEffect } from "react";
import { AppData } from "./types";
import { generateDemoData } from "./data";
import OverviewTab from "./components/OverviewTab";
import LivreursTab from "./components/LivreursTab";
import RetoursTab from "./components/RetoursTab";
import DelaisTab from "./components/DelaisTab";
import PerformanceTab from "./components/PerformanceTab";
import StationsTab from "./components/StationsTab";
import ImportModal from "./components/ImportModal";
import PdfModal from "./components/PdfModal";
import { BarChart3, Users, AlertTriangle, Clock, Trophy, Map, Upload, FileText, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export default function App() {
  // Chargement des données initiales de démonstration
  const [data, setData] = useState<AppData>(() => generateDemoData());
  const [fileName, setFileName] = useState<string>("Données de démonstration (Avril 2026)");
  const [isDemo, setIsDemo] = useState<boolean>(true);

  // Barre de navigation
  const [selectedPage, setSelectedPage] = useState<string>("overview");

  // Modales & Notifications
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });

  // Horloge de la barre d'en-tête (HH:MM:SS)
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("fr-DZ", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Déclencher un Toast temporaire
  const triggerToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: null });
    }, 4500);
  };

  // Traiter le succès de l'import Excel
  const handleImportSuccess = (newData: AppData, importedFileName: string) => {
    setData(newData);
    setFileName(importedFileName);
    setIsDemo(false);
    setShowImportModal(false);
    setSelectedPage("overview"); // Rediriger logiquement vers la synthèse
    triggerToast(`✅ ${newData.global.total_dispatches.toLocaleString('fr-DZ')} colis chargés avec succès ! Dashboard mis à jour.`, "success");
  };

  // Recharger le jeu de données pour réinitialiser
  const handleRestoreDemoData = () => {
    if (window.confirm("Voulez-vous restaurer les données de démonstration d'Avril 2026 ?")) {
      setData(generateDemoData());
      setFileName("Données de démonstration (Avril 2026)");
      setIsDemo(true);
      setSelectedPage("overview");
      triggerToast("✅ Données de démonstration restaurées.", "success");
    }
  };

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
            {/* Badge d'état de la source d'information */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center space-x-1 border ${
              isDemo 
                ? "bg-slate-800/85 text-slate-350 border-slate-700/50" 
                : "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-[#F5A623]" : "bg-emerald-400 animate-pulse"}`}></span>
              <span className="truncate max-w-[170px] font-medium text-white">{fileName}</span>
            </div>

            {/* Bouton de reset si données réelles pour simplifier les tests */}
            {!isDemo && (
              <button
                onClick={handleRestoreDemoData}
                title="Restaurer la Démo Avril 2026"
                className="p-1 px-2 text-[10px] bg-slate-800/80 border border-slate-700/50 rounded-md hover:bg-slate-700 flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>DÉMO</span>
              </button>
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
            <button
              onClick={() => setShowPdfModal(true)}
              className="px-3 py-1 bg-[#E8741A] hover:bg-[#cf620f] text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 shadow-sm border border-orange-500 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF rapport</span>
            </button>
          </div>

          {/* Mobile Header Buttons */}
          <div className="flex sm:hidden items-center space-x-2">
            <button onClick={() => setShowImportModal(true)} className="p-1.5 bg-emerald-600 rounded-md">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPdfModal(true)} className="p-1.5 bg-[#E8741A] rounded-md">
              <FileText className="w-4 h-4" />
            </button>
          </div>

          {/* Horloge d'en-tête */}
          <div className="text-xs font-mono font-bold tracking-widest text-[#F5A623] pl-2 border-l border-white/10 hidden md:block">
            {currentTime || "00:00:00"}
          </div>
        </header>

        {/* NAV BAR BLANCHE REFAITE EN GLASSMORTPHISM */}
        <nav className="glass-nav sticky top-14 z-30 overflow-x-auto custom-scrollbar shadow-xs select-none">
          <div className="max-w-7xl mx-auto px-4 flex space-x-6 min-w-[700px]">
            {[
              { id: "overview", label: "📊 Vue d'ensemble", count: null },
              { id: "livreurs", label: `👤 Livreurs`, count: data.recap.length },
              { id: "retours", label: "↩️ Retours & Incidents", count: null },
              { id: "delais", label: "⏱️ Délais de transit", count: null },
              { id: "performance", label: "🏆 Classement SOC", count: null },
              { id: "stations", label: "🏢 Par Station", count: null }
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

        {/* CORP PRINCIPAL (CONTENEUR LIMITÉ À 7XL) */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6 flex-1 w-full box-border">
          
          {/* Affichage informatif de démarrage mobile sur la source */}
          <div className="sm:hidden mb-4 bg-slate-800/85 text-slate-200 p-2.5 rounded-lg text-[10px] flex items-center justify-between shadow-xs">
            <span className="truncate">📁 {fileName}</span>
            {!isDemo && (
              <button onClick={handleRestoreDemoData} className="px-1.5 py-0.5 bg-slate-700 rounded text-[#F5A623] cursor-pointer">Recharger Démo</button>
            )}
          </div>

        {/* Transition de page animée */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {selectedPage === "overview" && (
              <OverviewTab 
                data={data} 
                onNavigateToLivreurs={() => setSelectedPage("livreurs")}
                onNavigateToRetours={() => setSelectedPage("retours")}
                onNavigateToDelais={() => setSelectedPage("delais")}
              />
            )}
            
            {selectedPage === "livreurs" && (
              <LivreursTab data={data} />
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 md:px-6 mt-12 pt-6 border-t border-[#DDE3EE] w-full text-center md:flex md:justify-between text-[11px] text-[#6B7A99] font-medium box-border">
        <p className="font-sans">IMIR Logistics © {new Date().getFullYear()} — Direction des Méthodes &amp; Procédures.</p>
        <p className="mt-1 md:mt-0 font-sans flex items-center justify-center">
          <Info className="w-3.5 h-3.5 mr-1" />
          Moteur local standalone sécurisé d'analyse Excel Ecotrack v3.11.
        </p>
      </footer>

      {/* TOAST NOTIFICATEUR */}
      <AnimatePresence>
        {toast.message && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
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
          onImportSuccess={handleImportSuccess}
        />
      )}

      {showPdfModal && (
        <PdfModal 
          data={data}
          onClose={() => setShowPdfModal(false)}
          onShowToast={triggerToast}
        />
      )}

      </div>
    </div>
  );
}
