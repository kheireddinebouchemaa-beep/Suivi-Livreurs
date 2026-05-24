import { LivreurRecap } from "./types";

// Formatage d'un nombre avec séparateur de milliers algérien
export function N(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "–";
  return Math.round(n).toLocaleString("fr-DZ");
}

// Decimal fixed ou "–"
export function F(n: number | null | undefined, decimals: number = 1): string {
  if (n == null || isNaN(n)) return "–";
  if (n === 0) return "0";
  return n.toFixed(decimals);
}

// Formatage pourcentage
export function P(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "–";
  if (n === 0) return "0%";
  return `${n.toFixed(1)}%`;
}

// Déterminer la catégorie de performance (taux de livraison)
export function getPerfCategory(t: number): "Excellent" | "Bon" | "Moyen" | "Faible" {
  if (t >= 90) return "Excellent";
  if (t >= 75) return "Bon";
  if (t >= 60) return "Moyen";
  return "Faible";
}

// Déterminer la catégorie de délai
export function getDelaiCategory(h: number): "Rapide" | "Normal" | "Lent" | "Très lent" {
  if (h <= 24) return "Rapide";
  if (h <= 48) return "Normal";
  if (h <= 72) return "Lent";
  return "Très lent";
}

// Déterminer la catégorie de retour
export function getRetourCategory(t: number): "Faible" | "Normal" | "Élevé" | "Critique" {
  if (t < 10) return "Faible";
  if (t < 20) return "Normal";
  if (t < 30) return "Élevé";
  return "Critique";
}

// Calculer le Score composite : 60% taux livraison + 40% rapidité (temps normalisé sur 48h)
// "Score = 60% taux livraison + 40% rapidité (délai normalisé sur 48h)"
// On peut formuler un score sur 100 :
// Score = (0.6 * taux_livraison) + 40 * Max(0, 1 - (delai_moy_h / 48)) si delai_moy_h <= 48
// Ou si le délai est > 48h, le score d'efficacité temporelle diminue, ex : Max(0, (96 - delai_moy_h)/48) * 40 etc.
// Faisons une formule logique et soignée :
// score_taux = taux_livraison
// score_delai = Max(0, 100 * (1 - (delai_moy_h - 12) / 72)) // 12h = 100%, 84h+ = 0%
// Si le livreur a un délai de 0h (non livré ou délai indisponible), on peut lui donner un score temporel neutre ou équivalent.
export function getCompositeScore(l: LivreurRecap): number {
  if (l.dispatches === 0) return 0;
  
  const scoreTaux = l.taux_livraison; // 0 à 100
  
  // Normalisation du délai de 0h à 96h. Idéalement, <24h = excellent.
  let scoreDelai = 0;
  if (l.delai_moy_h <= 12) {
    scoreDelai = 100;
  } else if (l.delai_moy_h >= 96) {
    scoreDelai = 0;
  } else {
    // Échelle linéaire entre 12h et 96h
    scoreDelai = 100 - ((l.delai_moy_h - 12) / (96 - 12)) * 100;
  }
  
  const finalScore = (0.6 * scoreTaux) + (0.4 * scoreDelai);
  return parseFloat(Math.min(100, Math.max(0, finalScore)).toFixed(1));
}
