import { useState, useEffect, useCallback } from "react";
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
import LoginScreen from "./components/LoginScreen";
import AlertsPanel from "./components/AlertsPanel";
import { BarChart3, Users, AlertTriangle, Clock, Trophy, Map, Upload, FileText, CheckCircle2, Info, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { getToken, clearToken, getLatestSnapshot, saveSnapshot, getThresholds, Threshold } from "./lib/api";

export default function App() {
  // ── Authentification Direction ──────────────────────────
  const [isAuthed, setIsAuthed] = useState<boolean>(!!getToken());
  const [bootLoading, setBootLoading] = useState<boolean>(true);

  // Chargement des données initiales de démonstration
  const [data, setData] = useState<AppData>(() => generateDemoData());
  const [fileName, setFileName] = useState<string>("Données de démonstration (Avril 2026)");
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);

  // Barre de navigation
  const [selectedPage, setSelectedPage] = useState<string>("overview");

  // Modales & Notifications
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
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

  // ── Charger le dernier snapshot Supabase + les seuils, une fois authentifié ──
  useEffect(() => {
    if (!isAuthed) {
      setBootLoading(false);
      return;
    }
    (async () => {
      setBootLoading(true);
      try {
        const snapshot = await getLatestSnapshot();
        setData(snapshot.data);
        setFileName(snapshot.file_name);
        setIsDemo(false);
      } catch (err: any) {
        if (err.message === "SESSION_EXPIRED") {
          setIsAuthed(false);
          setBootLoading(false);
          return;
        }
        // Pas de snapshot en base : on garde les données de démo
      }
      try {
        const t = await getThresholds();
        setThresholds(t);
      } catch {
        // silencieux : le panneau d'alertes se masque simplement
      }
      setBootLoading(false);
    })();
  }, [isAuthed]);

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

  // Traiter le succès de l'import Excel
  const handleImportSuccess = async (newData: AppData, importedFileName: string) => {
    setData(newData);
    setFileName(importedFileName);
    setIsDemo(false);
    setShowImportModal(false);
    setSelectedPage("overview");
    triggerToast(`✅ ${newData.global.total_dispatches.toLocaleString('fr-DZ')} colis chargés avec succès ! Dashboard mis à jour.`, "success");

    try {
      await saveSnapshot(importedFileName, newData, "import");
    } catch (err: any) {
      triggerToast(`⚠️ Import affiché mais non sauvegardé en base : ${err.message}`, "error");
    }
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

  const handleLogout = () => {
    clearToken();
    setIsAuthed(false);
  };

  // ── Écran de connexion ──────────────────────────────────
  if (!isAuthed) {
    return <LoginScreen onSuccess={() => setIsAuthed(true)} />;
  }

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
            {/* Logo carré
