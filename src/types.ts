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

export interface AppData {
  global: GlobalKPIs;
  recap: LivreurRecap[];
  trend: DailyTrend[];
  by_station: StationRecap[];
}
