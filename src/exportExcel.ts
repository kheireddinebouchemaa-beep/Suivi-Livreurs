import * as XLSX from "xlsx";
import { AppData, LivreurRecap, StationRecap } from "./types";
import { 
  getPerfCategory, 
  getDelaiCategory, 
  getRetourCategory, 
  getCompositeScore, 
  getSOC, 
  getSOCLevel 
} from "./utils";

// Generic download function to write xlsx file
export function downloadExcel(
  filename: string,
  sheets: { name: string; data: Record<string, any>[]; headerNote?: string }[]
) {
  const wb = XLSX.utils.book_new();
  
  sheets.forEach(({ name, data, headerNote }) => {
    let ws;
    if (headerNote) {
      ws = XLSX.utils.aoa_to_sheet([[headerNote]]);
      XLSX.utils.sheet_add_json(ws, data, { origin: "A3" });
    } else {
      ws = XLSX.utils.json_to_sheet(data);
    }
    
    // Auto-fit column widths (basic implementation)
    const maxCols = data.length > 0 ? Object.keys(data[0]).length : 5;
    const wsRange = ws["!ref"];
    if (wsRange) {
      const range = XLSX.utils.decode_range(wsRange);
      const colsWidth = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        let maxLen = 10;
        for (let r = range.s.r; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v) {
            const len = String(cell.v).length;
            if (len > maxLen) maxLen = len;
          }
        }
        colsWidth.push({ wch: Math.min(40, maxLen + 2) });
      }
      ws["!cols"] = colsWidth;
    }
    
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(wb, `IMIR_${filename}_${dateStr}.xlsx`);
}

/**
 * 📊 Onglet "Vue d'ensemble"
 */
export function exportOverviewExcel(data: AppData) {
  const averageSOC = data.recap.length > 0
    ? parseFloat((data.recap.reduce((sum, item) => sum + (item.soc || 0), 0) / data.recap.length).toFixed(1))
    : 0;
    
  const pctRetours = data.global.total_dispatches > 0
    ? (data.global.total_retours / data.global.total_dispatches) * 100
    : 0;

  // Feuille 1 : KPIs Globaux
  const kpiData = [
    { "Indicateur": "Total Dispatchés", "Valeur": data.global.total_dispatches },
    { "Indicateur": "Total Livrés", "Valeur": data.global.total_livres },
    { "Indicateur": "Total Retours", "Valeur": data.global.total_retours },
    { "Indicateur": "Nombre de Livreurs", "Valeur": data.global.nb_livreurs },
    { "Indicateur": "Taux Global Livraison", "Valeur": `${data.global.taux_global.toFixed(1)}%` },
    { "Indicateur": "Taux Global Retour", "Valeur": `${pctRetours.toFixed(1)}%` },
    { "Indicateur": "Délai Moyen Livraison (h)", "Valeur": `${data.global.delai_moy.toFixed(1)}h` },
    { "Indicateur": "Délai Moyen Encaissement (h)", "Valeur": `${data.global.delai_encaiss_moy.toFixed(1)}h` },
    { "Indicateur": "Colis Non Livrés", "Valeur": data.global.non_livres },
    { "Indicateur": "SOC Moyen Réseau", "Valeur": averageSOC }
  ];

  // Feuille 2 : Top 10 Volume
  const top10VolRecap = [...data.recap]
    .sort((a, b) => b.livres - a.livres)
    .slice(0, 10)
    .map((l, index) => ({
      "Rang": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Livrés": l.livres,
      "Taux Livraison": `${l.taux_livraison.toFixed(1)}%`
    }));

  // Feuille 3 : Top 10 Retours
  const top10RetRecap = [...data.recap]
    .sort((a, b) => b.retours - a.retours)
    .slice(0, 10)
    .map((l, index) => ({
      "Rang": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Retours": l.retours,
      "Taux Retour": `${l.taux_retour.toFixed(1)}%`
    }));

  // Feuille 4 : Tendance Journalière
  const trendRecap = data.trend.map(t => ({
    "Date": t.date,
    "Dispatchés": t.dispatches,
    "Livrés": t.livres,
    "Retours": t.retours
  }));

  downloadExcel("VueEnsemble", [
    { name: "KPIs Globaux", data: kpiData },
    { name: "Top 10 Volume", data: top10VolRecap },
    { name: "Top 10 Retours", data: top10RetRecap },
    { name: "Tendance Journalière", data: trendRecap }
  ]);
}

/**
 * 👤 Onglet "Livreurs"
 */
export function exportLivreursExcel(filteredLivreurs: LivreurRecap[], activeFiltersDescription: string) {
  const dataRows = filteredLivreurs.map((l, index) => ({
    "Rang": index + 1,
    "Livreur": l.livreur,
    "Station": l.station,
    "Perf": getPerfCategory(l.taux_livraison),
    "Dispatches": l.dispatches,
    "Livrés": l.livres,
    "Taux Livraison %": `${l.taux_livraison.toFixed(1)}%`,
    "Retours": l.retours,
    "Taux Retour %": `${l.taux_retour.toFixed(1)}%`,
    "Délai Dispatch (h)": l.delai_moy_h > 0 ? parseFloat(l.delai_moy_h.toFixed(1)) : 0,
    "Délai FDR (h)": l.delai_fdr_h > 0 ? parseFloat(l.delai_fdr_h.toFixed(1)) : 0,
    "Délai Encaissement (h)": l.delai_enc_h > 0 ? parseFloat(l.delai_enc_h.toFixed(1)) : 0,
    "Jours Actifs": l.jours_actifs,
    "Moy Colis/Jour": parseFloat(l.moy_colis_jour.toFixed(1)),
    "Domicile": l.domicile,
    "Stop Desk": l.stop_desk,
    "Échanges": l.echanges,
    "Wilayas": l.wilayas,
    "Communes": l.communes,
    "Rémunération DA": l.remun,
    "Montant Encaissé DA": l.montant_enc,
    "SOC": parseFloat(l.soc.toFixed(1)),
    "SOC Taux": parseFloat(l.soc_taux.toFixed(1)),
    "SOC Rapidité": parseFloat(l.soc_rapidite.toFixed(1)),
    "SOC Encaissement": parseFloat(l.soc_enc.toFixed(1)),
    "Niveau SOC": getSOCLevel(l.soc)
  }));

  downloadExcel("Livreurs_Filtres", [
    { 
      name: "Livreurs", 
      data: dataRows, 
      headerNote: `Export IMIR Logistics — Filtres appliqués : ${activeFiltersDescription || "Aucun"}`
    }
  ]);
}

/**
 * ↩️ Onglet "Retours & Incidents"
 */
export function exportRetoursExcel(data: AppData) {
  // Top Retours absolu (dispatches >= 20)
  const topRetoursList = [...data.recap]
    .filter(l => l.dispatches >= 20)
    .sort((a, b) => b.retours - a.retours)
    .map((l, index) => ({
      "#": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Dispatches": l.dispatches,
      "Retours": l.retours,
      "Taux Retour %": `${l.taux_retour.toFixed(1)}%`,
      "Taux Livraison %": `${l.taux_livraison.toFixed(1)}%`,
      "Alerte": getRetourCategory(l.taux_retour)
    }));

  // Classement complet retours (dispatches >= 10)
  const allRetoursList = [...data.recap]
    .filter(l => l.dispatches >= 10)
    .sort((a, b) => b.taux_retour - a.taux_retour)
    .map((l, index) => ({
      "Rang": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Dispatches": l.dispatches,
      "Livrés": l.livres,
      "Retours": l.retours,
      "Taux Retour %": `${l.taux_retour.toFixed(1)}%`,
      "Taux Livraison %": `${l.taux_livraison.toFixed(1)}%`,
      "Catégorie": getRetourCategory(l.taux_retour)
    }));

  downloadExcel("Retours", [
    { name: "Top Retours", data: topRetoursList },
    { name: "Classement Complet Retours", data: allRetoursList }
  ]);
}

/**
 * ⏱️ Onglet "Délais"
 */
export function exportDelaisExcel(data: AppData) {
  // Top lents (FDR ou Dispatch élevé) (dispatches >= 15)
  const topLentsList = [...data.recap]
    .filter(l => l.dispatches >= 15 && l.delai_moy_h > 0)
    .sort((a, b) => b.delai_moy_h - a.delai_moy_h)
    .slice(0, 20)
    .map((l, index) => ({
      "#": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Dispatches": l.dispatches,
      "Livrés": l.livres,
      "Délai Dispatch (h)": parseFloat(l.delai_moy_h.toFixed(1)),
      "Délai FDR (h)": parseFloat(l.delai_fdr_h.toFixed(1)),
      "Catégorie": getDelaiCategory(l.delai_moy_h)
    }));

  // Classement Complet Délais (dispatches >= 10)
  const allDelaisList = [...data.recap]
    .filter(l => l.dispatches >= 10)
    .sort((a, b) => b.delai_moy_h - a.delai_moy_h)
    .map((l, index) => ({
      "Rang": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "Dispatches": l.dispatches,
      "Livrés": l.livres,
      "Délai Dispatch (h)": l.delai_moy_h > 0 ? parseFloat(l.delai_moy_h.toFixed(1)) : 0,
      "Délai FDR (h)": l.delai_fdr_h > 0 ? parseFloat(l.delai_fdr_h.toFixed(1)) : 0,
      "Délai Encaissement (h)": l.delai_enc_h > 0 ? parseFloat(l.delai_enc_h.toFixed(1)) : 0,
      "Catégorie": getDelaiCategory(l.delai_moy_h)
    }));

  downloadExcel("Delais", [
    { name: "Top Lents", data: topLentsList },
    { name: "Classement Complet Délais", data: allDelaisList }
  ]);
}

/**
 * 🏆 Onglet "Performance"
 */
export function exportPerformanceExcel(data: AppData) {
  // Classement performance "classique" (dispatches >= 20)
  const performanceList = [...data.recap]
    .filter(l => l.dispatches >= 20)
    .sort((a, b) => getCompositeScore(b) - getCompositeScore(a))
    .map((l, index) => {
      const score = getCompositeScore(l);
      return {
        "Rang": index + 1,
        "Livreur": l.livreur,
        "Station": l.station,
        "Dispatches": l.dispatches,
        "Livrés": l.livres,
        "Retours": l.retours,
        "Taux Livraison %": `${l.taux_livraison.toFixed(1)}%`,
        "Taux Retour %": `${l.taux_retour.toFixed(1)}%`,
        "Délai (h)": l.delai_moy_h > 0 ? parseFloat(l.delai_moy_h.toFixed(1)) : 0,
        "Jours Actifs": l.jours_actifs,
        "Moy/Jour": parseFloat(l.moy_colis_jour.toFixed(1)),
        "Rémunération DA": l.remun,
        "Score Composite": score,
        "Niveau": getPerfCategory(score)
      };
    });

  // Classement SOC (dispatches >= 20)
  const socList = [...data.recap]
    .filter(l => l.dispatches >= 20)
    .sort((a, b) => b.soc - a.soc)
    .map((l, index) => ({
      "Rang SOC": index + 1,
      "Livreur": l.livreur,
      "Station": l.station,
      "SOC /100": parseFloat(l.soc.toFixed(1)),
      "Niveau SOC": getSOCLevel(l.soc),
      "Composante Taux (30%)": parseFloat(l.soc_taux.toFixed(1)),
      "Composante Rapidité (20%)": parseFloat(l.soc_rapidite.toFixed(1)),
      "Composante Encaissement (50%)": parseFloat(l.soc_enc.toFixed(1)),
      "Taux Livraison %": `${l.taux_livraison.toFixed(1)}%`,
      "Délai Dispatch (h)": l.delai_moy_h > 0 ? parseFloat(l.delai_moy_h.toFixed(1)) : 0,
      "Délai Encaissement (h)": l.delai_enc_h > 0 ? parseFloat(l.delai_enc_h.toFixed(1)) : 0
    }));

  downloadExcel("Performance_SOC", [
    { name: "Classement Performance", data: performanceList },
    { name: "Classement SOC", data: socList }
  ]);
}

/**
 * 🏢 Onglet "Stations"
 */
export function exportStationsExcel(data: AppData) {
  const stationsList = [...data.by_station]
    .sort((a, b) => b.total_dispatches - a.total_dispatches)
    .map((s, index) => {
      // Calcul du statut de la station
      let sat = "Standard";
      if (s.taux_moy >= 85) sat = "Élite";
      else if (s.taux_moy < 60) sat = "Surveillance";
      return {
        "#": index + 1,
        "Station": s.station,
        "Nb Livreurs": s.nb_livreurs,
        "Dispatches": s.total_dispatches,
        "Livrés": s.total_livres,
        "Retours": s.total_retours,
        "Taux Livraison Moyen %": `${s.taux_moy.toFixed(1)}%`,
        "Délai Moyen (h)": parseFloat(s.delai_moy.toFixed(1)),
        "Statut": sat
      };
    });

  downloadExcel("Stations", [
    { name: "Stations", data: stationsList }
  ]);
}
