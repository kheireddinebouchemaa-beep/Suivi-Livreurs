// Ligne à plat conservée pour le détail permanent ligne par ligne (drill-down), une par colis du fichier importé.
export interface FlatRow {
  tracking: string;
  reference: string;
  client: string;
  expediteur: string;
  livreur: string;
  station: string;
  wilaya: string;
  commune: string;
  montant: number;
  statut: string;
  type: string;
  prestation: string;
  expedieLe: string | null;       // ISO 8601
  dispatcheLe: string | null;
  livreLe: string | null;
  encaisseLe: string | null;
  retourDemandeLe: string | null;
  isDispatched: boolean;
  isLivre: boolean;
  isRetour: boolean;
}

export interface SkippedRowExample {
  tracking: string;
  reference: string;
  client: string;
  livreur: string;
  station: string;
  expedieLe: string;
  livreLe: string;
  montant: number;
  statut: string;
}

export interface StatutBreakdown {
  statut: string;
  count: number;
  examples: SkippedRowExample[]; // échantillon de lignes brutes (25 max) pour inspection
}

export interface GlobalKPIs {
  total_dispatches: number;
  total_livres: number;
  total_retours: number;
  nb_livreurs: number;
  taux_global: number;
  delai_moy: number;
  delai_encaiss_moy: number;
  non_livres: number;
  lignes_fichier: number;           // nb total de lignes lues dans le fichier importé
  lignes_ignorees_sans_livreur: number;   // lignes sans livreur assigné (non comptabilisées)
  lignes_ignorees_sans_dispatch: number;  // lignes avec livreur mais jamais dispatchées (non comptabilisées)
  statuts_sans_livreur: StatutBreakdown[];   // répartition par "Statut" des lignes sans livreur
  statuts_sans_dispatch: StatutBreakdown[];  // répartition par "Statut" des lignes jamais dispatchées
  delai_restitution_cod_moy_h: number;    // Encaissé le → Versé à l'admin le
  taux_anomalie: number;                   // % colis avec Remarque non vide
  cout_livraison_moyen: number;            // Rémunération livreur total / colis livrés
  taux_communication: number;              // SMS envoyés / colis total
  taux_same_day_respecte: number;          // % colis "Same Day" livrés le jour même
  delai_enlevement_moy_h: number;          // Ramassage demandé le → Ramassage effectué le
  taux_colis_factures: number;             // Colis facturé=oui / total
  marge_nette_totale: number;              // Somme des marges nettes par expéditeur
}

export interface LivreurRecap {
  id: string;
  livreur: string;
  station: string;
  dispatches: number;
  livres: number;
  retours: number;
  taux_livraison: number;
  taux_retour: number;
  delai_moy_h: number; // dispatche -> livre
  delai_fdr_h: number; // FDR -> livre
  delai_enc_h: number; // livre -> encaisse
  jours_actifs: number;
  moy_colis_jour: number;
  domicile: number;
  stop_desk: number;
  echanges: number;
  wilayas: number;
  communes: number;
  remun: number;
  surfact: number;
  montant_enc: number;
  soc: number;             // Score Opérationnel Composite (0–100)
  soc_taux: number;        // Composante taux (0–30)
  soc_rapidite: number;    // Composante rapidité (0–20)
  soc_enc: number;         // Composante encaissement (0–50)
  soc_simule?: number;     // Optionnel: score simulé
  soc_delta?: number;      // Optionnel: différence score simulé - score réel
  delai_restitution_cod_h: number;
  taux_anomalie: number;
  cout_livraison_moyen: number;
  taux_communication: number;
  ecart_type_charge_jour: number;          // équilibrage de charge (calculé au niveau station, dupliqué ici pour affichage individuel)
  score_stabilite: number;                 // écart-type du taux_livraison sur les derniers snapshots (0 si historique insuffisant)
}

export interface DailyTrend {
  date: string;
  dispatches: number;
  livres: number;
  retours: number;
}

export interface StationRecap {
  station: string;
  nb_livreurs: number;
  total_dispatches: number;
  total_livres: number;
  total_retours: number;
  taux_moy: number;
  delai_moy: number;
}

export interface BreakdownRow {
  key: string;              // identifiant unique (nom expéditeur, ou "commune||wilaya")
  label: string;             // libellé affiché
  wilaya?: string;           // uniquement pour les lignes de zone
  dispatches: number;
  livres: number;
  retours: number;
  taux_livraison: number;
  taux_retour: number;
}

export interface LivreurDetail {
  livreurId: string;         // correspond à LivreurRecap.id
  parExpediteur: BreakdownRow[];  // triée dispatches desc
  parZone: BreakdownRow[];        // triée dispatches desc
}

export interface ExpediteurRecap {
  id: string;
  expediteur: string;
  idExpediteur?: string;
  dispatches: number;
  livres: number;
  retours: number;
  taux_livraison: number;
  taux_retour: number;
  nbLivreurs: number;
  nbCommunes: number;
  margeNette: number;   // Montant encaissé − Commission sur colis − Rémunération livreur − Surfacturation, somme sur tous ses colis
}

export interface KpiTrend {
  key: string;              // identifiant du KPI (ex: "taux_livraison_global")
  valeurActuelle: number;
  valeurPrecedente: number | null;   // null si pas de snapshot précédent
  variation: number | null;          // valeurActuelle - valeurPrecedente
  variationPct: number | null;
}

export interface ZoneRecap {
  id: string;                // "commune||wilaya"
  commune: string;
  wilaya: string;
  dispatches: number;
  livres: number;
  retours: number;
  taux_livraison: number;
  taux_retour: number;
  niveauRisque: "faible" | "moyen" | "eleve";
}

export interface AppData {
  global: GlobalKPIs;
  recap: LivreurRecap[];
  trend: DailyTrend[];
  by_station: StationRecap[];
  expediteurs: ExpediteurRecap[];
  zones: ZoneRecap[];
  livreurDetails: Record<string, LivreurDetail>;  // clé = LivreurRecap.id
  tendances?: KpiTrend[];         // calculé côté frontend au chargement, pas dans parser.ts
  resumeNaturel?: string;         // phrase auto-générée
}
