import { AlertTriangle, ChevronRight, ShieldCheck, TrendingDown } from "lucide-react";
import { LivreurRecap } from "../types";
import { Alert, Degradation } from "../lib/alerts";

interface AlertsPanelProps {
  alerts: Alert[];
  degradations: Degradation[];
  thresholdsLoaded: boolean;
  onSelectLivreur?: (livreur: LivreurRecap) => void;
}

export default function AlertsPanel({ alerts, degradations, thresholdsLoaded, onSelectLivreur }: AlertsPanelProps) {
  if (!thresholdsLoaded) return null;

  if (alerts.length === 0 && degradations.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-medium mb-6">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        Aucun livreur sous les seuils d'alerte, aucune dégradation détectée. Réseau conforme.
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Alertes de seuils (triées par gravité) */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-200 bg-red-100/60">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <h3 className="text-xs font-bold text-red-800">
              {alerts.length} livreur{alerts.length > 1 ? "s" : ""} sous les seuils d'alerte — du plus critique au moins critique
            </h3>
          </div>
          <div className="divide-y divide-red-100 max-h-72 overflow-y-auto custom-scrollbar">
            {alerts.map((a, rank) => (
              <button
                key={a.livreur.id}
                onClick={() => onSelectLivreur?.(a.livreur)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-red-100/50 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span className="text-[10px] font-mono font-bold text-red-400 mt-0.5 flex-shrink-0">#{rank + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1B3A5C] truncate">
                      {a.livreur.livreur} <span className="text-[10px] text-[#6B7A99] font-normal">— {a.livreur.station}</span>
                    </p>
                    <p className="text-[10px] text-red-700 mt-0.5 truncate">{a.reasons.join(" · ")}</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dégradations depuis l'import précédent */}
      {degradations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-amber-100/60">
            <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <h3 className="text-xs font-bold text-amber-800">
              {degradations.length} livreur{degradations.length > 1 ? "s" : ""} en forte baisse depuis l'import précédent
            </h3>
          </div>
          <div className="divide-y divide-amber-100 max-h-60 overflow-y-auto custom-scrollbar">
            {degradations.map((d) => (
              <button
                key={d.livreur.id}
                onClick={() => onSelectLivreur?.(d.livreur)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-amber-100/50 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1B3A5C] truncate">
                    {d.livreur.livreur} <span className="text-[10px] text-[#6B7A99] font-normal">— {d.livreur.station}</span>
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5 truncate">{d.changes.join(" · ")}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
