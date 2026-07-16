import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap, SkippedRowExample, KpiTrend } from "../types";
import { N, F, P, getPerfCategory } from "../utils";
import { TrendingUp, TrendingDown, Minus, Users, Clock, AlertTriangle, CheckCircle, Package, ArrowUpRight, Table as TableIcon, FileText, Info, Search, Wallet, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportOverviewExcel } from "../exportExcel";
import { exportOverviewPdf } from "../exportPdf";
import DrillDownModal from "./DrillDownModal";
import LivreursActifsModal from "./LivreursActifsModal";
import { RawRowsFilter } from "../lib/api";

// Flèche de tendance : verte/rouge/grise selon le sens du mieux pour ce KPI (inverse=true pour
// les métriques où une baisse est une amélioration, ex. un délai). Jamais de rouge pour une simple
// variation — le rouge reste réservé aux couleurs "nécessite une action" définies par carte.
function TrendArrow({ trend, unit = "", inverse = false }: { trend: KpiTrend | undefined; unit?: string; inverse?: boolean }) {
  if (!trend || trend.variation === null) {
    return <span className="text-[10px] text-slate-400 font-sans">Pas d'historique à comparer</span>;
  }
  const improving = inverse ? trend.variation < -0.05 : trend.variation > 0.05;
  const worsening = inverse ? trend.variation > 0.05 : trend.variation < -0.05;
  const Icon = improving ? TrendingUp : worsening ? TrendingDown : Minus;
  const colorClass = improving ? "text-emerald-600" : worsening ? "text-amber-600" : "text-slate-400";
  const sign = trend.variation > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {sign}{trend.variation.toFixed(1)}{unit} vs période précédente
    </span>
  );
}

// Libellés lisibles + unité + sens "mieux" pour chaque clé de src/lib/trends.ts
const TREND_LABELS: { key: string; label: string; unit: string; inverse: boolean }[] = [
  { key: "taux_livraison_global", label: "Taux de livraison", unit: "%", inverse: false },
  { key: "soc_moyen", label: "SOC moyen", unit: "", inverse: false },
  { key: "delai_restitution_cod", label: "Restitution COD", unit: "h", inverse: true },
  { key: "taux_anomalie", label: "Taux d'anomalie", unit: "%", inverse: true },
  { key: "montant_cod_livre", label: "Montant COD livré", unit: " DA", inverse: false },
  { key: "taux_retour_global", label: "Taux de retour", unit: "%", inverse: true },
  { key: "delai_moy", label: "Délai moyen dispatch→livré", unit: "h", inverse: true },
  { key: "taux_communication", label: "Communication (SMS)", unit: "%", inverse: false },
];

function AnimatedNumber({ value, suffix = "", isDecimal = false }: { value: number; suffix?: string; isDecimal?: boolean }) {
  const [display, setDisplay] = useState(0);
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    let startTimestamp: number | null = null;
    const duration = 800; // ms
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      if (isDecimal) {
        setDisplay(parseFloat((progress * value).toFixed(1)) as any);
      } else {
        setDisplay(Math.floor(progress * value));
      }
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [value, isDecimal, prefersReduced]);

  if (isDecimal) {
    const output = typeof display === "number" ? display.toFixed(1) : display;
    return <span>{output}{suffix}</span>;
  }
  return <span>{display.toLocaleString("fr-DZ")}{suffix}</span>;
}

interface OverviewTabProps {
  data: AppData;
  snapshotId: string | null;
  // Tendances vs snapshot précédent, résumé en langage naturel et nb d'alertes : câblés ici (section 5
  // de la spec KPI avancés), consommés par la refonte visuelle en 3 niveaux (section 6).
  tendances: KpiTrend[];
  resumeNaturel: string;
  nbAlertes: number;
  onNavigateToLivreurs: () => void;
  onNavigateToRetours: () => void;
  onNavigateToDelais: () => void;
}

export default function OverviewTab({ data, snapshotId, tendances, resumeNaturel, nbAlertes, onNavigateToLivreurs, onNavigateToRetours, onNavigateToDelais }: OverviewTabProps) {
  const lineChartRef = useRef<HTMLCanvasElement | null>(null);
  const barChartRef = useRef<HTMLCanvasElement | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const [showSkippedDetail, setShowSkippedDetail] = useState(false);
  const [examplesModal, setExamplesModal] = useState<{ label: string; rows: SkippedRowExample[] } | null>(null);
  const [drillDown, setDrillDown] = useState<{ title: string; filter: Omit<RawRowsFilter, "search" | "page" | "pageSize"> } | null>(null);
  const [showLivreursActifs, setShowLivreursActifs] = useState(false);

  // 1. Calculer la distribution du taux de livraison
  // Tranches : <50%, 50-60%, 60-70%, 70-80%, 80-90%, 90-95%, >95%
  // Seulement pour livreurs avec dispatches >= 10
  const relevantLivreurs = data.recap.filter(l => l.dispatches >= 10);
  const tranches = {
    under50: 0,
    r50_60: 0,
    r60_70: 0,
    r70_80: 0,
    r80_90: 0,
    r90_95: 0,
    over95: 0
  };

  relevantLivreurs.forEach(l => {
    const t = l.taux_livraison;
    if (t < 50) tranches.under50++;
    else if (t < 60) tranches.r50_60++;
    else if (t < 70) tranches.r60_70++;
    else if (t < 80) tranches.r70_80++;
    else if (t < 90) tranches.r80_90++;
    else if (t <= 95) tranches.r90_95++;
    else tranches.over95++;
  });

  // 2. Extraire les tops
  // Top 10 volume livré
  const topVolume = [...data.recap].sort((a, b) => b.livres - a.livres).slice(0, 10);
  // Top 10 retours (absolu)
  const topRetours = [...data.recap].sort((a, b) => b.retours - a.retours).slice(0, 10);
  // Top 10 plus lents
  const topPlusLents = [...data.recap]
    .filter(l => l.delai_moy_h > 0)
    .sort((a, b) => b.delai_moy_h - a.delai_moy_h)
    .slice(0, 10);

  useEffect(() => {
    // Nettoyage et initialisation du graphique linéaire d'activité
    if (lineChartRef.current) {
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }

      // Prendre les 60 derniers jours de tendance ou moins si indisponible
      const labels = data.trend.map(t => t.date);
      const dispatchesData = data.trend.map(t => t.dispatches);
      const livresData = data.trend.map(t => t.livres);
      const retoursData = data.trend.map(t => t.retours);

      lineChartInstance.current = new Chart(lineChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Colis Dispatchés",
              data: dispatchesData,
              borderColor: "#1B3A5C",
              backgroundColor: "rgba(27, 58, 92, 0.05)",
              borderWidth: 2.5,
              tension: 0.3,
              fill: true,
              pointRadius: 1.5,
              pointHoverRadius: 5
            },
            {
              label: "Colis Livrés",
              data: livresData,
              borderColor: "#18A558",
              backgroundColor: "rgba(24, 165, 88, 0.05)",
              borderWidth: 2.5,
              tension: 0.3,
              fill: true,
              pointRadius: 1.5,
              pointHoverRadius: 5
            },
            {
              label: "Colis en Retour",
              data: retoursData,
              borderColor: "#D93025",
              backgroundColor: "rgba(217, 48, 37, 0.03)",
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 1.5,
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                boxWidth: 12,
                font: { family: "DM Sans", size: 12 }
              }
            },
            tooltip: {
              mode: "index",
              intersect: false,
              titleFont: { family: "DM Sans" },
              bodyFont: { family: "DM Sans" }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "#EBF0FA" },
              ticks: { font: { family: "DM Mono", size: 10 } }
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: "DM Mono", size: 10 }, maxRotation: 45, autoSkip: true }
            }
          }
        }
      });
    }

    // Nettoyage et initialisation du graphique en barre de distribution
    if (barChartRef.current) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }

      barChartInstance.current = new Chart(barChartRef.current, {
        type: "bar",
        data: {
          labels: ["<50%", "50-60%", "60-70%", "70-80%", "80-90%", "90-95%", ">95%"],
          datasets: [
            {
              label: "Livreurs (≥ 10 dispatches)",
              data: [
                tranches.under50,
                tranches.r50_60,
                tranches.r60_70,
                tranches.r70_80,
                tranches.r80_90,
                tranches.r90_95,
                tranches.over95
              ],
              backgroundColor: [
                "#D93025", // <50% rouge
                "#E8741A", // 50-60% orange
                "#F5A623", // 60-70% jaune
                "#1B3A5C", // 70-80% navy
                "#335B85", // 80-90% light navy
                "#34D399", // 90-95% mint green
                "#18A558"  // >95% vert imir
              ],
              borderRadius: 6,
              borderWidth: 0,
              barPercentage: 0.65
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              titleFont: { family: "DM Sans" },
              bodyFont: { family: "DM Sans" }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "#EBF0FA" },
              ticks: { font: { family: "DM Mono", size: 10 } }
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: "DM Sans", size: 11, weight: "bold" } }
            }
          }
        }
      });
    }

    // Fonction de nettoyage
    return () => {
      lineChartInstance.current?.destroy();
      barChartInstance.current?.destroy();
    };
  }, [data]);

  const averageSOC = data.recap.length > 0
    ? parseFloat((data.recap.reduce((sum, item) => sum + (item.soc || 0), 0) / data.recap.length).toFixed(1))
    : 0;

  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: prefersReduced ? 0 : 0.05
      }
    }
  };

  const cardVariants = {
    hidden: prefersReduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.93 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } }
  };

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            📊 Vue d'ensemble globale
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Performance consolidée du réseau de distribution IMIR</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportOverviewExcel(data);
              triggerLocalToast("✅ Export Excel généré");
            }}
            disabled={!data || !data.recap || data.recap.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.recap || data.recap.length === 0)
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
            }`}
          >
            <TableIcon size={13} /> Excel
          </motion.button>

          {/* PDF Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportOverviewPdf(data);
              triggerLocalToast("✅ Rapport PDF généré");
            }}
            disabled={!data || !data.recap || data.recap.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.recap || data.recap.length === 0)
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                : "border-orange-300 bg-orange-50 text-[#E8741A] hover:bg-orange-100 cursor-pointer"
            }`}
          >
            <FileText size={13} /> PDF
          </motion.button>
        </div>
      </div>

      {/* NIVEAU 1 — Résumé : toujours visible, sans scroll. Phrase auto-générée + 5 chiffres clés
          avec tendance et repère, jamais un pourcentage nu. */}
      <div className={`rounded-2xl p-4 flex items-center gap-3 border text-sm font-semibold font-sans ${
        nbAlertes > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"
      }`}>
        {nbAlertes > 0 ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
        {resumeNaturel}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Taux de livraison réseau */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Taux Livraison Réseau</p>
          <h3 className={`text-2xl font-bold font-mono ${data.global.taux_global >= 90 ? "text-emerald-600" : data.global.taux_global >= 70 ? "text-[#E8741A]" : "text-red-600"}`}>
            {F(data.global.taux_global)}%
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">Objectif ≥ 90%</p>
          <TrendArrow trend={tendances.find(t => t.key === "taux_livraison_global")} unit="pts" />
        </div>

        {/* SOC moyen réseau */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">SOC Moyen Réseau</p>
          <h3 className={`text-2xl font-bold font-mono ${averageSOC >= 80 ? "text-emerald-600" : averageSOC >= 60 ? "text-[#E8741A]" : "text-red-600"}`}>
            {F(averageSOC)} <span className="text-xs text-slate-400">/100</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">Taux 30% · Rapidité 20% · Encaiss. 50%</p>
          <TrendArrow trend={tendances.find(t => t.key === "soc_moyen")} unit="pts" />
        </div>

        {/* Alertes actives */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Alertes Actives</p>
          <h3 className={`text-2xl font-bold font-mono ${nbAlertes > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {N(nbAlertes)}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">Livreurs sous les seuils configurés</p>
          <span className="text-[10px] text-slate-400 font-sans">Voir le détail ci-dessous</span>
        </div>

        {/* Délai restitution COD moyen */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <RefreshCcw className="w-3 h-3" /> Restitution COD
          </p>
          <h3 className="text-2xl font-bold font-mono text-[#1B3A5C]">
            {F(data.global.delai_restitution_cod_moy_h)}h
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">Encaissé → Versé à l'admin</p>
          <TrendArrow trend={tendances.find(t => t.key === "delai_restitution_cod")} unit="h" inverse />
        </div>

        {/* Montant COD des colis livrés (pas une marge : aucune charge n'est déduite) */}
        <div className="glass-panel rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Montant COD Livré
          </p>
          <h3 className="text-2xl font-bold font-mono text-[#1B3A5C]">
            {N(data.global.montant_cod_livre_total)}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">DA encaissés pour les colis livrés</p>
          <TrendArrow trend={tendances.find(t => t.key === "montant_cod_livre")} unit=" DA" />
        </div>
      </div>

      {/* Traçabilité de l'import : lignes du fichier vs lignes comptabilisées */}
      {(data.global.lignes_ignorees_sans_livreur > 0 || data.global.lignes_ignorees_sans_dispatch > 0) && (
        <div className="bg-slate-100/70 border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-[11px] leading-relaxed">
          <button
            onClick={() => setShowSkippedDetail(v => !v)}
            className="w-full flex items-start gap-2 text-left cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="flex-1">
              <strong>{N(data.global.lignes_fichier)}</strong> lignes lues dans le fichier importé, dont{" "}
              <strong>{N(data.global.total_dispatches)}</strong> comptabilisées comme "Dispatchés" (colis avec une date "Dispatché au livreur le").{" "}
              {data.global.lignes_ignorees_sans_livreur > 0 && (
                <>{N(data.global.lignes_ignorees_sans_livreur)} lignes ignorées sans livreur assigné. </>
              )}
              {data.global.lignes_ignorees_sans_dispatch > 0 && (
                <>{N(data.global.lignes_ignorees_sans_dispatch)} lignes ignorées car jamais dispatchées (colis pas encore pris en charge). </>
              )}
              <span className="underline font-semibold text-[#1B3A5C]">{showSkippedDetail ? "Masquer le détail" : "Voir le détail par statut"}</span>
            </span>
          </button>

          {showSkippedDetail && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.global.statuts_sans_livreur.length > 0 && (
                <div className="bg-white/60 border border-slate-200 rounded-lg p-3">
                  <p className="font-bold text-[#1B3A5C] text-[10px] uppercase tracking-wide mb-2">
                    Sans livreur assigné ({N(data.global.lignes_ignorees_sans_livreur)}) — par statut
                  </p>
                  <ul className="space-y-1">
                    {data.global.statuts_sans_livreur.map(s => (
                      <li key={s.statut}>
                        <button
                          onClick={() => s.examples.length > 0 && setExamplesModal({ label: `Sans livreur assigné — ${s.statut}`, rows: s.examples })}
                          disabled={s.examples.length === 0}
                          className="w-full flex justify-between items-center hover:bg-slate-100 rounded px-1 -mx-1 py-0.5 disabled:cursor-default cursor-pointer transition-colors"
                        >
                          <span className="truncate pr-2 text-left">
                            {s.statut} {s.examples.length > 0 && <span className="text-[#1B3A5C] underline">(voir exemples)</span>}
                          </span>
                          <span className="font-mono font-bold text-[#1B3A5C] flex-shrink-0">{N(s.count)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.global.statuts_sans_dispatch.length > 0 && (
                <div className="bg-white/60 border border-slate-200 rounded-lg p-3">
                  <p className="font-bold text-[#1B3A5C] text-[10px] uppercase tracking-wide mb-2">
                    Jamais dispatchées ({N(data.global.lignes_ignorees_sans_dispatch)}) — par statut
                  </p>
                  <ul className="space-y-1">
                    {data.global.statuts_sans_dispatch.map(s => (
                      <li key={s.statut}>
                        <button
                          onClick={() => s.examples.length > 0 && setExamplesModal({ label: `Jamais dispatchées — ${s.statut}`, rows: s.examples })}
                          disabled={s.examples.length === 0}
                          className="w-full flex justify-between items-center hover:bg-slate-100 rounded px-1 -mx-1 py-0.5 disabled:cursor-default cursor-pointer transition-colors"
                        >
                          <span className="truncate pr-2 text-left">
                            {s.statut} {s.examples.length > 0 && <span className="text-[#1B3A5C] underline">(voir exemples)</span>}
                          </span>
                          <span className="font-mono font-bold text-[#1B3A5C] flex-shrink-0">{N(s.count)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Grille de KPI cards avec animations et bande de couleur en haut.
          Taux Livraison Global et SOC Moyen Réseau ne sont pas répétés ici : déjà visibles en
          Niveau 1 juste au-dessus, toujours sans scroll. */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* Total dispatchés */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-sky-600 w-full"></div>
          <button
            onClick={() => setDrillDown({ title: "Total Dispatchés — détail", filter: { isDispatched: true } })}
            className="w-full p-4 flex justify-between items-center text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">Total Dispatchés <Search className="w-2.5 h-2.5 text-slate-400" /></p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1"><AnimatedNumber value={data.global.total_dispatches} /></h3>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Colis confiés au réseau</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
              <Package className="w-5 h-5" />
            </div>
          </button>
        </motion.div>

        {/* Total livrés */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-emerald-600 w-full"></div>
          <button
            onClick={() => setDrillDown({ title: "Total Livrés — détail", filter: { isLivre: true } })}
            className="w-full p-4 flex justify-between items-center text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">Total Livrés <Search className="w-2.5 h-2.5 text-slate-400" /></p>
              <h3 className="text-3xl font-bold font-mono text-emerald-600 mt-1"><AnimatedNumber value={data.global.total_livres} /></h3>
              <p className="text-[10px] text-emerald-500 mt-1 font-sans">Remises clients effectives</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </button>
        </motion.div>

        {/* Total retours */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-red-500 w-full"></div>
          <button
            onClick={() => setDrillDown({ title: "Total Retours — détail", filter: { isRetour: true } })}
            className="w-full p-4 flex justify-between items-center text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">Total Retours <Search className="w-2.5 h-2.5 text-slate-400" /></p>
              <h3 className="text-3xl font-bold font-mono text-red-600 mt-1"><AnimatedNumber value={data.global.total_retours} /></h3>
              <p className="text-[10px] text-red-500 mt-1 font-sans">
                {F(data.global.total_dispatches > 0 ? (data.global.total_retours / data.global.total_dispatches) * 100 : 0)}% des dispatchés
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </button>
        </motion.div>

        {/* Délai moyen dispatch -> livré */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-[#E8741A] w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Délai Dispatch → Livré</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1"><AnimatedNumber value={data.global.delai_moy} isDecimal suffix="h" /></h3>
              <p className="text-[10px] text-[#E8741A] mt-1 font-sans font-medium">Temps de transit route</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#E8741A]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* Délai moyen encaissement */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-amber-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Délai Encaissement</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1"><AnimatedNumber value={data.global.delai_encaiss_moy} isDecimal suffix="h" /></h3>
              <p className="text-[10px] text-amber-600 mt-1 font-sans">Livré → Encaissé</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* Livreurs actifs */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-teal-500 w-full"></div>
          <button
            onClick={() => setShowLivreursActifs(true)}
            className="w-full p-4 flex justify-between items-center text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">Livreurs Actifs <Search className="w-2.5 h-2.5 text-slate-400" /></p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1"><AnimatedNumber value={data.global.nb_livreurs} /></h3>
              <p className="text-[10px] text-teal-600 mt-1 font-sans">Dans l'export analysé</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
              <Users className="w-5 h-5" />
            </div>
          </button>
        </motion.div>

        {/* Non livrés */}
        <motion.div variants={cardVariants} className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-purple-500 w-full"></div>
          <button
            onClick={() => setDrillDown({ title: "Colis Non Livrés — détail", filter: { isDispatched: true, isLivre: false } })}
            className="w-full p-4 flex justify-between items-center text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">Colis Non Livrés <Search className="w-2.5 h-2.5 text-slate-400" /></p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1"><AnimatedNumber value={data.global.non_livres} /></h3>
              <p className="text-[10px] text-purple-600 mt-1 font-sans">Différence (Dispatch - Livré)</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Package className="w-5 h-5" />
            </div>
          </button>
        </motion.div>
      </motion.div>

      {/* 3. Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique de tendance (Ligne) - 2/3 de largeur */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-[#F0F3F8]">
            <div>
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">Activité temporelle (60 derniers jours)</h4>
              <p className="text-[11px] text-[#6B7A99]">Tendance évolutive des colis dispatchés, livrés et retournés par jour d'activité</p>
            </div>
          </div>
          <div className="h-72 relative">
            <canvas ref={lineChartRef}></canvas>
          </div>
        </div>

        {/* Graphique de distribution du taux de livraison (Barres) - 1/3 de largeur */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="mb-4 pb-3 border-b border-[#F0F3F8]">
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">Distribution des taux de livraison</h4>
            <p className="text-[11px] text-[#6B7A99]">Répartition des livreurs selon leur performance (dispatches ≥ 10)</p>
          </div>
          <div className="h-72 relative">
            <canvas ref={barChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* NIVEAU 2 — Contexte : comparaison compacte avec la période précédente */}
      <div className="glass-panel rounded-xl p-5">
        <div className="mb-4 pb-3 border-b border-[#F0F3F8]">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">Comparaison période précédente</h4>
          <p className="text-[11px] text-[#6B7A99]">Écart avec le dernier import enregistré avant celui-ci</p>
        </div>
        {tendances.length === 0 ? (
          <p className="text-xs text-slate-400 font-sans py-2">Pas encore d'historique pour comparer — importez à nouveau pour voir apparaître les tendances.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TREND_LABELS.filter(t => tendances.some(tr => tr.key === t.key)).map(({ key, label, unit, inverse }) => {
              const trend = tendances.find(tr => tr.key === key)!;
              return (
                <div key={key} className="border border-[#F0F3F8] rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase truncate">{label}</p>
                  <p className="text-sm font-bold font-mono text-[#1B3A5C] mt-0.5">
                    {trend.valeurActuelle.toLocaleString("fr-DZ")}{unit}
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(était {trend.valeurPrecedente?.toLocaleString("fr-DZ")}{unit})</span>
                  </p>
                  <TrendArrow trend={trend} unit={unit} inverse={inverse} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Mini tableaux (Top 10 Volume, Top 10 Retours, Top 10 Plus Lents) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top 10 volume livré */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 bg-white/10 border-b border-white/20 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[#1B3A5C] text-xs uppercase tracking-wider font-sans">🏆 Top 10 Volume Livré</h4>
              <p className="text-[10px] text-[#6B7A99] mt-0.5">Livreurs comptabilisant le plus de remises réussies</p>
            </div>
            <button 
              onClick={onNavigateToLivreurs}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center font-medium font-sans"
            >
              Voir tout <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="divide-y divide-[#F0F3F8] max-h-96 overflow-y-auto custom-scrollbar">
            {topVolume.map((l, index) => (
              <div key={l.id} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                    index === 0 ? "bg-amber-100 text-amber-800" :
                    index === 1 ? "bg-slate-100 text-slate-800" :
                    index === 2 ? "bg-orange-100 text-orange-900" : "bg-slate-50 text-[#6B7A99]"
                  }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1B3A5C] truncate font-sans">{l.livreur}</p>
                    <p className="text-[10px] text-[#6B7A99] truncate font-sans">{l.station}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold font-mono text-emerald-600">{N(l.livres)} livraisons</p>
                  <p className="text-[10px] font-medium text-slate-400 font-mono">Taux : {F(l.taux_livraison)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 retours (absolus) */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 bg-white/10 border-b border-white/20 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[#1B3A5C] text-xs uppercase tracking-wider font-sans">⚠️ Top 10 Retours (Absolu)</h4>
              <p className="text-[10px] text-[#6B7A99] mt-0.5">Livreurs avec les volumes de retours les plus élevés</p>
            </div>
            <button 
              onClick={onNavigateToRetours}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center font-medium font-sans"
            >
              Analyses retours <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="divide-y divide-[#F0F3F8] max-h-96 overflow-y-auto custom-scrollbar">
            {topRetours.map((l, index) => (
              <div key={l.id} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1B3A5C] truncate font-sans">{l.livreur}</p>
                    <p className="text-[10px] text-[#6B7A99] truncate font-sans">{l.station}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold font-mono text-red-600">{N(l.retours)} retours</p>
                  <p className="text-[10px] font-medium text-slate-400 font-mono">Taux : {F(l.taux_retour)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 plus lents */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 bg-white/10 border-b border-white/20 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-[#1B3A5C] text-xs uppercase tracking-wider font-sans">🐢 Top 10 Plus Lents</h4>
              <p className="text-[10px] text-[#6B7A99] mt-0.5">Délais de transit route dispatch → livré les plus longs</p>
            </div>
            <button 
              onClick={onNavigateToDelais}
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center font-medium font-sans"
            >
              Détails délais <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
          <div className="divide-y divide-[#F0F3F8] max-h-96 overflow-y-auto custom-scrollbar">
            {topPlusLents.map((l, index) => (
              <div key={l.id} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1B3A5C] truncate font-sans">{l.livreur}</p>
                    <p className="text-[10px] text-[#6B7A99] truncate font-sans">{l.station}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold font-mono text-[#E8741A]">{F(l.delai_moy_h)} heures</p>
                  <p className="text-[10px] font-medium text-slate-400 font-mono">Volume : {N(l.livres)} livrés</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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

      {/* Modale d'exemples de lignes brutes ignorées */}
      <AnimatePresence>
        {examplesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B3A5C]/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setExamplesModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-[#1B3A5C] text-white px-4 py-3 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="font-bold text-sm">{examplesModal.label}</h3>
                  <p className="text-[10px] text-slate-300">Échantillon de {examplesModal.rows.length} lignes brutes du fichier importé</p>
                </div>
                <button onClick={() => setExamplesModal(null)} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer">✕</button>
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Tracking</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Client</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livreur</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Station</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Expédié le</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livré le</th>
                      <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examplesModal.rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono">{r.tracking || "–"}</td>
                        <td className="px-3 py-1.5">{r.client || "–"}</td>
                        <td className="px-3 py-1.5">{r.livreur || "–"}</td>
                        <td className="px-3 py-1.5">{r.station || "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.expedieLe || "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.livreLe || "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.montant ? N(r.montant) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drill-down générique : détail ligne par ligne depuis une carte KPI */}
      <AnimatePresence>
        {drillDown && (
          <DrillDownModal
            snapshotId={snapshotId}
            title={drillDown.title}
            filter={drillDown.filter}
            onClose={() => setDrillDown(null)}
          />
        )}
      </AnimatePresence>

      {/* Liste des livreurs actifs avec leur dernière activité */}
      <AnimatePresence>
        {showLivreursActifs && (
          <LivreursActifsModal livreurs={data.recap} onClose={() => setShowLivreursActifs(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
