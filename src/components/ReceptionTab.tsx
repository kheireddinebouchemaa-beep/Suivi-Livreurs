import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { AppData, ReceptionJour } from "../types";
import { N, P } from "../utils";

interface ReceptionTabProps {
  data: AppData;
}

type Granularite = "jour" | "semaine" | "mois";

interface Periode {
  key: string;      // clé de tri (ISO)
  label: string;     // libellé affiché
  recus: number;
  en_traitement: number;
}

// Lundi de la semaine ISO contenant cette date, au format YYYY-MM-DD.
function lundiSemaine(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day; // décaler jusqu'au lundi
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatDateFr(dateIso: string): string {
  const [y, m, d] = dateIso.split("-");
  return `${d}/${m}/${y}`;
}

function formatMoisFr(moisIso: string): string {
  const [y, m] = moisIso.split("-");
  const noms = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${noms[parseInt(m, 10) - 1]} ${y}`;
}

function regrouper(rows: ReceptionJour[], granularite: Granularite): Periode[] {
  if (granularite === "jour") {
    return rows.map(r => ({ key: r.date, label: formatDateFr(r.date), recus: r.recus, en_traitement: r.en_traitement }));
  }

  const buckets: Record<string, { recus: number; en_traitement: number }> = {};
  for (const r of rows) {
    const key = granularite === "semaine" ? lundiSemaine(r.date) : r.date.slice(0, 7);
    if (!buckets[key]) buckets[key] = { recus: 0, en_traitement: 0 };
    buckets[key].recus += r.recus;
    buckets[key].en_traitement += r.en_traitement;
  }
  return Object.keys(buckets).sort().map(key => ({
    key,
    label: granularite === "semaine" ? `Semaine du ${formatDateFr(key)}` : formatMoisFr(key),
    recus: buckets[key].recus,
    en_traitement: buckets[key].en_traitement
  }));
}

export default function ReceptionTab({ data }: ReceptionTabProps) {
  const [granularite, setGranularite] = useState<Granularite>("jour");
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const periodes = useMemo(() => regrouper(data.reception_journaliere, granularite), [data.reception_journaliere, granularite]);
  const periodesRecentesDabord = useMemo(() => [...periodes].reverse(), [periodes]);

  const totalRecus = data.reception_journaliere.reduce((s, r) => s + r.recus, 0);
  const totalEnTraitement = data.reception_journaliere.reduce((s, r) => s + r.en_traitement, 0);
  const tauxEnTraitement = totalRecus > 0 ? (totalEnTraitement / totalRecus) * 100 : 0;

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();

    // Dernières périodes seulement pour la lisibilité du graphe (le tableau ci-dessous, lui,
    // montre tout l'historique).
    const maxPoints = granularite === "jour" ? 60 : granularite === "semaine" ? 26 : 24;
    const visible = periodes.slice(-maxPoints);

    chartInstance.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: visible.map(p => p.label),
        datasets: [
          {
            label: "Reçus",
            data: visible.map(p => p.recus),
            backgroundColor: "rgba(27, 58, 92, 0.75)",
            borderRadius: 4,
          },
          {
            label: "Encore en traitement",
            data: visible.map(p => p.en_traitement),
            backgroundColor: "rgba(232, 116, 26, 0.85)",
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12, font: { family: "DM Sans", size: 12 } } },
          tooltip: { titleFont: { family: "DM Sans" }, bodyFont: { family: "DM Sans" } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#EBF0FA" }, ticks: { font: { family: "DM Mono", size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { family: "DM Mono", size: 9 }, maxRotation: 60, autoSkip: true } }
        }
      }
    });

    return () => { chartInstance.current?.destroy(); };
  }, [periodes, granularite]);

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-[#DDE3EE]/40">
        <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
          📥 Réception — Reçus vs En Traitement
        </h2>
        <p className="text-[11px] text-[#6B7A99]">
          Colis reçus par période, et combien d'entre eux sont encore en traitement à ce jour (ni livrés, ni retournés)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Reçus</p>
          <h3 className="text-2xl font-bold font-mono text-[#1B3A5C]">{N(totalRecus)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">Sur toute la période importée</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Encore En Traitement</p>
          <h3 className="text-2xl font-bold font-mono text-[#E8741A]">{N(totalEnTraitement)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">Ni livrés, ni retournés, à ce jour</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Taux En Traitement</p>
          <h3 className={`text-2xl font-bold font-mono ${tauxEnTraitement > 20 ? "text-red-600" : tauxEnTraitement > 10 ? "text-amber-600" : "text-emerald-600"}`}>
            {P(tauxEnTraitement)}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans">Part des colis reçus jamais résolus</p>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-3 border-b border-[#F0F3F8] gap-3">
          <div>
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans">Évolution</h4>
            <p className="text-[11px] text-[#6B7A99]">Reçus vs encore en traitement</p>
          </div>
          <div className="flex gap-1.5">
            {(["jour", "semaine", "mois"] as Granularite[]).map(g => (
              <button
                key={g}
                onClick={() => setGranularite(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                  granularite === g ? "bg-[#1B3A5C] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80 relative">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-[#1B3A5C] text-xs uppercase tracking-wider font-sans">Détail par {granularite}</h4>
        </div>
        <div className="overflow-auto max-h-[500px] custom-scrollbar">
          {periodesRecentesDabord.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Aucune donnée disponible.</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-[#1B3A5C] capitalize">{granularite}</th>
                  <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Reçus</th>
                  <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">En traitement</th>
                  <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Taux</th>
                </tr>
              </thead>
              <tbody>
                {periodesRecentesDabord.map(p => {
                  const taux = p.recus > 0 ? (p.en_traitement / p.recus) * 100 : 0;
                  return (
                    <tr key={p.key} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-semibold text-[#1B3A5C]">{p.label}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{N(p.recus)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[#E8741A] font-bold">{N(p.en_traitement)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${taux > 20 ? "text-red-600 font-bold" : taux > 10 ? "text-amber-600" : "text-slate-500"}`}>
                        {P(taux)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
