import { LivreurRecap } from "../types";
import { Threshold } from "./api";
import { N, P } from "../utils";

export interface Alert {
  livreur: LivreurRecap;
  reasons: string[];
  severity: number; // plus c'est haut, plus c'est grave (sert au tri)
}

export interface Degradation {
  livreur: LivreurRecap;
  changes: string[];
}

// Ampleur relative du dépassement d'un seuil, pour pondérer la gravité :
// être à 40% de taux de livraison avec un seuil à 70% est plus grave qu'être à 68%.
function overshoot(value: number, threshold: number): number {
  if (threshold === 0) return 1;
  return Math.abs(value - threshold) / Math.abs(threshold);
}

export function computeAlerts(recap: LivreurRecap[], thresholds: Threshold[]): Alert[] {
  const byKey: Record<string, Threshold> = {};
  thresholds.forEach((t) => (byKey[t.key] = t));

  const alerts: Alert[] = [];

  for (const l of recap) {
    const reasons: string[] = [];
    let severity = 0;

    const tauxMin = byKey["taux_livraison_min"];
    if (tauxMin && l.taux_livraison < tauxMin.value) {
      reasons.push(`Taux de livraison ${P(l.taux_livraison)} (seuil ${tauxMin.value}%)`);
      severity += 1 + overshoot(l.taux_livraison, tauxMin.value);
    }

    const socMin = byKey["soc_min"];
    if (socMin && l.soc < socMin.value) {
      reasons.push(`SOC ${N(l.soc)} (seuil ${socMin.value})`);
      severity += 1 + overshoot(l.soc, socMin.value);
    }

    const retourMax = byKey["taux_retour_max"];
    if (retourMax && l.taux_retour > retourMax.value) {
      reasons.push(`Taux de retour ${P(l.taux_retour)} (seuil ${retourMax.value}%)`);
      severity += 1 + overshoot(l.taux_retour, retourMax.value);
    }

    const delaiMax = byKey["delai_enc_max_h"];
    if (delaiMax && l.delai_enc_h > delaiMax.value) {
      reasons.push(`Délai encaissement ${N(l.delai_enc_h)}h (seuil ${delaiMax.value}h)`);
      severity += 1 + overshoot(l.delai_enc_h, delaiMax.value);
    }

    if (reasons.length > 0) alerts.push({ livreur: l, reasons, severity });
  }

  return alerts.sort((a, b) => b.severity - a.severity);
}

// Seuils de variation considérés comme une dégradation significative entre deux imports
const DROP_TAUX_LIVRAISON = 10; // points de %
const DROP_SOC = 10; // points de score
const RISE_TAUX_RETOUR = 10; // points de %
const MIN_DISPATCHES = 10; // volume minimal dans chaque période pour éviter le bruit statistique

export function computeDegradations(current: LivreurRecap[], previous: LivreurRecap[]): Degradation[] {
  const prevByKey: Record<string, LivreurRecap> = {};
  previous.forEach((l) => (prevByKey[`${l.livreur}||${l.station}`] = l));

  const degradations: Degradation[] = [];

  for (const l of current) {
    const prev = prevByKey[`${l.livreur}||${l.station}`];
    if (!prev) continue;
    if (l.dispatches < MIN_DISPATCHES || prev.dispatches < MIN_DISPATCHES) continue;

    const changes: string[] = [];

    const dTaux = l.taux_livraison - prev.taux_livraison;
    if (dTaux <= -DROP_TAUX_LIVRAISON) {
      changes.push(`Taux de livraison ${dTaux.toFixed(1)} pts (${P(prev.taux_livraison)} → ${P(l.taux_livraison)})`);
    }

    const dSoc = l.soc - prev.soc;
    if (dSoc <= -DROP_SOC) {
      changes.push(`SOC ${dSoc.toFixed(1)} pts (${N(prev.soc)} → ${N(l.soc)})`);
    }

    const dRetour = l.taux_retour - prev.taux_retour;
    if (dRetour >= RISE_TAUX_RETOUR) {
      changes.push(`Taux de retour +${dRetour.toFixed(1)} pts (${P(prev.taux_retour)} → ${P(l.taux_retour)})`);
    }

    if (changes.length > 0) degradations.push({ livreur: l, changes });
  }

  return degradations.sort((a, b) => b.changes.length - a.changes.length);
}
