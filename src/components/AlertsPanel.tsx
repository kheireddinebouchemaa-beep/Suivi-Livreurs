import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { LivreurRecap } from "../types";
import { Threshold } from "../lib/api";
import { N, P } from "../utils";

interface Alert {
  livreur: LivreurRecap;
  reasons: string[];
}

function computeAlerts(recap: LivreurRecap[], thresholds: Threshold[]): Alert[] {
  const byKey: Record<string, Threshold> = {};
  thresholds.forEach((t) => (byKey[t.key] = t));

  const alerts: Alert[] = [];

  for (const l of recap) {
    const reasons: string[] = [];

    const tauxMin = byKey["taux_livraison_min"];
    if (tauxMin && l.taux_livraison < tauxMin.value) {
      reasons.push(`Taux de livraison ${P(l.taux_livraison)} (seuil ${tauxMin.value}%)`);
    }

    const socMin = byKey["soc_min"];
    if (socMin && l.soc < socMin.value) {
      reasons.push(`SOC ${N(l.soc)} (seuil ${socMin.value})`);
    }

    const retourMax = byKey["taux_retour_max"];
    if (retourMax && l.taux_retour > retourMax.value) {
      reasons.push(`Taux de retour ${P(l.taux_retour)} (seuil ${retourMax.value}%)`);
    }

    const delaiMax = byKey["delai_enc_max_h"];
    if (delaiMax && l.delai_enc_h > delaiMax.value) {
      reasons.push(`Délai encaissement ${N(l.delai_enc_h)}h (seuil ${delaiMax.value}h)`);
    }

    if (reasons.length > 0) alerts.push({ livreur: l, reasons });
  }

  return alerts.sort((a, b) => b.reasons.length - a.reasons.length);
}

interface AlertsPanelProps {
  recap: LivreurRecap[];
  thresholds: Threshold[];
  onSelectLivreur?: (livreur: LivreurRecap) => void;
}

export default function AlertsPanel({ recap, thresholds, onSelectLivreur }: AlertsPanelProps) {
  const alerts = computeAlerts(recap, thresholds);

  if (thresholds.length === 0) return null;

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-medium mb-6">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        Aucun livreur sous les seuils d'alerte actuels. Réseau conforme.
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-red-200 bg-red-100/60">
        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
        <h3 className="text-xs font-bold text-red-800">
          {alerts.length} livreur{alerts.length > 1 ? "s" : ""} sous les seuils d'alerte
        </h3>
      </div>
      <div className="divide-y divide-red-100 max-h-72 overflow-y-auto custom-scrollbar">
        {alerts.map((a) => (
          <button
            key={a.livreur.id}
            onClick={() => onSelectLivreur?.(a.livreur)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-red-100/50 transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#1B3A5C] truncate">
                {a.livreur.livreur} <span className="text-[10px] text-[#6B7A99] font-normal">— {a.livreur.station}</span>
              </p>
              <p className="text-[10px] text-red-700 mt-0.5 truncate">{a.reasons.join(" · ")}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
