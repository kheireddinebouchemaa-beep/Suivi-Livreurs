import { useEffect, useRef, useMemo } from "react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getPerfCategory, getCompositeScore } from "../utils";
import { ShieldCheck, Trophy, Sparkles } from "lucide-react";

interface PerformanceTabProps {
  data: AppData;
}

export default function PerformanceTab({ data }: PerformanceTabProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

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

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new Chart(chartRef.current, {
        type: "doughnut",
        data: {
          labels: ["Excellent (≥90%)", "Bon (75-90%)", "Moyen (60-75%)", "Faible (<60%)"],
          datasets: [
            {
              data: [
                distPerformance.Excellent,
                distPerformance.Bon,
                distPerformance.Moyen,
                distPerformance.Faible
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
  }, [distPerformance]);

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

  return (
    <div className="space-y-6">
      {/* Alert strip bleue */}
      <div className="bg-blue-950/10 border-l-4 border-l-[#1B3A5C] rounded-r-xl p-4 flex items-start space-x-3 text-blue-900 shadow-2xs backdrop-blur-md border border-white/10">
        <ShieldCheck className="w-5 h-5 text-[#1B3A5C] flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-blue-950 font-sans">Calculateur du Score Opérationnel Composite (SOC)</h4>
          <p className="text-xs mt-1 text-slate-800 font-sans">
            Pour évaluer équitablement nos partenaires d'expédition, IMIR Logistics a instauré le <strong>Score Opérationnel Composite</strong> :
            <br />
            <span className="font-mono bg-blue-100/60 text-[#1B3A5C] px-1.5 py-0.5 rounded text-[10px] mt-1.5 inline-block">
              SOC = (60% × Taux de Livraison) + (40% × Rapidité d'Expédition)
            </span>
            <br />
            La composante de rapidité d'expédition est un ratio normalisé où les tournées de moins de 12h octroient un point maximal (100%), tandis que les tournées excédant 96h sont pénalisées (0%).
          </p>
        </div>
      </div>

      {/* 4 KPI cards */}
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

      {/* Grille 2 colonnes */}
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

        {/* Droite : Donut distribution globale */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
              <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-emerald-650 text-emerald-600" />
                Démographie de l'Efficacité Réseau IMIR
              </h4>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">Volume de livreurs classés selon leur taux de livraison final sans limitation de dispatches</p>
            </div>
            
            <div className="h-64 relative mt-3">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-3 text-[11px] text-slate-700 mt-4 leading-relaxed font-sans border border-white/20">
            📌 <strong>Analyse d'alignement :</strong> Plus la proportion de profils <strong className="text-emerald-700">Excellent</strong> et <strong className="text-[#1B3A5C]">Bon</strong> est forte, plus la fidélisation de notre clientèle e-merchandiser est sécurisée. Les profils <strong className="text-red-650 text-red-600">Faibles</strong> constituent des maillons à réformer.
          </div>
        </div>
      </div>

      {/* Grand tableau exhaustif de score */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-white/20">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">
            Classement National de l'Indice d'Efficacité SOC
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
                <th className="px-3 py-2.5 text-right w-24">Disp.</th>
                <th className="px-3 py-2.5 text-right w-24">Livrés</th>
                <th className="px-3 py-2.5 text-right w-24 text-red-500">Retours</th>
                <th className="px-3 py-2.5 text-center w-28">Tx Livr.</th>
                <th className="px-3 py-2.5 text-center w-28">Tx Ret.</th>
                <th className="px-3 py-2.5 text-right w-28">Délai(h)</th>
                <th className="px-3 py-2.5 text-right w-20">J. Actifs</th>
                <th className="px-3 py-2.5 text-right w-20">Moy/J</th>
                <th className="px-3 py-2.5 text-right w-28">Rémunération</th>
                <th className="px-4 py-2.5 text-center w-48 font-bold">Score (SOC)</th>
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
    </div>
  );
}
