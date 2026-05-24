import { useEffect, useRef, useMemo, useState } from "react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getDelaiCategory } from "../utils";
import { AlertTriangle, Clock, TrendingUp, Table as TableIcon, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportDelaisExcel } from "../exportExcel";
import { exportDelaisPdf } from "../exportPdf";

interface DelaisTabProps {
  data: AppData;
}

export default function DelaisTab({ data }: DelaisTabProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  // Filtrer les livreurs avec au moins 10 dispatches
  const relevantLivreurs = useMemo(() => {
    return data.recap.filter(l => l.dispatches >= 10 && l.delai_moy_h > 0);
  }, [data]);

  // Distribution des délais
  const distributions = useMemo(() => {
    const counts = { Rapide: 0, Normal: 0, Lent: 0, TresLent: 0 };
    relevantLivreurs.forEach(l => {
      const cat = getDelaiCategory(l.delai_moy_h);
      if (cat === "Rapide") counts.Rapide++;
      else if (cat === "Normal") counts.Normal++;
      else if (cat === "Lent") counts.Lent++;
      else counts.TresLent++;
    });
    return counts;
  }, [relevantLivreurs]);

  // Top 15 plus lents (≥10 dispatches)
  const top15Lents = useMemo(() => {
    return [...relevantLivreurs]
      .sort((a, b) => b.delai_moy_h - a.delai_moy_h)
      .slice(0, 15);
  }, [relevantLivreurs]);

  // Tous les livreurs (≥10 dispatches, triés par délai décroissant)
  const listDelaiExhaustive = useMemo(() => {
    return [...relevantLivreurs].sort((a, b) => b.delai_moy_h - a.delai_moy_h);
  }, [relevantLivreurs]);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: ["Rapide (≤24h)", "Normal (24-48h)", "Lent (48-72h)", "Très Lent (>72h)"],
          datasets: [
            {
              label: "Nombre de livreurs",
              data: [
                distributions.Rapide,
                distributions.Normal,
                distributions.Lent,
                distributions.TresLent
              ],
              backgroundColor: ["#18A558", "#1B3A5C", "#F5A623", "#D93025"],
              borderRadius: 6,
              barPercentage: 0.6
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
              grid: { color: "#F0F3F8" },
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

    return () => {
      chartInstance.current?.destroy();
    };
  }, [distributions]);

  // Badge couleur délalis
  const renderDelaiTag = (h: number) => {
    const cat = getDelaiCategory(h);
    switch (cat) {
      case "Rapide":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-250">⏳ Rapide (≤24h)</span>;
      case "Normal":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1B3A5C] border border-[#1B3A5C]/20">⏳ Normal (24-48h)</span>;
      case "Lent":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-900 border border-orange-200">⏳ Lent (48-72h)</span>;
      case "Très lent":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">⏳ Très Lent ({">"}72h)</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            ⏱️ Délais de transit réseau
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Pilotage chronométrique, transit d'itinéraires et temps financiers</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportDelaisExcel(data);
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
              exportDelaisPdf(data);
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

      {/* Alert strip orange */}
      <div className="bg-[#E8741A]/10 border-l-4 border-l-[#E8741A] rounded-r-xl p-4 flex items-start space-x-3 text-orange-900 shadow-2xs backdrop-blur-md border border-white/10">
        <Clock className="w-5 h-5 text-[#E8741A] flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-orange-950 font-sans">Analyse des Délais de Transit Réseau</h4>
          <p className="text-xs mt-1 text-orange-900 font-sans">
            Nous analysons trois indicateurs chronométriques clés pour identifier les goulots d'étranglement :
            <br />
            1. <strong>Délai Moyen Dispatch → Livré :</strong> Temps global de transit réel entre l'attribution au livreur et le dépôt client.
            <br />
            2. <strong>Délai Feuille de Route :</strong> Temps d'acheminement depuis l'activation officielle de la tournée logicielle.
            <br />
            3. <strong>Délai d'Encaissement :</strong> Fluidité financière mesurant le laps de temps entre la livraison réussie et l'enregistrement de l'encaissement.
          </p>
        </div>
      </div>

      {/* 6 KPI Cards correspondantes */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Moyenne Générale */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] uppercase font-bold text-slate-500">Dispatch → Livré</p>
          <p className="text-2xl font-bold font-mono text-[#1B3A5C] mt-1">{F(data.global.delai_moy)}h</p>
          <span className="text-[9px] text-[#6B7A99]">Moyenne globale</span>
        </div>

        {/* Moyenne FDR */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs font-sans">
          <p className="text-[10px] uppercase font-bold text-slate-500">FDR Activée → Livré</p>
          <p className="text-2xl font-bold font-mono text-indigo-900 mt-1">
            {F(data.recap.reduce((sum, l) => sum + l.delai_fdr_h, 0) / Math.max(1, data.recap.filter(l => l.delai_fdr_h > 0).length))}h
          </p>
          <span className="text-[9px] text-slate-500">Moyenne tournées</span>
        </div>

        {/* Moyenne Encaissement */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] uppercase font-bold text-slate-500">Délai Encaissé</p>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{F(data.global.delai_encaiss_moy)}h</p>
          <span className="text-[9px] text-slate-500">Transit financier</span>
        </div>

        {/* Très Lents */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-red-500/20 bg-red-500/5">
          <p className="text-[10px] uppercase font-bold text-red-650 text-red-600">🔴 Très Lents ({"/"}72h)</p>
          <p className="text-2xl font-bold font-mono text-red-600 mt-1">{distributions.TresLent}</p>
          <span className="text-[9px] text-red-500">Livreurs critiques</span>
        </div>

        {/* Lents */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-orange-500/20 bg-orange-500/5">
          <p className="text-[10px] uppercase font-bold text-orange-655 text-[#E8741A]">⚠️ Lents (48-72h)</p>
          <p className="text-2xl font-bold font-mono text-[#E8741A] mt-1">{distributions.Lent}</p>
          <span className="text-[9px] text-orange-500">Livreurs à surveiller</span>
        </div>

        {/* Rapides */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[10px] uppercase font-bold text-emerald-650 text-emerald-600">🟢 Rapides (≤24h)</p>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{distributions.Rapide}</p>
          <span className="text-[9px] text-emerald-500">Excellente réactivité</span>
        </div>
      </div>

      {/* Grille 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 15 plus lents */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1.5 text-red-650 text-red-600 animate-pulse" />
              Top 15 Livreurs les Plus Lents du Réseau
            </h4>
            <p className="text-[11px] text-[#6B7A99] mt-0.5">Livreurs enregistrant les délais moyens les plus élevés (dispatches ≥ 10)</p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-700 font-medium">
              <thead className="bg-[#1B3A5C]/85 text-white backdrop-blur-md">
                <tr>
                  <th className="px-3 py-2 text-center w-10">Rég.</th>
                  <th className="px-3 py-2">Livreur</th>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2 text-right w-24">Livrés</th>
                  <th className="px-3 py-2 text-right w-28 text-orange-500">Délai Moyen</th>
                  <th className="px-3 py-2 text-center w-36">Catégorie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F3F8]">
                {top15Lents.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold text-[#1B3A5C]">{l.livreur}</td>
                    <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{l.station}</td>
                    <td className="px-3 py-2 text-right font-mono">{N(l.livres)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600 font-bold">{F(l.delai_moy_h)}h</td>
                    <td className="px-3 py-2 text-center">{renderDelaiTag(l.delai_moy_h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Graphique de distribution */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                <Clock className="w-4 h-4 mr-1.5 text-slate-655 text-sky-700" />
                Distribution Globale des Volumes de Transit Réseau
              </h4>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">Répartition des livreurs selon les quatre catégories horaires de livraison (dispatches ≥ 10)</p>
            </div>
            
            <div className="h-64 relative mt-3">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-3 text-[11px] text-slate-700 mt-4 leading-relaxed font-sans border border-white/20">
            📌 <strong>Norme d'engagement qualité (SLAs) :</strong> Pour garantir la satisfaction d'IMIR Logistics, la cible contractuelle est majeure : l'acheminement standard par route d'un colis doit idéalement s'opérer sous un délai inférieur ou égal à 24h.
          </div>
        </div>
      </div>

      {/* Tableau exhaustif complet des délais */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">
            Classement Chronométrique Exhaustif des Livreurs
          </h4>
          <p className="text-[11px] text-[#6B7A99] mt-0.5">Tous les livreurs triés par délai moyen décroissant (seuil minimal de 10 dispatches)</p>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-96">
          <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
            <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-center w-12">#</th>
                <th className="px-3 py-2.5">Livreur</th>
                <th className="px-3 py-2.5">Station</th>
                <th className="px-3 py-2.5 text-right w-24">Dispatchs</th>
                <th className="px-3 py-2.5 text-right w-24">Livrés</th>
                <th className="px-3 py-2.5 text-right w-28 text-[#E8741A] font-bold">Délai Dispatch(h)</th>
                <th className="px-3 py-2.5 text-right w-28">Délai FDR(h)</th>
                <th className="px-3 py-2.5 text-right w-28">Délai Enc.(h)</th>
                <th className="px-3 py-2.5 text-center w-36">Catégorie Délai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F8]">
              {listDelaiExhaustive.map((l, idx) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-3 py-2 font-bold text-[#1B3A5C]">{l.livreur}</td>
                  <td className="px-3 py-2 text-slate-500 truncate max-w-[180px]">{l.station}</td>
                  <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{N(l.livres)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600 font-bold">{F(l.delai_moy_h)}h</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{F(l.delai_fdr_h)}h</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-650">{F(l.delai_enc_h)}h</td>
                  <td className="px-3 py-2 text-center">{renderDelaiTag(l.delai_moy_h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notificateur Local */}
      <AnimatePresence>
        {localToast && (
          <motion.div
Key="local-toast-delais"
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
    </div>
  );
}
