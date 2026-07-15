import { AppData, LivreurRecap, DailyTrend, StationRecap, GlobalKPIs, SkippedRowExample } from "./types";
import { getSOC, getScoreRapidite, getScoreEncaissement } from "./utils";

// Fonction utilitaire pour parser les valeurs numériques
function parseNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// Parseur de date robuste (gère chaîne "dd-mm-yyyy HH:MM", serial Excel ou Date)
export function parseEcotrackDate(val: any): Date | null {
  if (val == null || val === "" || val === "/" || val === "null" || val === "undefined") {
    return null;
  }
  
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Si c'est un nombre (serial Excel)
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
    const serial = Number(val);
    const date = new Date((serial - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  // Format String : "dd-mm-yyyy HH:MM" ou "dd/mm/yyyy HH:MM"
  const str = String(val).trim();
  const datePartsMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  
  if (datePartsMatch) {
    const day = parseInt(datePartsMatch[1], 10);
    const month = parseInt(datePartsMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(datePartsMatch[3], 10);
    const hour = datePartsMatch[4] ? parseInt(datePartsMatch[4], 10) : 0;
    const min = datePartsMatch[5] ? parseInt(datePartsMatch[5], 10) : 0;
    const sec = datePartsMatch[6] ? parseInt(datePartsMatch[6], 10) : 0;
    
    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback direct
  const dFallback = new Date(str);
  return isNaN(dFallback.getTime()) ? null : dFallback;
}

// Calcul de la différence en heures entre deux dates
function getHoursDiff(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  
  // Ignorer les délais négatifs ou excessifs (> 9999h)
  if (diffHrs < 0 || diffHrs > 9999) return null;
  return diffHrs;
}

// Extraction du jour au format string court pour regroupement unique
function getShortDateString(date: Date | null): string | null {
  if (!date) return null;
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}-${m}`;
}

export function parseEcotrackRawData(rawRows: any[], onProgress?: (p: number) => void): AppData {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("Aucune ligne de données trouvée.");
  }

  onProgress?.(15);

  // Colonnes clés avec tolérance pour les espaces d'en-tête (trailing spaces)
  // Ecotrack standard : "Feuille de route crée le ", "Feuille de route activée le "
  const findKey = (row: any, keys: string[]): any => {
    for (const k of keys) {
      if (k in row) return row[k];
      // Test sans espaces ou avec trim
      const trimmedK = k.trim();
      const match = Object.keys(row).find(rk => rk.trim() === trimmedK);
      if (match) return row[match];
    }
    return null;
  };

  const keysMapping = {
    tracking: ["Tracking", "tracking"],
    reference: ["Référence", "Reference", "Réference"],
    client: ["Client", "client"],
    telephone: ["Téléphone", "Telephone", "tel"],
    adresse: ["Adresse", "adresse"],
    commune: ["Commune", "commune"],
    wilaya: ["Wilaya", "wilaya"],
    remarque: ["Remarque", "remarque"],
    produit: ["Produit", "produit"],
    montant: ["Montant", "montant"],
    type: ["Type", "type"],
    prestation: ["Préstation", "Prestation", "prestation"],
    stockage: ["Stockage", "stockage"],
    
    expediteur: ["Expéditeur", "Expediteur", "expediteur"],
    idExpediteur: ["ID Expéditeur", "ID Expediteur"],
    commercial: ["Commercial", "commercial"],
    montantRetenu: ["Montant retenu", "MontantRetenu"],
    extraRetenu: ["Extra retenu", "ExtraRetenu"],
    commission: ["Commission sur colis"],
    poids: ["Poids (KG)", "Poids"],
    surfacturationPoids: ["Surfacturation poids"],
    typeRetenu: ["Type de retenu", "Type de retenu expéditeur"],
    
    livreur: ["Livreur", "livreur"],
    remunerationLivreur: ["Rémunérations livreur", "Remuneration livreur", "Rémunération livreur"],
    surfacturationLivreur: ["Surfacturation livreur", "Surfacturation_livreur"],
    typeRetenuLivreur: ["Type de retenu livreur"],
    livreurPaye: ["Livreur payé", "LivreurPaye"],
    
    stationDepart: ["Station départ", "Station de départ"],
    stationDest: ["Station déstination", "Station destination", "Station_destination"],
    
    expedieLe: ["Expédié le", "Expedie le"],
    ramassageDemande: ["Ramassage demandé le"],
    ramassageEffectue: ["Ramassage effectué le"],
    livreurAuRamassage: ["Livreur au rammasage", "Livreur au ramassage"],
    preparationDemande: ["Préparation demandée le"],
    preparationPrepare: ["Commande préparée le"],
    valideStationReception: ["Validé par la station de réception le"],
    valideAdmin: ["Validé par admin le"],
    dispatchStationLivraison: ["Dispatché à la station de livraison le"],
    valideStationLivraison: ["Validé par la station de livraison le"],
    
    // Dates clés
    dispatchLivreurLe: ["Dispatché au livreur le", "Dispatché au livreur"],
    fdrCreeLe: ["Feuille de route crée le", "Feuille de route crée le ", "Feuille de route créée le"],
    fdrActiveeLe: ["Feuille de route activée le", "Feuille de route activée le ", "Feuille de route activée"],
    livreLe: ["Livré le", "Livre le"],
    encaisseLe: ["Encaissé le", "Encaisse le"],
    verseAdminLe: ["Versé à l'admin le"],
    payeLe: ["Payé le"],
    archiveLe: ["Archivé le"],
    retourDemandeLe: ["Retour demandé le"],
    transfereAdminLe: ["Transféré vers l'admin le"],
    recuAdminLe: ["Reçu par l'admin le"],
    transferePartenaireLe: ["Transféré au partenaire le"],
    colisFacture: ["Colis facturé"],
    
    statut: ["Statut", "statut"],
    smsEnvoyes: ["SMS envoyés", "Sms envoyes", "SMS envoyé"]
  };

  onProgress?.(30);

  // Groupements
  // Clé d'agrégation livreur : NomLivreur + "||" + StationDestination
  const aggregatedLivreurs: Record<string, {
    liveur: string;
    station: string;
    dispatches: number;
    livres: number;
    retours: number;
    delaisDisp: number[];
    delaisFdr: number[];
    delaisEnc: number[];
    expedieDates: Set<string>;
    domicile: number;
    stopDesk: number;
    echanges: number;
    wilayasSet: Set<string>;
    communesSet: Set<string>;
    remun: number;
    surfact: number;
    montantEnc: number;
  }> = {};

  const dailyTrendMap: Record<string, { dispatches: number; livres: number; retoursBefore: number; livesEffective: number; retoursEffective: number }> = {};
  const stationsMap: Record<string, { livreurs: Set<string>; dispatches: number; livres: number; retours: number; delais: number[] }> = {};

  const totalLines = rawRows.length;
  onProgress?.(45);

  let stepIncrement = Math.max(1, Math.floor(totalLines / 40));

  let skippedNoLivreur = 0;
  let skippedNoDispatch = 0;
  const skippedNoLivreurByStatut: Record<string, number> = {};
  const skippedNoDispatchByStatut: Record<string, number> = {};
  // Quelques lignes brutes conservées à titre d'exemple par (raison d'exclusion, statut),
  // pour permettre d'inspecter concrètement ce que sont ces colis sans alourdir le résultat.
  const MAX_EXAMPLES_PER_BUCKET = 25;
  const skippedNoLivreurExamples: Record<string, SkippedRowExample[]> = {};
  const skippedNoDispatchExamples: Record<string, SkippedRowExample[]> = {};

  const buildExample = (row: any, statut: string): SkippedRowExample => ({
    tracking: String(findKey(row, keysMapping.tracking) || "").trim(),
    reference: String(findKey(row, keysMapping.reference) || "").trim(),
    client: String(findKey(row, keysMapping.client) || "").trim(),
    livreur: String(findKey(row, keysMapping.livreur) || "").trim(),
    station: String(findKey(row, keysMapping.stationDest) || "").trim(),
    expedieLe: String(findKey(row, keysMapping.expedieLe) || "").trim(),
    livreLe: String(findKey(row, keysMapping.livreLe) || "").trim(),
    montant: parseNumber(findKey(row, keysMapping.montant)),
    statut,
  });

  const addExample = (bucket: Record<string, SkippedRowExample[]>, statut: string, row: any) => {
    if (!bucket[statut]) bucket[statut] = [];
    if (bucket[statut].length < MAX_EXAMPLES_PER_BUCKET) {
      bucket[statut].push(buildExample(row, statut));
    }
  };

  for (let i = 0; i < totalLines; i++) {
    const row = rawRows[i];

    if (i % stepIncrement === 0) {
      const prog = 30 + Math.floor((i / totalLines) * 20);
      onProgress?.(prog);
    }

    // Statut brut du colis, lu en premier pour pouvoir qualifier les lignes ignorées ci-dessous
    const statutBrut = String(findKey(row, keysMapping.statut) || "").trim() || "Statut non renseigné";

    // Récupérer et normaliser les données du colis
    const liveurName = String(findKey(row, keysMapping.livreur) || "/").trim();
    if (!liveurName || liveurName === "/" || liveurName === "" || liveurName === "null") {
      skippedNoLivreur++;
      skippedNoLivreurByStatut[statutBrut] = (skippedNoLivreurByStatut[statutBrut] || 0) + 1;
      addExample(skippedNoLivreurExamples, statutBrut, row);
      continue; // Ignorer les colis sans livreur
    }

    const stationDestination = String(findKey(row, keysMapping.stationDest) || "Station Inconnue").trim();
    const stationEffective = stationDestination === "/" ? "Sans Station" : stationDestination;

    // Dates
    const expDate = parseEcotrackDate(findKey(row, keysMapping.expedieLe));
    const dispLivreurDate = parseEcotrackDate(findKey(row, keysMapping.dispatchLivreurLe));
    const fdrActiveeDate = parseEcotrackDate(findKey(row, keysMapping.fdrActiveeLe));
    const livreDate = parseEcotrackDate(findKey(row, keysMapping.livreLe));
    const encaisseDate = parseEcotrackDate(findKey(row, keysMapping.encaisseLe));
    const retourDate = parseEcotrackDate(findKey(row, keysMapping.retourDemandeLe));

    // Prestation & Type
    const prestation = String(findKey(row, keysMapping.prestation) || "").trim();
    const typeColis = String(findKey(row, keysMapping.type) || "").trim();
    const wilayaStr = String(findKey(row, keysMapping.wilaya) || "").trim();
    const communeStr = String(findKey(row, keysMapping.commune) || "").trim();
    
    const montant = parseNumber(findKey(row, keysMapping.montant));
    const remLivreur = parseNumber(findKey(row, keysMapping.remunerationLivreur));
    const surfLivreur = parseNumber(findKey(row, keysMapping.surfacturationLivreur));

    // Déterminer les booléens clés
    const isDispatched = dispLivreurDate !== null;
    const isLivred = livreDate !== null;
    const isRetour = retourDate !== null;

    // Si le colis n'est pas dispatché (pas pris en charge), l'ignorer ou le comptabiliser s'il y a un livreur
    // Le brief dit : "total_dispatches = nb de lignes avec 'Dispatché au livreur le' non vide"
    // Donc nous ne comptons que si dispatché est actif !
    if (!isDispatched) {
      skippedNoDispatch++;
      skippedNoDispatchByStatut[statutBrut] = (skippedNoDispatchByStatut[statutBrut] || 0) + 1;
      addExample(skippedNoDispatchExamples, statutBrut, row);
      continue;
    }

    // Calculs de délais
    const dDisp = getHoursDiff(dispLivreurDate, livreDate);
    const dFdr = getHoursDiff(fdrActiveeDate, livreDate);
    const dEnc = getHoursDiff(livreDate, encaisseDate);

    // Clé d'agrégation livreur
    const livreurKey = `${liveurName}||${stationEffective}`;

    if (!aggregatedLivreurs[livreurKey]) {
      aggregatedLivreurs[livreurKey] = {
        liveur: liveurName,
        station: stationEffective,
        dispatches: 0,
        livres: 0,
        retours: 0,
        delaisDisp: [],
        delaisFdr: [],
        delaisEnc: [],
        expedieDates: new Set<string>(),
        domicile: 0,
        stopDesk: 0,
        echanges: 0,
        wilayasSet: new Set<string>(),
        communesSet: new Set<string>(),
        remun: 0,
        surfact: 0,
        montantEnc: 0
      };
    }

    const liveRecord = aggregatedLivreurs[livreurKey];
    liveRecord.dispatches += 1;
    if (isLivred) {
      liveRecord.livres += 1;
      liveRecord.montantEnc += montant;
    }
    if (isRetour) {
      liveRecord.retours += 1;
    }

    if (dDisp !== null) liveRecord.delaisDisp.push(dDisp);
    if (dFdr !== null) liveRecord.delaisFdr.push(dFdr);
    if (dEnc !== null) liveRecord.delaisEnc.push(dEnc);

    if (expDate) {
      const expDateStr = expDate.toISOString().slice(0, 10);
      liveRecord.expedieDates.add(expDateStr);
    }

    if (prestation.toLowerCase().includes("stop desk")) {
      liveRecord.stopDesk += 1;
    } else {
      liveRecord.domicile += 1; // par défaut "A domicile"
    }

    if (typeColis.toLowerCase() === "echange" || typeColis.toLowerCase() === "échange") {
      liveRecord.echanges += 1;
    }

    if (wilayaStr && wilayaStr !== "/") liveRecord.wilayasSet.add(wilayaStr);
    if (communeStr && communeStr !== "/") liveRecord.communesSet.add(communeStr);

    liveRecord.remun += remLivreur;
    liveRecord.surfact += surfLivreur;

    // Tendance journalière :
    // "nb_dispatches = groupé par date 'Expédié le'"
    // "nb_livres = groupé par date 'Livré le' (date effective de livraison)"
    // "nb_retours = groupé par date 'Expédié le' des colis avec retour"
    if (expDate) {
      const dStr = getShortDateString(expDate);
      if (dStr) {
        if (!dailyTrendMap[dStr]) {
          dailyTrendMap[dStr] = { dispatches: 0, livres: 0, retoursBefore: 0, livesEffective: 0, retoursEffective: 0 };
        }
        dailyTrendMap[dStr].dispatches += 1;
        if (isRetour) {
          dailyTrendMap[dStr].retoursBefore += 1;
        }
      }
    }

    if (livreDate) {
      const dStr = getShortDateString(livreDate);
      if (dStr) {
        if (!dailyTrendMap[dStr]) {
          dailyTrendMap[dStr] = { dispatches: 0, livres: 0, retoursBefore: 0, livesEffective: 0, retoursEffective: 0 };
        }
        dailyTrendMap[dStr].livesEffective += 1;
      }
    }

    if (retourDate) {
      const dStr = getShortDateString(retourDate);
      if (dStr) {
        if (!dailyTrendMap[dStr]) {
          dailyTrendMap[dStr] = { dispatches: 0, livres: 0, retoursBefore: 0, livesEffective: 0, retoursEffective: 0 };
        }
        dailyTrendMap[dStr].retoursEffective += 1;
      }
    }

    // Agrégation par station d'après le colis
    if (!stationsMap[stationEffective]) {
      stationsMap[stationEffective] = {
        livreurs: new Set(),
        dispatches: 0,
        livres: 0,
        retours: 0,
        delais: []
      };
    }
    stationsMap[stationEffective].livreurs.add(liveurName);
    stationsMap[stationEffective].dispatches += 1;
    if (isLivred) {
      stationsMap[stationEffective].livres += 1;
      if (dDisp !== null) {
        stationsMap[stationEffective].delais.push(dDisp);
      }
    }
    if (isRetour) {
      stationsMap[stationEffective].retours += 1;
    }
  }

  onProgress?.(65);

  // Formater les livreurs
  const recap: LivreurRecap[] = Object.keys(aggregatedLivreurs).map((k, idx) => {
    const s = aggregatedLivreurs[k];
    
    // Moyennes des délais
    const delai_moy_h = s.delaisDisp.length > 0 
      ? parseFloat((s.delaisDisp.reduce((a, b) => a + b, 0) / s.delaisDisp.length).toFixed(1))
      : 0;
      
    const delai_fdr_h = s.delaisFdr.length > 0
      ? parseFloat((s.delaisFdr.reduce((a, b) => a + b, 0) / s.delaisFdr.length).toFixed(1))
      : 0;

    const delai_enc_h = s.delaisEnc.length > 0
      ? parseFloat((s.delaisEnc.reduce((a, b) => a + b, 0) / s.delaisEnc.length).toFixed(1))
      : 0;

    const jours_actifs = Math.max(1, s.expedieDates.size);
    const moy_colis_jour = parseFloat((s.dispatches / jours_actifs).toFixed(1));

    const taux_livraison = s.dispatches > 0 ? parseFloat(Math.min(100, (s.livres / s.dispatches) * 100).toFixed(1)) : 0;
    const taux_retour = s.dispatches > 0 ? parseFloat(((s.retours / s.dispatches) * 100).toFixed(1)) : 0;

    const soc = getSOC({ taux_livraison, delai_moy_h, delai_enc_h, dispatches: s.dispatches });
    const soc_taux = parseFloat((taux_livraison * 0.30).toFixed(1));
    const soc_rapidite = parseFloat((getScoreRapidite(delai_moy_h) * 0.20).toFixed(1));
    const soc_enc = parseFloat((getScoreEncaissement(delai_enc_h) * 0.50).toFixed(1));

    return {
      id: `LIV-${1000 + idx}`,
      livreur: s.liveur,
      station: s.station,
      dispatches: s.dispatches,
      livres: s.livres,
      retours: s.retours,
      taux_livraison,
      taux_retour,
      delai_moy_h,
      delai_fdr_h,
      delai_enc_h,
      jours_actifs,
      moy_colis_jour,
      domicile: s.domicile,
      stop_desk: s.stopDesk,
      echanges: s.echanges,
      wilayas: s.wilayasSet.size,
      communes: s.communesSet.size,
      remun: s.remun,
      surfact: s.surfact,
      montant_enc: s.montantEnc,
      soc,
      soc_taux,
      soc_rapidite,
      soc_enc
    };
  });

  onProgress?.(80);

  // Formater la tendance journalière (60 derniers jours)
  // Trier les dates ou prendre les 60 clés avec le plus d'activité
  const availableDatesStr = Object.keys(dailyTrendMap);
  // Un parseur de date rapide pour ranger chronologiquement
  const getSortScore = (dStr: string) => {
    // "dd-mm" -> mm * 50 + dd
    const parts = dStr.split("-");
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    return mm * 50 + dd;
  };

  availableDatesStr.sort((a, b) => getSortScore(a) - getSortScore(b));

  // Garder au maximum les 60 derniers jours
  const lastDatesKeys = availableDatesStr.slice(-60);

  const trend: DailyTrend[] = lastDatesKeys.map(dStr => {
    const val = dailyTrendMap[dStr];
    return {
      date: dStr,
      dispatches: val.dispatches,
      livres: val.livesEffective, // d'après la formule du brief: "nb_livres = groupé par date 'Livré le' (date effective de livraison)"
      retours: val.retoursEffective // ou retours demandé le
    };
  });

  onProgress?.(90);

  // Formater l'agrégation par station
  const by_station: StationRecap[] = Object.keys(stationsMap).map(station => {
    const s = stationsMap[station];
    
    // Taux moyen est la moyenne ponderée ou simple des livreurs de la station
    const stationLivreurs = recap.filter(l => l.station === station);
    const tauxMoy = stationLivreurs.length > 0
      ? parseFloat((stationLivreurs.reduce((sum, l) => sum + l.taux_livraison, 0) / stationLivreurs.length).toFixed(1))
      : 0;

    const delaiMoy = stationLivreurs.length > 0
      ? parseFloat((stationLivreurs.reduce((sum, l) => sum + l.delai_moy_h, 0) / stationLivreurs.length).toFixed(1))
      : 0;

    return {
      station,
      nb_livreurs: s.livreurs.size,
      total_dispatches: s.dispatches,
      total_livres: s.livres,
      total_retours: s.retours,
      taux_moy: tauxMoy,
      delai_moy: delaiMoy
    };
  });

  // Tri par volume des stations de livraison
  by_station.sort((a, b) => b.total_dispatches - a.total_dispatches);

  onProgress?.(98);

  // Calcul du global final
  const total_dispatches = recap.reduce((s, x) => s + x.dispatches, 0);
  const total_livres = recap.reduce((s, x) => s + x.livres, 0);
  const total_retours = recap.reduce((s, x) => s + x.retours, 0);
  const non_livres = Math.max(0, total_dispatches - total_livres);
  const nb_livreurs = Array.from(new Set(recap.map(x => x.livreur))).length;

  const taux_global = total_dispatches > 0 ? parseFloat(Math.min(100, (total_livres / total_dispatches) * 100).toFixed(1)) : 0;
  
  const totalD = recap.reduce((s, x) => s + (x.delai_moy_h * x.livres), 0);
  const delai_moy = total_livres > 0 ? parseFloat((totalD / total_livres).toFixed(1)) : 0;

  const totalDEnc = recap.reduce((s, x) => s + (x.delai_enc_h * x.livres), 0);
  const delai_encaiss_moy = total_livres > 0 ? parseFloat((totalDEnc / total_livres).toFixed(1)) : 0;

  const toSortedBreakdown = (byStatut: Record<string, number>, examples: Record<string, SkippedRowExample[]>) =>
    Object.entries(byStatut)
      .map(([statut, count]) => ({ statut, count, examples: examples[statut] || [] }))
      .sort((a, b) => b.count - a.count);

  const global: GlobalKPIs = {
    total_dispatches,
    total_livres,
    total_retours,
    nb_livreurs,
    taux_global,
    delai_moy,
    delai_encaiss_moy,
    non_livres,
    lignes_fichier: totalLines,
    lignes_ignorees_sans_livreur: skippedNoLivreur,
    lignes_ignorees_sans_dispatch: skippedNoDispatch,
    statuts_sans_livreur: toSortedBreakdown(skippedNoLivreurByStatut, skippedNoLivreurExamples),
    statuts_sans_dispatch: toSortedBreakdown(skippedNoDispatchByStatut, skippedNoDispatchExamples)
  };

  onProgress?.(100);

  return {
    global,
    recap,
    trend,
    by_station
  };
}
