import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { AppData, LivreurRecap } from "../types";
import { N, F, P, getPerfCategory } from "../utils";
import { TrendingUp, Users, Clock, AlertTriangle, CheckCircle, Package, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

interface OverviewTabProps {
  data: AppData;
  onNavigateToLivreurs: () => void;
  onNavigateToRetours: () => void;
  onNavigateToDelais: () => void;
}

export default function OverviewTab({ data, onNavigateToLivreurs, onNavigateToRetours, onNavigateToDelais }: OverviewTabProps) {
  const lineChartRef = useRef<HTMLCanvasElement | null>(null);
  const barChartRef = useRef<HTMLCanvasElement | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

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

  return (
    <div className="space-y-6">
      {/* 1. Bandeau "Spotlight" (fond dégradé navy glass) */}
      <div className="bg-gradient-to-r from-[#1B3A5C]/85 via-[#244C78]/85 to-[#1B3A5C]/85 backdrop-blur-md rounded-2xl p-6 text-white shadow-md relative overflow-hidden border border-white/10">
        {/* Glow Effet */}
        <div className="absolute right-0 top-0 -mr-20 -mt-20 w-80 h-80 bg-orange/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <h3 className="text-xs uppercase tracking-wider font-bold text-orange-400 mb-4 font-sans">Spotlight Opérationnel</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="pt-3 md:pt-0">
            <span className="block text-xs text-slate-300">Livreurs actifs</span>
            <span className="text-2xl font-bold font-mono text-white">{N(data.global.nb_livreurs)}</span>
          </div>
          
          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Total Dispatchés</span>
            <span className="text-2xl font-bold font-mono text-white">{N(data.global.total_dispatches)}</span>
          </div>

          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Total Livrés</span>
            <span className="text-2xl font-bold font-mono text-[#18A558]">{N(data.global.total_livres)}</span>
          </div>

          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Taux Livraison</span>
            <span className="text-2xl font-bold font-mono text-orange-450 text-[#E8741A]">{P(data.global.taux_global)}</span>
          </div>

          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Total Retours</span>
            <span className="text-2xl font-bold font-mono text-[#D93025]">{N(data.global.total_retours)}</span>
          </div>

          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Taux Retour</span>
            <span className="text-2xl font-bold font-mono text-red-300">
              {data.global.total_dispatches > 0 ? P((data.global.total_retours / data.global.total_dispatches) * 100) : "0%"}
            </span>
          </div>

          <div className="pt-3 md:pt-0 md:pl-4">
            <span className="block text-xs text-slate-300">Délai Moyen</span>
            <span className="text-2xl font-bold font-mono text-yellow-400">{F(data.global.delai_moy)}h</span>
          </div>
        </div>
      </div>

      {/* 2. Grille 8 KPI cards (4x2) avec bande colorée en haut */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taux livraison global */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-emerald-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Taux Livraison Global</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{P(data.global.taux_global)}</h3>
              <p className="text-[10px] text-emerald-600 mt-1 flex items-center font-sans font-medium">
                <CheckCircle className="w-3 h-3 mr-1" /> Performance cible : ≥ 90%
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Total dispatchés */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-sky-600 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Dispatchés</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{N(data.global.total_dispatches)}</h3>
              <p className="text-[10px] text-slate-500 mt-1 font-sans">Colis confiés au réseau</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Total livrés */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-emerald-600 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Livrés</p>
              <h3 className="text-3xl font-bold font-mono text-emerald-600 mt-1">{N(data.global.total_livres)}</h3>
              <p className="text-[10px] text-emerald-500 mt-1 font-sans">Remises clients effectives</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Total retours */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-red-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Retours</p>
              <h3 className="text-3xl font-bold font-mono text-red-600 mt-1">{N(data.global.total_retours)}</h3>
              <p className="text-[10px] text-red-500 mt-1 font-sans">Retours initiés & confirmés</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Délai moyen dispatch -> livré */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-[#E8741A] w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Délai Dispatch → Livré</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{F(data.global.delai_moy)}h</h3>
              <p className="text-[10px] text-[#E8741A] mt-1 font-sans font-medium">Temps de transit route</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#E8741A]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Délai moyen encaissement */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-amber-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Délai Encaissement</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{F(data.global.delai_encaiss_moy)}h</h3>
              <p className="text-[10px] text-amber-600 mt-1 font-sans">Livré → Encaissé</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Livreurs actifs */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-teal-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Livreurs Actifs</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{N(data.global.nb_livreurs)}</h3>
              <p className="text-[10px] text-teal-600 mt-1 font-sans">Dans l'export analysé</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Non livrés */}
        <div className="glass-panel rounded-xl overflow-hidden relative hover:shadow-md transition-all duration-300">
          <div className="h-1.5 bg-purple-500 w-full"></div>
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Colis Non Livrés</p>
              <h3 className="text-3xl font-bold font-mono text-[#1B3A5C] mt-1">{N(data.global.non_livres)}</h3>
              <p className="text-[10px] text-purple-600 mt-1 font-sans">Différence (Dispatch - Livré)</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
