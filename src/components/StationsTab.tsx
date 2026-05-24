import { useEffect, useRef, useMemo, useState } from "react";
import Chart from "chart.js/auto";
import { AppData, StationRecap } from "../types";
import { N, F, P } from "../utils";
import { Map, Landmark, Table as TableIcon, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { exportStationsExcel } from "../exportExcel";
import { exportStationsPdf } from "../exportPdf";

interface StationsTabProps {
  data: AppData;
}

export default function StationsTab({ data }: StationsTabProps) {
  const volChartRef = useRef<HTMLCanvasElement | null>(null);
  const rateChartRef = useRef<HTMLCanvasElement | null>(null);
  const volChartInstance = useRef<Chart | null>(null);
  const rateChartInstance = useRef<Chart | null>(null);

  const [localToast, setLocalToast] = useState<string | null>(null);

  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(null);
    }, 3000);
  };

  // Classer et filtrer les 25 premières stations par volume de dispatches
  const top25Stations = useMemo(() => {
    return [...data.by_station]
      .sort((a, b) => b.total_dispatches - a.total_dispatches)
      .slice(0, 25);
  }, [data]);

  useEffect(() => {
    // 1. Bar Chart Horizontal : Volume par Station (Dispatchés vs Livrés)
    if (volChartRef.current) {
      if (volChartInstance.current) {
        volChartInstance.current.destroy();
      }

      // Prendre les 15 premières stations pour plus de lisibilité sur le graphique horizontal
      const plist = top25Stations.slice(0, 15);
      const labels = plist.map(s => s.station.replace(/^(\d+)\s*-\s*Station\s+/, ""));
      const dispatches = plist.map(s => s.total_dispatches);
      const livres = plist.map(s => s.total_livres);

      volChartInstance.current = new Chart(volChartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Dispatchés",
              data: dispatches,
              backgroundColor: "#1B3A5C",
              borderRadius: 4
            },
            {
              label: "Livrés",
              data: livres,
              backgroundColor: "#18A558",
              borderRadius: 4
            }
          ]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { family: "DM Sans", size: 10, weight: "bold" } }
            },
            tooltip: {
              titleFont: { family: "DM Sans" },
              bodyFont: { family: "DM Sans" }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: "#F0F3F8" },
              ticks: { font: { family: "DM Mono", size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: "DM Sans", size: 9, weight: "bold" } }
            }
          }
        }
      });
    }

    // 2. Bar Chart Horizontal : Taux de Livraison par Station
    if (rateChartRef.current) {
      if (rateChartInstance.current) {
        rateChartInstance.current.destroy();
      }

      const plist = top25Stations.slice(0, 15);
      const labels = plist.map(s => s.station.replace(/^(\d+)\s*-\s*Station\s+/, ""));
      const tauxList = plist.map(s => s.taux_moy);

      // Déterminer la couleur de chaque barre individuellement : vert >= 80%, navy 65-80%, rouge < 65%
      const bgColors = tauxList.map(tx => {
        if (tx >= 80) return "#18A558";
        if (tx >= 65) return "#1B3A5C";
        return "#D93025";
      });

      rateChartInstance.current = new Chart(rateChartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Taux de livraison (%)",
              data: tauxList,
              backgroundColor: bgColors,
              borderRadius: 4,
              barPercentage: 0.7
            }
          ]
        },
        options: {
          indexAxis: "y",
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
            x: {
              beginAtZero: true,
              max: 100,
              grid: { color: "#F0F3F8" },
              ticks: { font: { family: "DM Mono", size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: "DM Sans", size: 9, weight: "bold" } }
            }
          }
        }
      });
    }

    return () => {
      volChartInstance.current?.destroy();
      rateChartInstance.current?.destroy();
    };
  }, [top25Stations]);

  // Établir un statut de station
  const renderStationStatus = (taux: number) => {
    if (taux >= 80) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Performante</span>;
    }
    if (taux >= 65) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200">Normale</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">À améliorer</span>;
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            🏢 Performances par Station
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Cartographie et scoring analytique des hubs de distribution régionaux</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Excel Button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              exportStationsExcel(data);
              triggerLocalToast("✅ Export Excel généré");
            }}
            disabled={!data || !data.by_station || data.by_station.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.by_station || data.by_station.length === 0)
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
              exportStationsPdf(data);
              triggerLocalToast("✅ Rapport PDF généré");
            }}
            disabled={!data || !data.by_station || data.by_station.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors select-none ${
              (!data || !data.by_station || data.by_station.length === 0)
                ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-250 text-slate-400"
                : "border-orange-300 bg-orange-50 text-[#E8741A] hover:bg-orange-100 cursor-pointer"
            }`}
          >
            <FileText size={13} /> PDF
          </motion.button>
        </div>
      </div>

      {/* Grille 2 colonnes avec graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique 1 : Volume par Station */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
              <Landmark className="w-4.5 h-4.5 mr-2 text-sky-850 text-sky-800" />
              Volume de Flux par Hub Régional (Dispatches vs Livrés)
            </h4>
            <p className="text-[11px] text-[#6B7A99] mt-0.5">Top 15 des stations d'Algerie classées par flux opérationnel</p>
          </div>
          <div className="h-96 relative">
            <canvas ref={volChartRef}></canvas>
          </div>
        </div>

        {/* Graphique 2 : Taux de réussite par Station */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="mb-4 pb-2 border-b border-[#F0F3F8]">
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
              <Map className="w-4.5 h-4.5 mr-2 text-indigo-700" />
              Taux Moyen de Réussite Finale par Hub Régional (%)
            </h4>
            <p className="text-[11px] text-[#6B7A99] mt-0.5">Efficacité moyenne cumulée d'après le top 15 des stations d'Algerie</p>
          </div>
          <div className="h-96 relative">
            <canvas ref={rateChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Tableau complet des gares/stations */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-white/20">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">
            Recueil d'Évaluation Exhaustif des Stations Nationales
          </h4>
          <p className="text-[11px] text-[#6B7A99] mt-0.5">Toutes les stations d'Algerie d'expédition et de livraison de colis (tri par volume cumulé)</p>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
          <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
            <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-center w-12">#</th>
                <th className="px-3 py-2.5">Station Destination</th>
                <th className="px-3 py-2.5 text-right w-28">Livreurs distincts</th>
                <th className="px-3 py-2.5 text-right w-28">Total Dispatchs</th>
                <th className="px-3 py-2.5 text-right w-28 text-emerald-400">Total Livrés</th>
                <th className="px-3 py-2.5 text-right w-28 text-red-400">Total Retours</th>
                <th className="px-3 py-2.5 text-center w-36">Taux Réussite Moyen</th>
                <th className="px-3 py-2.5 text-right w-28">Délai Route Moyen</th>
                <th className="px-3 py-2.5 text-center w-32">Statut Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F8]">
              {data.by_station.map((s, idx) => (
                <tr key={s.station} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-[#1B3A5C]">{s.station}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-650">{N(s.nb_livreurs)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{N(s.total_dispatches)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{N(s.total_livres)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-600">{N(s.total_retours)}</td>
                  <td className={`px-3 py-2.5 text-center font-mono font-bold ${
                    s.taux_moy >= 80 ? "text-emerald-600" :
                    s.taux_moy >= 65 ? "text-[#1B3A5C]" : "text-red-650 text-red-650"
                  }`}>{P(s.taux_moy)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{F(s.delai_moy)}h</td>
                  <td className="px-3 py-2.5 text-center">{renderStationStatus(s.taux_moy)}</td>
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
Key="local-toast-stations"
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
