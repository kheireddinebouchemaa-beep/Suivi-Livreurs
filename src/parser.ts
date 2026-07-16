import { AppData, LivreurRecap, DailyTrend, StationRecap, GlobalKPIs, SkippedRowExample, FlatRow, ExpediteurRecap, ZoneRecap } from "./types";
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

// Extraction du jour au format ISO (YYYY-MM-DD) pour regroupement/tri chronologique fiable
// (un format "dd-mm" sans année provoquerait des collisions entre années et un tri incorrect)
function getShortDateString(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

// Formatage d'une clé ISO (YYYY-MM-DD) en libellé court "dd-mm" pour l'affichage du graphe
function formatShortDateLabel(isoDate: string): string {
  const parts = isoDate.split("-");
  return `${parts[2]}-${parts[1]}`;
}

export function parseEcotrackRawData(rawRows: any[], onProgress?: (p: number) => void): { data: AppData; flatRows: FlatRow[] } {
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
    colisFacture: ["Colis facturé", "Colis facture"],
    
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
    delaisRestitution: number[];
    anomalies: number;
    smsCount: number;
    expedieDates: Set<string>;
    domicile: number;
    stopDesk: number;
    echanges: number;
    wilayasSet: Set<string>;
    communesSet: Set<string>;
    remun: number;
    surfact: number;
    montantEnc: number;
    derniereActiviteMs: number;
  }> = {};

  const dailyTrendMap: Record<string, { dispatches: number; livres: number; retoursBefore: number; livesEffective: number; retoursEffective: number }> = {};
  const stationsMap: Record<string, { livreurs: Set<string>; dispatches: number; livres: number; retours: number; delais: number[] }> = {};
  // Nb de colis par jour et par station, pour l'écart-type de charge journalière (équilibrage)
  const stationDailyMap: Record<string, Record<string, number>> = {};

  // Agrégats réseau par expéditeur / par zone (Volets B/C). Le détail par livreur ×
  // expéditeur/zone (Volet A) n'est plus embarqué ici : pour un gros import (500k+ lignes,
  // 900+ livreurs) il ferait exploser la taille du JSON envoyé au backend au-delà de la
  // limite de la plateforme. Il est désormais calculé à la demande côté serveur
  // (GET /api/snapshots/:id/breakdown) depuis le détail ligne par ligne déjà sauvegardé.
  type SubCounts = { dispatches: number; livres: number; retours: number };
  const globalExpediteurMap: Record<string, SubCounts & { livreursSet: Set<string>; communesSet: Set<string>; montantLivreTotal: number }> = {};
  const globalZoneMap: Record<string, { commune: string; wilaya: string } & SubCounts> = {};

  // Compteurs/accumulateurs globaux pour les nouveaux KPI (section 2 de la spec KPI avancés)
  let totalAnomalies = 0;
  let totalSms = 0;
  let sameDayTotal = 0;
  let sameDayRespecte = 0;
  let totalFactures = 0;
  const delaisRestitutionGlobal: number[] = [];
  const delaisEnlevementGlobal: number[] = [];

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
  const flatRows: FlatRow[] = [];

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

    // Récupérer et normaliser les données du colis (lues avant tout filtre, pour que la ligne à plat
    // ci-dessous reste complète même pour les colis ignorés — nécessaire au détail ligne par ligne)
    const liveurName = String(findKey(row, keysMapping.livreur) || "/").trim();
    const stationDestination = String(findKey(row, keysMapping.stationDest) || "Station Inconnue").trim();
    const stationEffective = stationDestination === "/" ? "Sans Station" : stationDestination;

    // Dates
    const expDate = parseEcotrackDate(findKey(row, keysMapping.expedieLe));
    const dispLivreurDate = parseEcotrackDate(findKey(row, keysMapping.dispatchLivreurLe));
    const fdrActiveeDate = parseEcotrackDate(findKey(row, keysMapping.fdrActiveeLe));
    const livreDate = parseEcotrackDate(findKey(row, keysMapping.livreLe));
    const encaisseDate = parseEcotrackDate(findKey(row, keysMapping.encaisseLe));
    const retourDate = parseEcotrackDate(findKey(row, keysMapping.retourDemandeLe));
    const verseAdminDate = parseEcotrackDate(findKey(row, keysMapping.verseAdminLe));
    const ramassageDemandeDate = parseEcotrackDate(findKey(row, keysMapping.ramassageDemande));
    const ramassageEffectueDate = parseEcotrackDate(findKey(row, keysMapping.ramassageEffectue));

    // Prestation & Type
    const prestation = String(findKey(row, keysMapping.prestation) || "").trim();
    const typeColis = String(findKey(row, keysMapping.type) || "").trim();
    const wilayaStr = String(findKey(row, keysMapping.wilaya) || "").trim();
    const communeStr = String(findKey(row, keysMapping.commune) || "").trim();

    const montant = parseNumber(findKey(row, keysMapping.montant));
    const remLivreur = parseNumber(findKey(row, keysMapping.remunerationLivreur));
    const surfLivreur = parseNumber(findKey(row, keysMapping.surfacturationLivreur));

    // Nouveaux KPI : anomalies, communication, facturation, ponctualité Same Day
    const remarqueStr = String(findKey(row, keysMapping.remarque) || "").trim();
    const hasAnomalie = remarqueStr !== "" && remarqueStr !== "/";
    const smsEnvoyesRaw = findKey(row, keysMapping.smsEnvoyes);
    const hasSms = smsEnvoyesRaw != null && parseNumber(smsEnvoyesRaw) > 0;
    const colisFactureStr = String(findKey(row, keysMapping.colisFacture) || "").trim().toLowerCase();
    const isFacture = colisFactureStr === "oui";
    const isSameDayPrestation = prestation.toLowerCase().includes("same day");

    // Déterminer les booléens clés
    const isDispatched = dispLivreurDate !== null;
    const isLivred = livreDate !== null;
    const isRetour = retourDate !== null;

    // Ligne à plat conservée pour le détail permanent ligne par ligne (toutes les lignes, y
    // compris celles ignorées des agrégats), envoyée séparément de l'AppData agrégée.
    flatRows.push({
      tracking: String(findKey(row, keysMapping.tracking) || "").trim(),
      reference: String(findKey(row, keysMapping.reference) || "").trim(),
      client: String(findKey(row, keysMapping.client) || "").trim(),
      expediteur: String(findKey(row, keysMapping.expediteur) || "").trim(),
      livreur: liveurName === "/" ? "" : liveurName,
      station: stationEffective,
      wilaya: wilayaStr,
      commune: communeStr,
      montant,
      statut: statutBrut,
      type: typeColis,
      prestation,
      expedieLe: expDate ? expDate.toISOString() : null,
      dispatcheLe: dispLivreurDate ? dispLivreurDate.toISOString() : null,
      livreLe: livreDate ? livreDate.toISOString() : null,
      encaisseLe: encaisseDate ? encaisseDate.toISOString() : null,
      retourDemandeLe: retourDate ? retourDate.toISOString() : null,
      isDispatched,
      isLivre: isLivred,
      isRetour,
    });

    if (!liveurName || liveurName === "/" || liveurName === "" || liveurName === "null") {
      skippedNoLivreur++;
      skippedNoLivreurByStatut[statutBrut] = (skippedNoLivreurByStatut[statutBrut] || 0) + 1;
      addExample(skippedNoLivreurExamples, statutBrut, row);
      continue; // Ignorer les colis sans livreur
    }

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
        delaisRestitution: [],
        anomalies: 0,
        smsCount: 0,
        expedieDates: new Set<string>(),
        domicile: 0,
        stopDesk: 0,
        echanges: 0,
        wilayasSet: new Set<string>(),
        communesSet: new Set<string>(),
        remun: 0,
        surfact: 0,
        montantEnc: 0,
        derniereActiviteMs: 0
      };
    }

    const liveRecord = aggregatedLivreurs[livreurKey];
    liveRecord.dispatches += 1;
    // Dernière activité connue pour ce livreur : la plus récente des dates du colis (peu importe
    // laquelle), pour repérer un livreur qui n'a plus rien reçu/traité depuis longtemps.
    for (const d of [expDate, dispLivreurDate, livreDate, encaisseDate, retourDate]) {
      if (d && d.getTime() > liveRecord.derniereActiviteMs) liveRecord.derniereActiviteMs = d.getTime();
    }
    if (isLivred) {
      liveRecord.livres += 1;
      liveRecord.montantEnc += montant;
    }
    if (isRetour) {
      liveRecord.retours += 1;
    }

    // Agrégats réseau par expéditeur / par zone
    const expediteurStr = String(findKey(row, keysMapping.expediteur) || "").trim() || "(non renseigné)";
    const communeLabel = communeStr || "(non renseignée)";
    const wilayaLabel = wilayaStr || "(non renseignée)";
    const zoneKey = `${communeLabel}||${wilayaLabel}`;

    const gExp = globalExpediteurMap[expediteurStr] ||= { dispatches: 0, livres: 0, retours: 0, livreursSet: new Set<string>(), communesSet: new Set<string>(), montantLivreTotal: 0 };
    gExp.dispatches += 1;
    if (isLivred) gExp.livres += 1;
    if (isRetour) gExp.retours += 1;
    gExp.livreursSet.add(liveurName);
    if (communeStr) gExp.communesSet.add(communeStr);
    // Montant COD des colis effectivement livrés pour cet expéditeur (pas une marge : aucune
    // charge n'est déduite, c'est le montant encaissé pour le compte du client).
    if (isLivred) gExp.montantLivreTotal += montant;

    const gZone = globalZoneMap[zoneKey] ||= { commune: communeLabel, wilaya: wilayaLabel, dispatches: 0, livres: 0, retours: 0 };
    gZone.dispatches += 1;
    if (isLivred) gZone.livres += 1;
    if (isRetour) gZone.retours += 1;

    if (dDisp !== null) liveRecord.delaisDisp.push(dDisp);
    if (dFdr !== null) liveRecord.delaisFdr.push(dFdr);
    if (dEnc !== null) liveRecord.delaisEnc.push(dEnc);

    // Nouveaux KPI : restitution COD, anomalies, communication, facturation, Same Day, enlèvement
    const dRestitution = getHoursDiff(encaisseDate, verseAdminDate);
    if (dRestitution !== null) {
      liveRecord.delaisRestitution.push(dRestitution);
      delaisRestitutionGlobal.push(dRestitution);
    }
    if (hasAnomalie) {
      liveRecord.anomalies += 1;
      totalAnomalies += 1;
    }
    if (hasSms) {
      liveRecord.smsCount += 1;
      totalSms += 1;
    }
    if (isFacture) totalFactures += 1;
    if (isSameDayPrestation) {
      sameDayTotal += 1;
      if (expDate && livreDate && expDate.toDateString() === livreDate.toDateString()) {
        sameDayRespecte += 1;
      }
    }
    const dEnlevement = getHoursDiff(ramassageDemandeDate, ramassageEffectueDate);
    if (dEnlevement !== null) delaisEnlevementGlobal.push(dEnlevement);

    if (expDate) {
      const expDateStr = expDate.toISOString().slice(0, 10);
      liveRecord.expedieDates.add(expDateStr);

      // Charge journalière par station, pour l'écart-type d'équilibrage
      if (!stationDailyMap[stationEffective]) stationDailyMap[stationEffective] = {};
      stationDailyMap[stationEffective][expDateStr] = (stationDailyMap[stationEffective][expDateStr] || 0) + 1;
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

  // Écart-type de la charge journalière par station (équilibrage), dupliqué sur chaque livreur de la station
  const stationStdDev: Record<string, number> = {};
  Object.keys(stationDailyMap).forEach(station => {
    const counts = Object.values(stationDailyMap[station]);
    if (counts.length > 0) {
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
      stationStdDev[station] = parseFloat(Math.sqrt(variance).toFixed(1));
    } else {
      stationStdDev[station] = 0;
    }
  });

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

    // Nouveaux KPI par livreur
    const delai_restitution_cod_h = s.delaisRestitution.length > 0
      ? parseFloat((s.delaisRestitution.reduce((a, b) => a + b, 0) / s.delaisRestitution.length).toFixed(1))
      : 0;
    const livTauxAnomalie = s.dispatches > 0 ? parseFloat(((s.anomalies / s.dispatches) * 100).toFixed(1)) : 0;
    const livCoutLivraisonMoyen = s.livres > 0 ? parseFloat((s.remun / s.livres).toFixed(1)) : 0;
    const livTauxCommunication = s.dispatches > 0 ? parseFloat(((s.smsCount / s.dispatches) * 100).toFixed(1)) : 0;
    const ecart_type_charge_jour = stationStdDev[s.station] || 0;

    const id = `LIV-${1000 + idx}`;

    return {
      id,
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
      soc_enc,
      delai_restitution_cod_h,
      taux_anomalie: livTauxAnomalie,
      cout_livraison_moyen: livCoutLivraisonMoyen,
      taux_communication: livTauxCommunication,
      ecart_type_charge_jour,
      score_stabilite: 0, // nécessite l'historique de plusieurs snapshots, calculé côté frontend plus tard
      derniere_activite: s.derniereActiviteMs > 0 ? new Date(s.derniereActiviteMs).toISOString() : null
    };
  });

  onProgress?.(80);

  // Formater la tendance journalière (60 derniers jours)
  // Trier les dates ou prendre les 60 clés avec le plus d'activité
  // Les clés sont désormais des dates ISO (YYYY-MM-DD) : un tri de chaînes suffit à obtenir
  // l'ordre chronologique correct, y compris à cheval sur plusieurs années.
  const availableDatesStr = Object.keys(dailyTrendMap).sort();

  // Garder au maximum les 60 derniers jours
  const lastDatesKeys = availableDatesStr.slice(-60);

  const trend: DailyTrend[] = lastDatesKeys.map(dStr => {
    const val = dailyTrendMap[dStr];
    return {
      date: formatShortDateLabel(dStr),
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

  // Volet B : vue réseau par expéditeur
  const expediteurs: ExpediteurRecap[] = Object.entries(globalExpediteurMap)
    .map(([label, v], idx) => ({
      id: `EXP-${1000 + idx}`,
      expediteur: label,
      dispatches: v.dispatches,
      livres: v.livres,
      retours: v.retours,
      taux_livraison: v.dispatches > 0 ? parseFloat(((v.livres / v.dispatches) * 100).toFixed(1)) : 0,
      taux_retour: v.dispatches > 0 ? parseFloat(((v.retours / v.dispatches) * 100).toFixed(1)) : 0,
      nbLivreurs: v.livreursSet.size,
      nbCommunes: v.communesSet.size,
      montantCodLivre: parseFloat(v.montantLivreTotal.toFixed(2)),
    }))
    .sort((a, b) => b.dispatches - a.dispatches);

  // Volet C : vue géographique par zone (commune + wilaya)
  const zones: ZoneRecap[] = Object.entries(globalZoneMap)
    .map(([key, v]) => {
      const taux_retour = v.dispatches > 0 ? parseFloat(((v.retours / v.dispatches) * 100).toFixed(1)) : 0;
      const niveauRisque: "faible" | "moyen" | "eleve" = taux_retour > 30 ? "eleve" : taux_retour >= 15 ? "moyen" : "faible";
      return {
        id: key,
        commune: v.commune,
        wilaya: v.wilaya,
        dispatches: v.dispatches,
        livres: v.livres,
        retours: v.retours,
        taux_livraison: v.dispatches > 0 ? parseFloat(((v.livres / v.dispatches) * 100).toFixed(1)) : 0,
        taux_retour,
        niveauRisque,
      };
    })
    .sort((a, b) => b.dispatches - a.dispatches);

  // Nouveaux KPI globaux (moyennes/taux dérivés des compteurs accumulés pendant la boucle)
  const delai_restitution_cod_moy_h = delaisRestitutionGlobal.length > 0
    ? parseFloat((delaisRestitutionGlobal.reduce((a, b) => a + b, 0) / delaisRestitutionGlobal.length).toFixed(1))
    : 0;
  const taux_anomalie = total_dispatches > 0 ? parseFloat(((totalAnomalies / total_dispatches) * 100).toFixed(1)) : 0;
  const totalRemunGlobal = recap.reduce((s, x) => s + x.remun, 0);
  const cout_livraison_moyen = total_livres > 0 ? parseFloat((totalRemunGlobal / total_livres).toFixed(1)) : 0;
  const taux_communication = total_dispatches > 0 ? parseFloat(((totalSms / total_dispatches) * 100).toFixed(1)) : 0;
  const taux_same_day_respecte = sameDayTotal > 0 ? parseFloat(((sameDayRespecte / sameDayTotal) * 100).toFixed(1)) : 0;
  const delai_enlevement_moy_h = delaisEnlevementGlobal.length > 0
    ? parseFloat((delaisEnlevementGlobal.reduce((a, b) => a + b, 0) / delaisEnlevementGlobal.length).toFixed(1))
    : 0;
  const taux_colis_factures = total_dispatches > 0 ? parseFloat(((totalFactures / total_dispatches) * 100).toFixed(1)) : 0;
  // Montant COD total des colis livrés (encaissé pour le compte des clients expéditeurs) —
  // ce n'est pas une marge pour IMIR, juste le volume d'argent qui transite via les livraisons.
  const montant_cod_livre_total = parseFloat(expediteurs.reduce((s, e) => s + e.montantCodLivre, 0).toFixed(2));

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
    statuts_sans_dispatch: toSortedBreakdown(skippedNoDispatchByStatut, skippedNoDispatchExamples),
    delai_restitution_cod_moy_h,
    taux_anomalie,
    cout_livraison_moyen,
    taux_communication,
    taux_same_day_respecte,
    delai_enlevement_moy_h,
    taux_colis_factures,
    montant_cod_livre_total
  };

  onProgress?.(100);

  return {
    data: {
      global,
      recap,
      trend,
      by_station,
      expediteurs,
      zones
    },
    flatRows
  };
}
