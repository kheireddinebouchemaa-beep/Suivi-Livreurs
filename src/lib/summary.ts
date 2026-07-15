import { AppData, KpiTrend } from "../types";

export function generateResume(data: AppData, tendances: KpiTrend[], nbAlertes: number): string {
  const taux = data.global.taux_global.toFixed(1);
  const tendanceTaux = tendances.find(t => t.key === "taux_livraison_global");
  const fleche = tendanceTaux && tendanceTaux.variation !== null
    ? (tendanceTaux.variation > 0.5 ? "en hausse" : tendanceTaux.variation < -0.5 ? "en baisse" : "stable")
    : "";

  let phrase = `Réseau à ${taux}% de taux de livraison${fleche ? " (" + fleche + ")" : ""}.`;
  if (nbAlertes > 0) {
    phrase += ` ${nbAlertes} livreur${nbAlertes > 1 ? "s" : ""} sous les seuils d'alerte.`;
  } else {
    phrase += ` Aucune alerte active.`;
  }
  return phrase;
}
