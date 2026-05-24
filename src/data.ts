import { AppData, LivreurRecap, DailyTrend, StationRecap } from "./types";
import { getSOC, getScoreRapidite, getScoreEncaissement } from "./utils";

// Quelques constantes réalistes pour IMIR Logistics
const PREMIUM_ALGERIAN_NAMES = [
  "Abdelkader Benali", "Mohamed Merah", "Karim Belkacem", "Amine Boussad", "Sofiane Brahimi",
  "Rachid Taha", "Yacine Brahimi", "Ryad Mahrez", "Bilal Slimani", "Youcef Atal",
  "Khaled Bouzidi", "Reda Douifi", "Farouk Chiali", "Salim Kerkar", "Kamel Ouali",
  "Abdelhamid Benbadis", "Mourad Meghni", "Fatah Meddour", "Yazid Mansouri", "Cherif Oudjani",
  "Smail Slimani", "Oussama Darfalou", "Hichem Belkaroui", "Nadir Belhadj", "Rafik Djebbour",
  "Djamel Belmadi", "Faouzi Ghoulam", "Madjid Bougherra", "Antar Yahia", "Karim Ziani",
  "Hassan Yebda", "Yassine Bezzaz", "Adlene Guedioura", "Carl Medjani", "Ryad Boudebouz",
  "Sofiane Feghouli", "Hilal Soudani", "Islam Slimani", "Nabil Ghilas", "Baghdad Bounedjah",
  "Youcef Belaili", "Aissa Mandi", "Ramy Bensebaini", "Mehdi Zeffane", "Haris Belkebla",
  "Alexandre Oukidja", "Rais M'Bolhi", "Ismael Bennacer", "Ilyes Chetti", "Abdelkader Bedrane",
  "Djamel Benlamri", "Mehdi Tahrat", "Adam Ounas", "Said Benrahma", "Andy Delort",
  "Farid Boulaya", "Zinedine Ferhat", "Houssem Aouar", "Yasser Larouci", "Farès Chaïbi",
  "Amine Gouiri", "Rayan Aït-Nouri", "Kevin Guitoun", "Anthony Mandrea", "Bilel Latreche"
];

const STATIONS = [
  "16 - Station Alger Centre (HQ)",
  "31 - Station Oran Es-Sénia",
  "25 - Station Constantine Khroub",
  "09 - Station Blida Ouled Yaïch",
  "06 - Station Béjaïa Port",
  "15 - Station Tizi Ouzou",
  "19 - Station Sétif El Eulma",
  "04 - Station Oum El Bouaghi",
  "13 - Station Tlemcen",
  "30 - Station Ouargla",
  "47 - Station Ghardaïa",
  "35 - Station Boumerdès",
  "42 - Station Tipaza",
  "27 - Station Mostaganem"
];

// Génération déterministe basée sur un seed simple pour ne pas avoir de fluctuations au rechargement
function seedRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function generateDemoData(): AppData {
  const recap: LivreurRecap[] = [];
  const stationsMap: Record<string, { livreurs: Set<string>; dispatches: number; livres: number; retours: number; delais: number[] }> = {};
  
  // 1. Génération des livreurs
  PREMIUM_ALGERIAN_NAMES.forEach((name, idx) => {
    const seed = idx + 42;
    const rand = seedRandom(seed);
    
    // Assigner à une station de manière réaliste (le début de la liste a plus de volume)
    const stationIdx = Math.floor(seedRandom(seed + 1) * seedRandom(seed + 1) * STATIONS.length);
    const station = STATIONS[stationIdx];
    
    // Profils de performance
    let baseTaux = 75; // Moyen par défaut
    if (rand > 0.85) {
      baseTaux = 92 + rand * 5; // Excellent
    } else if (rand > 0.5) {
      baseTaux = 78 + rand * 10; // Bon
    } else if (rand > 0.15) {
      baseTaux = 62 + rand * 12; // Moyen
    } else {
      baseTaux = 42 + rand * 18; // Faible
    }
    baseTaux = Math.min(100, Math.max(0, baseTaux));

    const dispatches = Math.floor(150 + seedRandom(seed + 2) * 1500);
    const livres = Math.floor((baseTaux / 100) * dispatches);
    
    // Calcul des retours en fonction du taux de livraison
    // Si taux = 92%, retours = ~5% à 8%
    const baseRetour = 100 - baseTaux;
    const retours = Math.floor((baseRetour * (0.6 + seedRandom(seed + 3) * 0.4) / 100) * dispatches);
    
    const taux_livraison = (livres / dispatches) * 100;
    const taux_retour = (retours / dispatches) * 100;
    
    // Délais de livraison (en heures)
    let baseDelai = 24;
    if (taux_livraison >= 90) {
      baseDelai = 12 + seedRandom(seed + 4) * 10; // Rapide <= 24h
    } else if (taux_livraison >= 75) {
      baseDelai = 20 + seedRandom(seed + 4) * 20; // 24h - 40h
    } else if (taux_livraison >= 60) {
      baseDelai = 35 + seedRandom(seed + 4) * 30; // 35h - 65h
    } else {
      baseDelai = 50 + seedRandom(seed + 4) * 70; // 50h - 120h
    }
    const delai_moy_h = parseFloat(baseDelai.toFixed(1));
    const delai_fdr_h = parseFloat((baseDelai * (1.1 + seedRandom(seed + 5) * 0.2)).toFixed(1));
    const delai_enc_h = parseFloat((12 + seedRandom(seed + 6) * 48).toFixed(1)); // délai encaissement moyen : 12-60h
    
    const jours_actifs = Math.floor(10 + seedRandom(seed + 7) * 45);
    const moy_colis_jour = parseFloat((dispatches / jours_actifs).toFixed(1));
    
    // Prestations
    const stopDeskRatio = 0.05 + seedRandom(seed + 8) * 0.3; // 5% à 35% STOP DESK
    const stop_desk = Math.floor(dispatches * stopDeskRatio);
    const domicile = dispatches - stop_desk;
    
    const echanges = Math.floor(dispatches * (0.01 + seedRandom(seed + 9) * 0.05)); // 1% à 6% d'échanges
    
    const wilayas = Math.floor(1 + seedRandom(seed + 10) * 4); // 1 à 4 wilayas par livreur
    const communes = Math.floor(wilayas * (1.5 + seedRandom(seed + 11) * 3)); // 1.5 à 4 communes par wilaya
    
    // Rémunération : gain moyen par colis livré : 250 DA à 350 DA
    const gainMoyen = 280 + Math.floor(seedRandom(seed + 12) * 70);
    const remun = livres * gainMoyen;
    const surfact = Math.floor(remun * (0.02 + seedRandom(seed + 13) * 0.06)); // 2% à 8% de surfacturation
    
    // Montant encaissé moyenne d'un colis algérien : 3500 DA à 7500 DA
    const panierMoyen = 4500 + Math.floor(seedRandom(seed + 14) * 3000);
    const montant_enc = livres * panierMoyen;

    const t_liv = parseFloat(taux_livraison.toFixed(1));
    const soc = getSOC({ taux_livraison: t_liv, delai_moy_h, delai_enc_h, dispatches });
    const soc_taux = parseFloat((t_liv * 0.30).toFixed(1));
    const soc_rapidite = parseFloat((getScoreRapidite(delai_moy_h) * 0.20).toFixed(1));
    const soc_enc = parseFloat((getScoreEncaissement(delai_enc_h) * 0.50).toFixed(1));

    recap.push({
      id: `LIV-${idx + 1001}`,
      livreur: name,
      station,
      dispatches,
      livres,
      retours,
      taux_livraison: t_liv,
      taux_retour: parseFloat(taux_retour.toFixed(1)),
      delai_moy_h,
      delai_fdr_h,
      delai_enc_h,
      jours_actifs,
      moy_colis_jour,
      domicile,
      stop_desk,
      echanges,
      wilayas,
      communes,
      remun,
      surfact,
      montant_enc,
      soc,
      soc_taux,
      soc_rapidite,
      soc_enc
    });

    // Agrégation par station
    if (!stationsMap[station]) {
      stationsMap[station] = {
        livreurs: new Set(),
        dispatches: 0,
        livres: 0,
        retours: 0,
        delais: []
      };
    }
    stationsMap[station].livreurs.add(name);
    stationsMap[station].dispatches += dispatches;
    stationsMap[station].livres += livres;
    stationsMap[station].retours += retours;
    stationsMap[station].delais.push(delai_moy_h);
  });

  // Sort recap by taux_livraison desc as a nice default
  recap.sort((a, b) => b.taux_livraison - a.taux_livraison);

  // 2. Tendance temporelle des 60 derniers jours
  const trend: DailyTrend[] = [];
  const now = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit" });
    const seed = i + 100;
    
    // Fluctuation saisonnière (milieu de semaine plus élevé)
    const dayOfWeek = d.getDay(); // 0 = Dimanche, etc.
    const multiplier = (dayOfWeek === 5) ? 0.35 : (dayOfWeek === 6 || dayOfWeek === 1) ? 1.2 : 0.9; // Vendredi creux en Algérie
    
    const baseDispatches = Math.floor((1000 + seedRandom(seed) * 800) * multiplier);
    const baseLivres = Math.floor(baseDispatches * (0.68 + seedRandom(seed + 1) * 0.1));
    const baseRetours = Math.floor(baseDispatches * (0.15 + seedRandom(seed + 2) * 0.08));

    trend.push({
      date: dayStr,
      dispatches: baseDispatches,
      livres: baseLivres,
      retours: baseRetours
    });
  }

  // 3. Agrégation finale par station
  const by_station: StationRecap[] = Object.keys(stationsMap).map((station) => {
    const s = stationsMap[station];
    const avgDelai = s.delais.reduce((a, b) => a + b, 0) / s.delais.length;
    // Taux moyen est la moyenne pondérée ou simple
    const txMoy = (s.livres / s.dispatches) * 100;
    
    return {
      station,
      nb_livreurs: s.livreurs.size,
      total_dispatches: s.dispatches,
      total_livres: s.livres,
      total_retours: s.retours,
      taux_moy: parseFloat(txMoy.toFixed(1)),
      delai_moy: parseFloat(avgDelai.toFixed(1))
    };
  });

  // Sort stations by volume
  by_station.sort((a, b) => b.total_dispatches - a.total_dispatches);

  // 4. Calcul des KPI globaux
  const total_dispatches = recap.reduce((sum, item) => sum + item.dispatches, 0);
  const total_livres = recap.reduce((sum, item) => sum + item.livres, 0);
  const total_retours = recap.reduce((sum, item) => sum + item.retours, 0);
  const non_livres = total_dispatches - total_livres;
  const nb_livreurs = recap.length;
  
  const taux_global = parseFloat(((total_livres / total_dispatches) * 100).toFixed(1));
  
  // Moyenne pondérée du délai
  const totalDelaiPondere = recap.reduce((sum, item) => sum + (item.delai_moy_h * item.livres), 0);
  const delai_moy = parseFloat((totalDelaiPondere / total_livres).toFixed(1));

  const totalDelaiEncaissPondere = recap.reduce((sum, item) => sum + (item.delai_enc_h * item.livres), 0);
  const delai_encaiss_moy = parseFloat((totalDelaiEncaissPondere / total_livres).toFixed(1));

  return {
    global: {
      total_dispatches,
      total_livres,
      total_retours,
      nb_livreurs,
      taux_global,
      delai_moy,
      delai_encaiss_moy,
      non_livres
    },
    recap,
    trend,
    by_station
  };
}
