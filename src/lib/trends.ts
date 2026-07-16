import { AppData, KpiTrend } from "../types";

function moyenneSOC(data: AppData): number {
  if (data.recap.length === 0) return 0;
  return data.recap.reduce((s, l) => s + l.soc, 0) / data.recap.length;
}

export function computeTrends(actuel: AppData, precedent: AppData | null): KpiTrend[] {
  if (!precedent) return [];

  const paires: [string, number, number][] = [
    ["taux_livraison_global", actuel.global.taux_global, precedent.global.taux_global],
    ["soc_moyen", moyenneSOC(actuel), moyenneSOC(precedent)],
    ["delai_restitution_cod", actuel.global.delai_restitution_cod_moy_h, precedent.global.delai_restitution_cod_moy_h],
    ["taux_anomalie", actuel.global.taux_anomalie, precedent.global.taux_anomalie],
    ["montant_cod_livre", actuel.global.montant_cod_livre_total, precedent.global.montant_cod_livre_total],
    ["taux_retour_global", actuel.global.total_dispatches > 0 ? (actuel.global.total_retours / actuel.global.total_dispatches) * 100 : 0,
      precedent.global.total_dispatches > 0 ? (precedent.global.total_retours / precedent.global.total_dispatches) * 100 : 0],
    ["delai_moy", actuel.global.delai_moy, precedent.global.delai_moy],
    ["taux_communication", actuel.global.taux_communication, precedent.global.taux_communication],
  ];

  return paires.map(([key, val, prev]) => ({
    key,
    valeurActuelle: parseFloat(val.toFixed(2)),
    valeurPrecedente: parseFloat(prev.toFixed(2)),
    variation: parseFloat((val - prev).toFixed(2)),
    variationPct: prev !== 0 ? parseFloat((((val - prev) / prev) * 100).toFixed(1)) : null,
  }));
}
