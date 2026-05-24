import { useEffect, useRef, useMemo, useState } from "react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getRetourCategory } from "../utils";
import { AlertCircle, ShieldAlert, BadgeInfo, Table as TableIcon, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportRetoursExcel } from "../exportExcel";
import { exportRetoursPdf } from "../exportPdf";

interface RetoursTabProps {
  data: AppData;
}

export default function RetoursTab({ data }: RetoursTabProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  // Filtrer les livreurs avec au moins 10 disptaches pour les calculs de répartition
  const relevantLivreurs = useMemo(() => {
    return data.recap.filter(l => l.dispatches >= 10);
  }, [data]);

  // Répartition des livreurs selon la catégorie de taux de retour
  const categoriesCount = useMemo(() => {
    const counts = { Critique: 0, Eleve: 0, Normal: 0, Faible: 0 };
    relevantLivreurs.forEach(l => {
      const cat = getRetourCategory(l.taux_retour);
      if (cat === "Critique") counts.Critique++;
      else if (cat === "Élevé") counts.Eleve++;
      else if (cat === "Normal") counts.Normal++;
      else counts.Faible++;
    });
    return counts;
  }, [relevantLivreurs]);

  // Top 15 retours absolus (parmi ceux qui ont au moins 20 dispatches)
  const top15Incidents = useMemo(() => {
    return data.recap
      .filter(l => l.dispatches >= 20)
      .sort((a, b) => b.retours - a.retours)
      .slice(0, 15);
  }, [data]);

  // Tous les livreurs triés par taux retour décroissant (au moins 10 dispatches)
  const fullListRetour = useMemo(() => {
    return data.recap
      .filter(l => l.dispatches >= 10)
      .sort((a, b) => b.taux_retour - a.taux_retour);
  }, [data]);

  // Taux de retour global
  const tauxRetourGlobal = useMemo(() => {
    if (data.global.total_dispatches === 0) return 0;
    return parseFloat(((data.global.total_retours / data.global.total_dispatches) * 105).toFixed(1)); // Plafonné ? Non, classique
    // Normal : total_retours / total_dispatches * 100
  }, [data]);

  const rawTauxRetourGlobal = data.global.total_dispatches > 0 
    ? parseFloat(((data.global.total_retours / data.global.total_dispatches) * 100).toFixed(1))
    : 0;

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new Chart(chartRef.current, {
        type: "doughnut",
        data: {
          labels: ["Critique (≥30%)", "Élevé (20-30%)", "Normal (10-20%)", "Faible (<10%)"],
          datasets: [
            {
              data: [
                categoriesCount.Critique,
                categoriesCount.Eleve,
                categoriesCount.Normal,
                categoriesCount.Faible
              ],
              backgroundColor: ["#D93025", "#E8741A", "#1B3A5C", "#18A558"],
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
  }, [categoriesCount]);

  // Couleur du tag d'alerte retour
  const renderAlertTag = (tx: number) => {
    const cat = getRetourCategory(tx);
    switch (cat) {
      case "Critique":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">🔴 Critique</span>;
      case "Élevé":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-850 border border-orange-200 text-[#E8741A]">🟠 Élevé</span>;
      case "Normal":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1B3A5C] border border-[#1B3A5C]/20">🔵 Normal</span>;
      case "Faible":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-850 border border-emerald-250 text-emerald-700">🟢 Faible</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            ↩️ Retours &amp; Incidents Colis
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Pilotage opérationnel du taux de retour et désamorçage d'alertes</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportRetoursExcel(data);
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
              exportRetoursPdf(data);
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

      {/* Alert strip rouge */}
      <div className="bg-red-950/10 border-l-4 border-l-[#D93025] rounded-r-xl p-4 flex items-start space-x-3 text-red-900 shadow-2xs backdrop-blur-md border border-white/10">
        <AlertCircle className="w-5 h-5 text-[#D93025] flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-red-950">Suivi Critique des Retours Colis</h4>
          <p className="text-xs mt-1 text-red-900 font-sans">
            Un taux de retour élevé indique des retards de livraison, des refus clients ou des anomalies de tri. 
            Les livreurs associés au statut <strong className="text-red-950 font-bold">Critique (≥ 30%)</strong> ou <strong className="text-orange-950 font-bold">Élevé (20% – 30%)</strong> doivent faire l'objet d'audits opérationnels par la station.
          </p>
        </div>
      </div>

      {/* 6 KPI Cards correspondantes */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total retours */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] uppercase font-bold text-slate-500">Total Retours</p>
          <p className="text-2xl font-bold font-mono text-[#D93025] mt-1">{N(data.global.total_retours)}</p>
          <span className="text-[9px] text-[#6B7A99]">Colis concernés</span>
        </div>

        {/* Taux retour global */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] uppercase font-bold text-slate-500">Taux Retour Global</p>
          <p className="text-2xl font-bold font-mono text-indigo-900 mt-1">{P(rawTauxRetourGlobal)}</p>
          <span className="text-[9px] text-slate-500">Moyenne réseau</span>
        </div>

        {/* Critique */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-red-500/20 bg-red-500/5">
          <p className="text-[10px] uppercase font-bold text-red-650 text-red-600">🛑 Critique (≥30%)</p>
          <p className="text-2xl font-bold font-mono text-red-600 mt-1">{categoriesCount.Critique}</p>
          <span className="text-[9px] text-red-500">Livreurs concernés</span>
        </div>

        {/* Élevé */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-orange-500/20 bg-orange-500/5">
          <p className="text-[10px] uppercase font-bold text-orange-655 text-[#E8741A]">⚠️ Élevé (20-30%)</p>
          <p className="text-2xl font-bold font-mono text-[#E8741A] mt-1">{categoriesCount.Eleve}</p>
          <span className="text-[9px] text-orange-500">Livreurs concernés</span>
        </div>

        {/* Normal */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-slate-500/10">
          <p className="text-[10px] uppercase font-bold text-slate-600">🔵 Normal (10-20%)</p>
          <p className="text-2xl font-bold font-mono text-[#1B3A5C] mt-1">{categoriesCount.Normal}</p>
          <span className="text-[9px] text-[#6B7A99]">Livreurs concernés</span>
        </div>

        {/* Faible */}
        <div className="glass-panel p-4 rounded-xl text-center shadow-2xs border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[10px] uppercase font-bold text-emerald-650 text-emerald-600">🟢 Faible ({"<"}10%)</p>
          <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{categoriesCount.Faible}</p>
          <span className="text-[9px] text-emerald-500">Excellents résultats</span>
        </div>
      </div>

      {/* Grille 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauche : Top 15 retours absolus */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
              <ShieldAlert className="w-4 h-4 mr-1.5 text-red-650 text-red-600" />
              Top 15 Livreurs avec le plus de Retours (Absolus)
            </h4>
            <p className="text-[11px] text-[#6B7A99] mt-0.5">Livreurs générant le plus de volume de retour réseau (dispatches ≥ 20)</p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-700 font-medium">
              <thead className="bg-[#1B3A5C]/85 text-white backdrop-blur-md">
                <tr>
                  <th className="px-3 py-2 text-center w-10">Rég.</th>
                  <th className="px-3 py-2">Livreur</th>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2 text-right w-24">Disp.</th>
                  <th className="px-3 py-2 text-right w-24">Retours</th>
                  <th className="px-3 py-2 text-center w-32">Alerte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F3F8]">
                {top15Incidents.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 font-bold text-[#1B3A5C]">{l.livreur}</td>
                    <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{l.station}</td>
                    <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600 font-bold">{N(l.retours)}</td>
                    <td className="px-3 py-2 text-center">{renderAlertTag(l.taux_retour)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Droite : Donut de répartition */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                <BadgeInfo className="w-4 h-4 mr-1.5 text-blue-900" />
                Catégorisation Globale des Risques de Retour
              </h4>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">Analyse de la répartition des livreurs en fonction de leur taux de retour (dispatches ≥ 10)</p>
            </div>
            
            <div className="h-64 relative mt-3">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-3 text-[11px] text-slate-700 mt-4 leading-relaxed font-sans border border-white/20">
            📌 <strong>Analyse d'impact :</strong> La répartition permet d'évaluer la santé globale des flux en évaluant si le volume de retour est concentré sur quelques livreurs isolés ou généralisé à l'ensemble du réseau.
          </div>
        </div>
      </div>

      {/* Tableau complet livreurs (dispatches >= 10) par taux de retour décroissant */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">
            Classement Exhaustif des Taux de Retour Colis
          </h4>
          <p className="text-[11px] text-[#6B7A99] mt-0.5">Tous les livreurs triés par taux de retour décroissant (seuil minimal obligatoire de 10 dispatches)</p>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-96">
          <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
            <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10 shadow-3xs">
              <tr>
                <th className="px-3 py-2.5 text-center w-12">#</th>
                <th className="px-3 py-2.5">Livreur</th>
                <th className="px-3 py-2.5">Station</th>
                <th className="px-3 py-2.5 text-right w-24">Dispatchs</th>
                <th className="px-3 py-2.5 text-right w-24">Livrés</th>
                <th className="px-3 py-2.5 text-right w-24 font-bold text-[#D93025]">Retours</th>
                <th className="px-3 py-2.5 text-center w-32">Taux Retour</th>
                <th className="px-3 py-2.5 text-center w-36">Alerte Retour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F8]">
              {fullListRetour.map((l, idx) => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-3 py-2 font-bold text-[#1B3A5C]">{l.livreur}</td>
                  <td className="px-3 py-2 text-slate-500 truncate max-w-[180px]">{l.station}</td>
                  <td className="px-3 py-2 text-right font-mono">{N(l.dispatches)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#18A558]">{N(l.livres)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600 font-semibold">{N(l.retours)}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-red-600">{P(l.taux_retour)}</td>
                  <td className="px-3 py-2 text-center">{renderAlertTag(l.taux_retour)}</td>
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
Key="local-toast-retours"
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
