import { useEffect, useRef, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getPerfCategory, getCompositeScore } from "../utils";
import { ShieldCheck, Trophy, Sparkles, SlidersHorizontal, Calculator, ListOrdered, ChevronRight, Activity, Table as TableIcon, FileText } from "lucide-react";
import SOCCalculator from "./SOCCalculator";
import { exportPerformanceExcel } from "../exportExcel";
import { exportPerformancePdf } from "../exportPdf";

interface PerformanceTabProps {
  data: AppData;
}

export default function PerformanceTab({ data }: PerformanceTabProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  // Filtrer les livreurs pour les analyses de performances (dispatches >= 20)
  const relevantLivreurs = useMemo(() => {
    return data.recap.filter(l => l.dispatches >= 20);
  }, [data]);

  // Répartition par niveau de performance (tous les livreurs)
  const distPerformance = useMemo(() => {
    const counts = { Excellent: 0, Bon: 0, Moyen: 0, Faible: 0 };
    data.recap.forEach(l => {
      const cat = getPerfCategory(l.taux_livraison);
      counts[cat]++;
    });
    return counts;
  }, [data]);

  // Top 15 meilleurs livreurs (dispatches >= 20, triés par taux de livraison desc)
  const top15Meilleurs = useMemo(() => {
    return [...relevantLivreurs]
      .sort((a, b) => b.taux_livraison - a.taux_livraison)
      .slice(0, 15);
  }, [relevantLivreurs]);

  // Liste exhaustive des livreurs avec dispatches >= 20, triée par Score composite décroissant
  const listPerformanceAll = useMemo(() => {
    return [...relevantLivreurs].sort((a, b) => {
      const scoreA = getCompositeScore(a);
      const scoreB = getCompositeScore(b);
      return scoreB - scoreA;
    });
  }, [relevantLivreurs]);

  // Tab de perspective de performance : SOC vs Classique
  const [activeSubTab, setActiveSubTab] = useState<"soc" | "classic">("soc");

  // Répartition par niveau de SOC
  const distSOC = useMemo(() => {
    const counts = { Excellent: 0, Bon: 0, Moyen: 0, Faible: 0 };
    data.recap.forEach(l => {
      const val = l.soc || 0;
      if (val >= 80) counts.Excellent++;
      else if (val >= 60) counts.Bon++;
      else if (val >= 40) counts.Moyen++;
      else counts.Faible++;
    });
    return counts;
  }, [data]);

  // Top 10 meilleurs livreurs selon le SOC décroissant (dispatches >= 20)
  const top10SOC = useMemo(() => {
    return [...relevantLivreurs]
      .sort((a, b) => (b.soc || 0) - (a.soc || 0))
      .slice(0, 10);
  }, [relevantLivreurs]);

  // Tous les livreurs triés par SOC décroissant (dispatches >= 20)
  const listSOCAll = useMemo(() => {
    return [...relevantLivreurs].sort((a, b) => (b.soc || 0) - (a.soc || 0));
  }, [relevantLivreurs]);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const activeDist = activeSubTab === "soc" ? distSOC : distPerformance;
      const activeLabels = activeSubTab === "soc"
        ? ["Excellent (≥80)", "Bon (60-80)", "Moyen (40-60)", "Faible (<40)"]
        : ["Excellent (≥90%)", "Bon (75-90%)", "Moyen (60-75%)", "Faible (<60%)"];

      chartInstance.current = new Chart(chartRef.current, {
        type: "doughnut",
        data: {
          labels: activeLabels,
          datasets: [
            {
              data: [
                activeDist.Excellent,
                activeDist.Bon,
                activeDist.Moyen,
                activeDist.Faible
              ],
              backgroundColor: ["#18A558", "#1B3A5C", "#E8741A", "#D93025"],
              borderWidth: 2,
              borderColor: "#ffffff"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                boxWidth: 12,
                font: { family: "DM Sans", size: 11, weight: "bold" },
                padding: 12
              }
            },
            tooltip: {
              titleFont: { family: "DM Sans" },
              bodyFont: { family: "DM Sans" }
            }
          },
          cutout: "60%"
        }
      });
    }

    return () => {
      chartInstance.current?.destroy();
    };
  }, [distPerformance, distSOC, activeSubTab]);

  // Helper pour retourner la classe CSS de la barre de score
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-[#1B3A5C]";
    if (score >= 60) return "bg-[#E8741A]";
    return "bg-red-500";
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 font-bold font-mono";
    if (score >= 75) return "text-[#1B3A5C] font-semibold font-mono";
    if (score >= 60) return "text-[#E8741A] font-semibold font-mono";
    return "text-red-600 font-bold font-mono";
  };

  const getSOCStyle = (soc: number) => {
    if (soc >= 80) return "text-emerald-600 font-bold";
    if (soc >= 60) return "text-indigo-600 font-semibold";
    if (soc >= 40) return "text-orange-500 font-semibold";
    return "text-red-500 font-bold";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            🏆 Classement &amp; Score Opérationnel Composite (SOC)
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Algorithme d'évaluation globale et scoring multifactoriel des livreurs</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportPerformanceExcel(data);
              triggerLocalToast("✅ Export Excel généré");
            }}
            disabled={!data || !data.recap || data.recap.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.recap || data.recap.length === 0)
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
              exportPerformancePdf(data);
              triggerLocalToast("✅ Rapport PDF généré");
            }}
            disabled={!data || !data.recap || data.recap.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.recap || data.recap.length === 0)
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-250 text-slate-400"
                : "border-orange-300 bg-orange-50 text-[#E8741A] hover:bg-orange-100 cursor-pointer"
            }`}
          >
            <FileText size={13} /> PDF
          </motion.button>
        </div>
      </div>

      {/* Sélecteur de Perspective de Performance */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start inline-flex space-x-1 shadow-sm">
        <button
          onClick={() => setActiveSubTab("soc")}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
            activeSubTab === "soc"
              ? "bg-[#1B3A5C] text-white shadow-xs"
              : "text-slate-600 hover:text-[#1B3A5C] hover:bg-white"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
          Score Opérationnel Composite (SOC)
        </button>
        <button
          onClick={() => setActiveSubTab("classic")}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
            activeSubTab === "classic"
              ? "bg-[#1B3A5C] text-white shadow-xs"
              : "text-slate-600 hover:text-[#1B3A5C] hover:bg-white"
          }`}
        >
          <Activity className="w-3.5 h-3.5 mr-1.5 text-sky-450 text-sky-400" />
          Indicateurs & Taux Classiques
        </button>
      </div>

      {activeSubTab === "soc" ? (
        <>
          {/* Alert strip SOC */}
          <div className="bg-indigo-950/5 border-l-4 border-l-indigo-600 rounded-r-xl p-4 flex items-start space-x-3 text-indigo-950 shadow-2xs backdrop-blur-md border border-white/10">
            <ShieldCheck className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-950 font-sans">IMIR Composite - Score Opérationnel Composite (SOC)</h4>
              <p className="text-xs mt-1 text-slate-800 font-sans leading-relaxed">
                Le SOC est la métrique officielle de notation des livreurs du réseau <strong>IMIR Logistics</strong>. Il est calculé sur 100 points selon trois piliers critiques :
                <br />
                <span className="font-mono bg-indigo-100/60 text-indigo-950 px-1.5 py-0.5 rounded text-[10px] mt-1.5 inline-block">
                  SOC (100 pts) = (Taux Livraison × 30%) + (Vitesse × 20%) + (Encaissement × 50%)
                </span>
                <br />
                La pondération valorise l'encaissement et le reversement rapide (50%) combinés à la délivrabilité effective brute (30%) et la vitesse sur les tournées (20%).
              </p>
            </div>
          </div>

          {/* Grille de 4 KPI cards adaptées au SOC */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Excellent */}
            <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden shadow-2xs border border-emerald-500/20 bg-emerald-500/5 hover:shadow-xs transition-all duration-300">
              <p className="text-[10px] uppercase font-bold text-emerald-600">🟢 Excellent (≥80 pts)</p>
              <p className="text-3xl font-black font-mono text-emerald-600 mt-1">{distSOC.Excellent}</p>
              <span className="text-[9px] text-slate-500">Profils Élite Partenaires</span>
            </div>

            {/* Bon */}
            <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden shadow-2xs border border-indigo-500/20 bg-indigo-50/10 hover:shadow-xs transition-all duration-300">
              <p className="text-[10px] uppercase font-bold text-indigo-700">🔵 Bon (60-80 pts)</p>
              <p className="text-3xl font-black font-mono text-indigo-900 mt-1">{distSOC.Bon}</p>
              <span className="text-[9px] text-slate-500">Conforme aux standards</span>
            </div>

            {/* Moyen */}
            <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden shadow-2xs border border-orange-500/20 bg-orange-500/5 hover:shadow-xs transition-all duration-300">
              <p className="text-[10px] uppercase font-bold text-orange-655 text-orange-600">🟠 Moyen (40-60 pts)</p>
              <p className="text-3xl font-black font-mono text-orange-650 mt-1">{distSOC.Moyen}</p>
              <span className="text-[9px] text-slate-500">Suivi & coaching requis</span>
            </div>

            {/* Faible */}
            <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden shadow-2xs border border-red-500/20 bg-red-500/5 hover:shadow-xs transition-all duration-300">
              <p className="text-[10px] uppercase font-bold text-red-650 text-red-600">🔴 Faible ({"<"}40 pts)</p>
              <p className="text-3xl font-black font-mono text-red-650 mt-1">{distSOC.Faible}</p>
              <span className="text-[9px] text-slate-500">Alerte de conformité</span>
            </div>
          </div>

          {/* Grille 2 colonnes: Simulateur interactif à côté de la répartition de l'indice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulateur interactif */}
            <SOCCalculator />

            {/* Graphique de répartition du réseau par SOC */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between border border-indigo-100 bg-white/20">
              <div>
                <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
                  <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-indigo-650 text-indigo-600 animate-pulse" />
                    Démographie du Réseau par Tranche SOC
                  </h4>
                  <p className="text-[11px] text-[#6B7A99] mt-0.5">Ventilation en volume de livreurs selon les seuils du Score Opérationnel Composite actuel</p>
                </div>
                
                <div className="h-64 relative mt-3">
                  <canvas ref={chartRef}></canvas>
                </div>
              </div>

              <div className="bg-[#1B3A5C]/5 border border-[#1B3A5C]/20 rounded-lg p-3 text-[11px] text-slate-700 mt-4 leading-relaxed font-sans">
                📌 <strong>Interprétation stratégique :</strong> Les livreurs classés <strong>Excellent (≥80)</strong> démontrent une maîtrise parfaite de la chaîne d'encaissement combinée à un taux de livraison supérieur.
              </div>
            </div>
          </div>

          {/* Top 10 Livreurs National (SOC) */}
          <div className="glass-panel p-5 rounded-xl shadow-2xs border border-indigo-200/10">
            <div className="mb-4 pb-2 border-b border-indigo-200/10 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                  <Trophy className="w-4.5 h-4.5 mr-1.5 text-amber-500 animate-bounce" />
                  Top 10 Livreurs Nationaux selon le SOC
                </h4>
                <p className="text-[11px] text-[#6B7A99] mt-0.5">Sélection des dix prestataires ayant obtenu le meilleur Score Opérationnel Composite (dispatches ≥ 20)</p>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-700 rounded-lg text-[10px] font-bold font-mono">
                Élite Réseau
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-700 font-medium border-collapse min-w-[700px]">
                <thead className="bg-[#1B3A5C]/85 text-white backdrop-blur-md">
                  <tr>
                    <th className="px-3 py-2 text-center w-12">Rang</th>
                    <th className="px-3 py-2">Livreur</th>
                    <th className="px-3 py-2">Station</th>
                    <th className="px-3 py-2 text-center w-32">Délivrabilité (30%)</th>
                    <th className="px-3 py-2 text-center w-32">Vitesse (20%)</th>
                    <th className="px-3 py-2 text-center w-32">Encaissement (50%)</th>
                    <th className="px-4 py-2 text-center w-40">Score SOC Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F3F8]">
                  {top10SOC.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-center font-mono text-amber-600 font-extrabold">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-[#1B3A5C]">{l.livreur}</td>
                      <td className="px-3 py-2.5 text-slate-500">{l.station}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-indigo-700">{l.soc_taux.toFixed(1)}/30</td>
                      <td className="px-3 py-2.5 text-center font-mono text-amber-600">{l.soc_rapidite.toFixed(1)}/20</td>
                      <td className="px-3 py-2.5 text-center font-mono text-emerald-600">{l.soc_enc.toFixed(1)}/50</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black font-mono bg-indigo-50/50 ${getSOCStyle(l.soc)}`}>
                          {l.soc.toFixed(1)}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Classement Exhaustif du Réseau par SOC */}
          <div className="glass-panel p-5 rounded-xl">
            <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                <ListOrdered className="w-4 h-4 mr-1.5 text-indigo-650" />
                Distribution Exhaustive Réseau (SOC)
              </h4>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">Tous les livreurs du réseau triés par SOC décroissant (seuil minimal obligatoire de 20 dispatches)</p>
            </div>

            <div className="overflow-x-auto custom-scrollbar max-h-96">
              <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
                <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">#</th>
                    <th className="px-3 py-2.5">Livreur</th>
                    <th className="px-3 py-2.5">Station</th>
                    <th className="px-3 py-2.5 text-right w-20">Disp.</th>
                    <th className="px-3 py-2.5 text-right w-20">Livrés</th>
                    <th className="px-3 py-2.5 text-center w-24">Tx Livr.</th>
                    <th className="px-3 py-2.5 text-right w-24">Délai Disp.</th>
                    <th className="px-3 py-2.5 text-right w-24 text-emerald-600">Délai Enc.</th>
                    <th className="px-4 py-2.5 min-w-[200px] text-center">Sous-Composantes SOC (T / V / E)</th>
                    <th className="px-4 py-2.5 text-center w-40 font-bold">Score SOC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F3F8]">
                  {listSOCAll.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-3 py-2 font-bold text-[#1B3A5C] truncate max-w-[140px]">{l.livreur}</td>
                      <td className="px-3 py-2 text-slate-500 truncate max-w-[140px]">{l.station}</td>
                      <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600">{N(l.livres)}</td>
                      <td className="px-3 py-2 text-center font-mono text-emerald-600">{P(l.taux_livraison)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-650">{l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–"}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-650 font-semibold">{l.delai_enc_h > 0 ? `${F(l.delai_enc_h)}h` : "–"}</td>
                      
                      {/* Barre de répartition dynamique multi-piliers */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex flex-col space-y-1 w-full max-w-[220px] mx-auto">
                          <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100">
                            <div style={{ width: `${(l.soc_taux / 30) * 100}%` }} className="bg-indigo-600 h-full" title={`Taux (${l.soc_taux.toFixed(1)} pts)`} />
                            <div style={{ width: `${(l.soc_rapidite / 20) * 100}%` }} className="bg-amber-400 h-full" title={`Vitesse (${l.soc_rapidite.toFixed(1)} pts)`} />
                            <div style={{ width: `${(l.soc_enc / 50) * 100}%` }} className="bg-emerald-500 h-full" title={`Encaissement (${l.soc_enc.toFixed(1)} pts)`} />
                          </div>
                          <div className="flex justify-between text-[8px] font-mono font-bold text-slate-400">
                            <span className="text-indigo-600">{l.soc_taux.toFixed(1)} T</span>
                            <span className="text-amber-500">{l.soc_rapidite.toFixed(1)} V</span>
                            <span className="text-emerald-500">{l.soc_enc.toFixed(1)} E</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2 text-center">
                        <span className={`font-mono font-bold text-xs ${getSOCStyle(l.soc)}`}>
                          {l.soc.toFixed(1)}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Alert strip bleue classique */}
          <div className="bg-blue-950/10 border-l-4 border-l-[#1B3A5C] rounded-r-xl p-4 flex items-start space-x-3 text-blue-900 shadow-2xs backdrop-blur-md border border-white/10">
            <ShieldCheck className="w-5 h-5 text-[#1B3A5C] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-950 font-sans">Indice d'Efficacité Classique (60/40)</h4>
              <p className="text-xs mt-1 text-slate-800 font-sans leading-relaxed">
                Ce score de performance historique est basé sur une pondération équilibrée à <strong>60% sur le Taux de Livraison</strong> brut et <strong>40% sur la rapidité globale</strong> d'expédition normalisée.
              </p>
            </div>
          </div>

          {/* 4 KPI cards performance classique */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Excellent */}
            <div className="glass-panel p-4 rounded-xl text-center relative overflow-hidden shadow-2xs border border-emerald-500/20 bg-emerald-500/5">
              <div className="absolute top-0 right-0 p-1">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[10px] uppercase font-bold text-emerald-600">🟢 Excellent (≥90%)</p>
              <p className="text-3xl font-bold font-mono text-emerald-600 mt-1">{distPerformance.Excellent}</p>
              <span className="text-[9px] text-[#6B7A99]">Partenaire principal</span>
            </div>

            {/* Bon */}
            <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-slate-500/10">
              <p className="text-[10px] uppercase font-bold text-slate-600">🔵 Bon (75-90%)</p>
              <p className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{distPerformance.Bon}</p>
              <span className="text-[9px] text-[#6B7A99]">Dans les standards réseau</span>
            </div>

            {/* Moyen */}
            <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-orange-500/20 bg-orange-500/5">
              <p className="text-[10px] uppercase font-bold text-orange-650 text-[#E8741A]">🟠 Moyen (60-75%)</p>
              <p className="text-3xl font-bold font-mono text-[#E8741A] mt-1">{distPerformance.Moyen}</p>
              <span className="text-[9px] text-orange-500">Plan d'action préconisé</span>
            </div>

            {/* Faible */}
            <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-red-500/20 bg-red-500/5">
              <p className="text-[10px] uppercase font-bold text-red-600">🔴 Faible ({"<"}60%)</p>
              <p className="text-3xl font-bold font-mono text-red-650 text-red-600 mt-1">{distPerformance.Faible}</p>
              <span className="text-[9px] text-red-500">Alerte de conformité</span>
            </div>
          </div>

          {/* Grille 2 colonnes classique */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gauche : Top 15 meilleurs livreurs par taux */}
            <div className="glass-panel p-5 rounded-xl">
              <div className="mb-4 pb-2 border-b border-white/20">
                <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                  <Trophy className="w-4 h-4 mr-1.5 text-amber-500" />
                  Top 15 Meilleurs Livreurs (Taux de Livraison)
                </h4>
                <p className="text-[11px] text-[#6B7A99] mt-0.5">Nos 15 meilleurs livreurs nationaux engagés par volume et efficacité (dispatches ≥ 20)</p>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs text-slate-700 font-medium border-collapse">
                  <thead className="bg-[#1B3A5C]/85 text-white backdrop-blur-md">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">Rég.</th>
                      <th className="px-3 py-2">Livreur</th>
                      <th className="px-3 py-2">Station</th>
                      <th className="px-3 py-2 text-right w-24">Disp.</th>
                      <th className="px-3 py-2 text-right w-24 text-emerald-400">Livrés</th>
                      <th className="px-3 py-2 text-center w-32">Tx Livraison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F3F8]">
                    {top15Meilleurs.map((l, idx) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-[#1B3A5C]">{l.livreur}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{l.station}</td>
                        <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600 font-semibold">{N(l.livres)}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">{P(l.taux_livraison)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Droite : Donut distribution globale classique */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
                  <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Démographie de l'Efficacité Réseau IMIR
                  </h4>
                  <p className="text-[11px] text-[#6B7A99] mt-0.5">Volume de livreurs classés selon leur taux de livraison final sans limitation de dispatches</p>
                </div>
                
                <div className="h-64 relative mt-3">
                  <canvas ref={chartRef}></canvas>
                </div>
              </div>

              <div className="bg-white/10 rounded-lg p-3 text-[11px] text-slate-700 mt-4 leading-relaxed font-sans border border-white/20 font-sans">
                📌 <strong>Analyse d'alignement :</strong> Plus la proportion de profils <strong className="text-emerald-700">Excellent</strong> et <strong className="text-[#1B3A5C]">Bon</strong> est forte, plus la fidélisation de notre clientèle e-merchandiser est sécurisée.
              </div>
            </div>
          </div>

          {/* Grand tableau exhaustif de score classique */}
          <div className="glass-panel p-5 rounded-xl">
            <div className="mb-4 pb-2 border-b border-white/20">
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">
                Classement National de l'Indice d'Efficacité Classique
              </h4>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">Tous les livreurs du réseau triés par Score classique décroissant (seuil minimal obligatoire de 20 dispatches)</p>
            </div>

            <div className="overflow-x-auto custom-scrollbar max-h-96">
              <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
                <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">#</th>
                    <th className="px-3 py-2.5">Livreur</th>
                    <th className="px-3 py-2.5">Station</th>
                    <th className="px-3 py-2.5 text-right w-24">Disp.</th>
                    <th className="px-3 py-2.5 text-right w-24">Livrés</th>
                    <th className="px-3 py-2.5 text-right w-24 text-red-500">Retours</th>
                    <th className="px-3 py-2.5 text-center w-28">Tx Livr.</th>
                    <th className="px-3 py-2.5 text-center w-28">Tx Ret.</th>
                    <th className="px-3 py-2.5 text-right w-28">Délai(h)</th>
                    <th className="px-3 py-2.5 text-right w-20">J. Actifs</th>
                    <th className="px-3 py-2.5 text-right w-20">Moy/J</th>
                    <th className="px-3 py-2.5 text-right w-28">Rémunération</th>
                    <th className="px-4 py-2.5 text-center w-48 font-bold">Score Classique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F3F8]">
                  {listPerformanceAll.map((l, idx) => {
                    const score = getCompositeScore(l);

                    return (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-[#1B3A5C] truncate max-w-[140px]">{l.livreur}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[140px]">{l.station}</td>
                        <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600">{N(l.livres)}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-600">{N(l.retours)}</td>
                        <td className="px-3 py-2 text-center font-mono text-emerald-600">{P(l.taux_livraison)}</td>
                        <td className="px-3 py-2 text-center font-mono text-red-600">{P(l.taux_retour)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-650">{l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–"}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{N(l.jours_actifs)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{F(l.moy_colis_jour)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-700">{N(l.remun)} <span className="text-[9px] font-normal text-slate-400">DA</span></td>
                        
                        {/* Score composite progresse bar */}
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-between space-x-2">
                            <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-2 rounded-full ${getScoreColorClass(score)}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className={`w-14 text-right font-bold font-mono text-xs ${getScoreTextColor(score)}`}>
                              {F(score)}/100
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {/* Toast Notificateur Local */}
      <AnimatePresence>
        {localToast && (
          <motion.div
Key="local-toast-perf"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-2 bg-slate-900 text-white min-w-[280px] border border-slate-800"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold font-sans">{localToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
