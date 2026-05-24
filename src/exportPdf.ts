import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AppData, LivreurRecap } from "./types";
import { 
  N, F, P, 
  getPerfCategory, 
  getDelaiCategory, 
  getRetourCategory, 
  getCompositeScore, 
  getSOC, 
  getSOCLevel 
} from "./utils";

// Standard IMIR Header
function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  
  // Fond navy #1B3A5C
  doc.setFillColor(27, 58, 92);
  doc.rect(0, 0, W, 22, "F");
  
  // Bande orange #E8741A
  doc.setFillColor(232, 116, 26);
  doc.rect(0, 22, W, 1.5, "F");
  
  // Logo carré
  doc.setFillColor(232, 116, 26);
  doc.roundedRect(14, 5, 12, 12, 1.5, 1.5, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("IMIR", 20, 12.5, { align: "center" });
  
  // Titres
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 31, 10.5);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 220);
  doc.text(subtitle, 31, 15.5);
  
  // Date de génération (coin droit)
  const todayStr = new Date().toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.setFontSize(6.5);
  doc.setTextColor(190, 210, 235);
  doc.text(`Sécurisé le : ${todayStr}`, W - 14, 12.5, { align: "right" });
}

// Standard IMIR Footer
function addFooter(doc: jsPDF, page: number, total: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  
  doc.setFillColor(249, 250, 251);
  doc.rect(0, H - 10, W, 10, "F");
  
  doc.setDrawColor(221, 227, 238);
  doc.line(0, H - 10, W, H - 10);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(107, 122, 153);
  doc.text("IMIR Logistics — Confidentiel — Extraction ECOTRACK v3.11", 14, H - 4.5);
  doc.text(`Page ${page} / ${total}`, W - 14, H - 4.5, { align: "right" });
}

// Section Title
function drawSectionTitle(doc: jsPDF, title: string, yPos: number) {
  doc.setFillColor(232, 116, 26);
  doc.rect(14, yPos - 4.5, 3, 5.5, "F");
  
  doc.setTextColor(27, 58, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, 20, yPos);
}

// KPI Box Utility
function drawKpiCards(doc: jsPDF, cards: { label: string; val: string }[], startY: number, height = 13) {
  const pageW = doc.internal.pageSize.getWidth();
  const cardW = (pageW - 28 - (cards.length - 1) * 3) / cards.length;
  
  cards.forEach((card, idx) => {
    const x = 14 + idx * (cardW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 227, 238);
    doc.rect(x, startY, cardW, height, "F");
    doc.rect(x, startY, cardW, height, "S");
    
    // Ribbon
    doc.setFillColor(15, 30, 60);
    doc.rect(x, startY, cardW, 1, "F");
    
    // Label
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(card.label.toUpperCase(), x + cardW / 2, startY + 4, { align: "center" });
    
    // Value
    doc.setTextColor(27, 58, 92);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(card.val, x + cardW / 2, startY + 9.5, { align: "center" });
  });
}

// Apply headers and footers post-generation to all pages
function applyHeaderFooter(doc: jsPDF, title: string, subtitle: string) {
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addHeader(doc, title, subtitle);
    addFooter(doc, i, pageCount);
  }
}

// Save document utility
function saveDoc(doc: jsPDF, filename: string) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`IMIR_${filename}_${dateStr}.pdf`);
}

/**
 * 📊 PDF "Vue d'ensemble"
 */
export async function exportOverviewPdf(data: AppData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  const averageSOC = data.recap.length > 0
    ? parseFloat((data.recap.reduce((sum, item) => sum + (item.soc || 0), 0) / data.recap.length).toFixed(1))
    : 0;
    
  const pctRetours = data.global.total_dispatches > 0
    ? (data.global.total_retours / data.global.total_dispatches) * 100
    : 0;

  // Row 1 Cards
  drawKpiCards(doc, [
    { label: "Livreurs Actifs", val: N(data.global.nb_livreurs) },
    { label: "Total Dispatchs", val: N(data.global.total_dispatches) },
    { label: "Total Livrés", val: N(data.global.total_livres) },
    { label: "Taux Distribution", val: P(data.global.taux_global) }
  ], 28);

  // Row 2 Cards
  drawKpiCards(doc, [
    { label: "Total Retours", val: N(data.global.total_retours) },
    { label: "Taux Retour", val: P(pctRetours) },
    { label: "Délai Moyen (h)", val: `${data.global.delai_moy.toFixed(1)}h` },
    { label: "SOC Moyen Réseau", val: `${averageSOC.toFixed(1)} /100` }
  ], 44);

  // Top 10 Volume
  let currentY = 64;
  drawSectionTitle(doc, "TOP 10 VOLUME LIVRÉ — CADENCES DE POINTE IMIR", currentY);
  const topV = [...data.recap].sort((a, b) => b.livres - a.livres).slice(0, 10);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Dispatchs", "Livrés", "Taux de Livraison"]],
    body: topV.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.livres),
      P(l.taux_livraison)
    ]),
    headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });

  // Top 10 Retours
  currentY = (doc as any).lastAutoTable.finalY + 7;
  drawSectionTitle(doc, "TOP 10 RETOURS ABSOLUS (DISPATCHS >= 15)", currentY);
  const topR = [...data.recap].sort((a, b) => b.retours - a.retours).slice(0, 10);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Dispatchs", "Livrés", "Retours", "Taux Retour"]],
    body: topR.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.livres),
      N(l.retours),
      P(l.taux_retour)
    ]),
    headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });

  // Top 10 Plus Lents
  currentY = (doc as any).lastAutoTable.finalY + 7;
  drawSectionTitle(doc, "TOP 10 DISTRIBUTEURS AVEC LES PLUS LONGS DÉLAIS", currentY);
  const topL = [...data.recap].filter(l => l.delai_moy_h > 0).sort((a, b) => b.delai_moy_h - a.delai_moy_h).slice(0, 10);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Dispatchs", "Délai Distribution", "Délai FDR", "Catégorie"]],
    body: topL.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      l.delai_fdr_h > 0 ? `${F(l.delai_fdr_h)}h` : "–",
      getDelaiCategory(l.delai_moy_h)
    ]),
    headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });

  applyHeaderFooter(doc, "TABLEAU DE BORD EXÉCUTIF LIVREURS", "IMIR LOGISTICS · ECOTRACK PILOTAGE DES DRIVERS");
  saveDoc(doc, "VueEnsemble");
}

/**
 * 👤 PDF "Livreurs"
 */
export async function exportLivreursPdf(filteredLivreurs: LivreurRecap[], filtersDescription: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  drawSectionTitle(doc, `REGISTRE DE L'ENSEMBLE DES LIVREURS ACTIFS ET FILTRÉS`, 28);
  
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Filtres appliqués : ${filtersDescription || "Aucun filtre — Liste globale brute"}`, 14, 33);

  autoTable(doc, {
    startY: 36,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rank", "Livreur", "Station", "Perf.", "Disp.", "Livrés", "Tx Livr.", "Retours", "Tx Ret.", "Délai", "Score SOC"]],
    body: filteredLivreurs.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      getPerfCategory(l.taux_livraison),
      N(l.dispatches),
      N(l.livres),
      P(l.taux_livraison),
      N(l.retours),
      P(l.taux_retour),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      F(l.soc)
    ]),
    headStyles: { fillColor: [27, 58, 92], fontSize: 6.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 5.8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body") {
        const textVal = String(dataCell.cell.raw);
        if (dataCell.column.index === 3) { // Perf Category
          if (textVal === "Excellent") {
            dataCell.cell.styles.textColor = [22, 163, 74];
            dataCell.cell.styles.fontStyle = "bold";
          } else if (textVal === "Faible") {
            dataCell.cell.styles.textColor = [220, 38, 38];
            dataCell.cell.styles.fontStyle = "bold";
          } else if (textVal === "Bon") {
            dataCell.cell.styles.textColor = [37, 99, 235];
          } else if (textVal === "Moyen") {
            dataCell.cell.styles.textColor = [234, 88, 12];
          }
        }
        if (dataCell.column.index === 6) { // Taux Livraison
          const numVal = parseFloat(textVal);
          if (numVal >= 90) {
            dataCell.cell.styles.textColor = [22, 163, 74];
            dataCell.cell.styles.fontStyle = "bold";
          } else if (numVal < 60) {
            dataCell.cell.styles.textColor = [220, 38, 38];
            dataCell.cell.styles.fontStyle = "bold";
          }
        }
        if (dataCell.column.index === 8) { // Taux Retour
          const numVal = parseFloat(textVal);
          if (numVal >= 30) {
            dataCell.cell.styles.textColor = [220, 38, 38];
            dataCell.cell.styles.fontStyle = "bold";
          }
        }
        if (dataCell.column.index === 10) { // SOC
          const numVal = parseFloat(textVal);
          if (numVal >= 80) {
            dataCell.cell.styles.textColor = [22, 163, 74];
            dataCell.cell.styles.fontStyle = "bold";
          } else if (numVal < 40) {
            dataCell.cell.styles.textColor = [220, 38, 38];
            dataCell.cell.styles.fontStyle = "bold";
          }
        }
      }
    }
  });

  applyHeaderFooter(doc, "ANALYSE DU REGISTRE DES LIVREURS", `IMIR LOGISTICS — FILTRAGE SUR RECAPITULATIF`);
  saveDoc(doc, "Livreurs");
}

/**
 * ↩️ PDF "Retours & Incidents"
 */
export async function exportRetoursPdf(data: AppData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  // PAGE 1 : Audit et Alerte Rouge
  // Cards
  const alertLivreurs = data.recap.filter(l => l.dispatches >= 15 && l.taux_retour >= 25).length;
  drawKpiCards(doc, [
    { label: "Total Dispatchés", val: N(data.global.total_dispatches) },
    { label: "Total Retours", val: N(data.global.total_retours) },
    { label: "Taux Retour Réseau", val: P(data.global.total_dispatches > 0 ? (data.global.total_retours / data.global.total_dispatches) * 100 : 0) },
    { label: "Drivers en Alerte (>=25% Ret.)", val: alertLivreurs.toString() }
  ], 28);

  const top20Ret = [...data.recap].sort((a, b) => b.retours - a.retours).slice(0, 20);
  
  let currentY = 46;
  drawSectionTitle(doc, "TOP 20 LIVREURS COMPRESSANT LES RETOURS EN ABSOLUS (Alerte Volume)", currentY);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["#", "Livreur", "Station Destination", "Dispatchs", "Retours", "Taux de Retour", "Taux de Livraison", "Indicateur"]],
    body: top20Ret.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.retours),
      P(l.taux_retour),
      P(l.taux_livraison),
      getRetourCategory(l.taux_retour)
    ]),
    headStyles: { fillColor: [186, 26, 26], fontSize: 7, fontStyle: "bold" }, // Rouge pour retours
    bodyStyles: { fontSize: 6.2, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [254, 242, 242] }, // Fond très rouge clair
    didParseCell: (dataCell) => {
      if (dataCell.section === "body") {
        if (dataCell.column.index === 5) { // Taux retour
          dataCell.cell.styles.fontStyle = "bold";
          const num = parseFloat(String(dataCell.cell.raw));
          if (num >= 30) dataCell.cell.styles.textColor = [186, 26, 26];
        }
        if (dataCell.column.index === 7) { // Indicateur Alerte text
          const txt = String(dataCell.cell.raw);
          if (txt === "Critique") {
            dataCell.cell.styles.fontStyle = "bold";
            dataCell.cell.styles.textColor = [186, 26, 26];
          } else if (txt === "Élevé") {
            dataCell.cell.styles.textColor = [194, 120, 3];
          }
        }
      }
    }
  });

  // PAGE 2 : Classement complet des taux de retour
  doc.addPage();
  drawSectionTitle(doc, "CLASSEMENT INTÉGRAL DU TAUX DE RETOUR DE LA FLOTTE (dispatches >= 10)", 28);
  
  const allRetSorted = [...data.recap].filter(l => l.dispatches >= 10).sort((a, b) => b.taux_retour - a.taux_retour);
  
  autoTable(doc, {
    startY: 33,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Origin", "Dispatchs", "Livrés", "Retours", "Taux Retour %", "Catégorie d'Alerte"]],
    body: allRetSorted.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.livres),
      N(l.retours),
      P(l.taux_retour),
      getRetourCategory(l.taux_retour)
    ]),
    headStyles: { fillColor: [127, 29, 29], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body" && dataCell.column.index === 6) {
        dataCell.cell.styles.fontStyle = "bold";
        const num = parseFloat(String(dataCell.cell.raw));
        if (num >= 25) {
          dataCell.cell.styles.textColor = [220, 38, 38];
        } else if (num < 10) {
          dataCell.cell.styles.textColor = [22, 163, 74];
        }
      }
    }
  });

  applyHeaderFooter(doc, "GUIDE ET SUIVI DES INCIDENTS RETOURS", "IMIR LOGISTICS · ECOTRACK PILOTAGE FLOTTE DU RÉSEAU");
  saveDoc(doc, "Retours");
}

/**
 * ⏱️ PDF "Délais"
 */
export async function exportDelaisPdf(data: AppData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  // Page 1 Cards
  const driversVerySlow = data.recap.filter(l => l.dispatches >= 10 && l.delai_moy_h > 72).length;
  drawKpiCards(doc, [
    { label: "Délai Distribution Moyen", val: `${data.global.delai_moy.toFixed(1)}h` },
    { label: "Délai Encaissement Moyen", val: `${data.global.delai_encaiss_moy.toFixed(1)}h` },
    { label: "Livreurs Très Lents (>72h)", val: driversVerySlow.toString() },
    { label: "Standard Logistique", val: "Livr. sous 48h" }
  ], 28);

  // Top 20 lents
  const top20Slow = [...data.recap].filter(l => l.delai_moy_h > 0).sort((a, b) => b.delai_moy_h - a.delai_moy_h).slice(0, 20);
  
  let currentY = 46;
  drawSectionTitle(doc, "TOP 20 LIVREURS LES PLUS LENTS (Performance et Transit Temps)", currentY);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["#", "Livreur", "Station Destination", "Dispatchs", "Livrés", "Délai Dist. (h)", "Délai FDR (h)", "Délai Enc. (h)", "Catégorie"]],
    body: top20Slow.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.livres),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      l.delai_fdr_h > 0 ? `${F(l.delai_fdr_h)}h` : "–",
      l.delai_enc_h > 0 ? `${F(l.delai_enc_h)}h` : "–",
      getDelaiCategory(l.delai_moy_h)
    ]),
    headStyles: { fillColor: [214, 94, 15], fontSize: 7, fontStyle: "bold" }, // Orange pour délais
    bodyStyles: { fontSize: 6.2, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body") {
        if (dataCell.column.index === 5) {
          dataCell.cell.styles.fontStyle = "bold";
          const d = parseFloat(String(dataCell.cell.raw));
          if (d >= 72) dataCell.cell.styles.textColor = [194, 65, 12];
        }
        if (dataCell.column.index === 8) {
          const cat = String(dataCell.cell.raw);
          if (cat === "Très lent" || cat === "Lent") {
            dataCell.cell.styles.textColor = [194, 65, 12];
            dataCell.cell.styles.fontStyle = "bold";
          }
        }
      }
    }
  });

  // Page 2 : Classement complet des délais
  doc.addPage();
  drawSectionTitle(doc, "CLASSEMENT INTÉGRAL DES DRIVERS DU PLUS LENT AU PLUS RAPIDE (>= 10 dispatchs)", 28);
  
  const allSlowSorted = [...data.recap].filter(l => l.dispatches >= 10).sort((a, b) => b.delai_moy_h - a.delai_moy_h);
  
  autoTable(doc, {
    startY: 33,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Dispatchs", "Livrés", "Délai Moyen (h)", "Délai FDR (h)", "Diligence"]],
    body: allSlowSorted.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      N(l.livres),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      l.delai_fdr_h > 0 ? `${F(l.delai_fdr_h)}h` : "–",
      getDelaiCategory(l.delai_moy_h)
    ]),
    headStyles: { fillColor: [154, 52, 18], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [253, 253, 253] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body" && dataCell.column.index === 5) {
        dataCell.cell.styles.fontStyle = "bold";
        const val = parseFloat(String(dataCell.cell.raw));
        if (val >= 48) {
          dataCell.cell.styles.textColor = [194, 65, 12];
        } else if (val <= 24 && val > 0) {
          dataCell.cell.styles.textColor = [22, 163, 74];
        }
      }
    }
  });

  applyHeaderFooter(doc, "SUIVI OPÉRATIONNEL DES DÉLAIS DE DISTRIBUTION", "IMIR LOGISTICS — ANALYSE DU SOUFFLEUR TEMPOREL");
  saveDoc(doc, "Delais");
}

/**
 * 🏆 PDF "Performance + SOC"
 */
export async function exportPerformancePdf(data: AppData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  const averageSOC = data.recap.length > 0
    ? parseFloat((data.recap.reduce((sum, item) => sum + (item.soc || 0), 0) / data.recap.length).toFixed(1))
    : 0;

  // Calculs rapides
  const excelNum = data.recap.filter(l => l.taux_livraison >= 90).length;
  const eliteSoc = data.recap.filter(l => l.soc >= 80).length;

  // PAGE 1: 4 cards performance top + 4 cards SOC bottom
  drawSectionTitle(doc, "METRIQUES DE PERFORMANCE GLOBALE & EXCELLENCE SOC (2x4 KPI CARDS)", 28);
  
  drawKpiCards(doc, [
    { label: "Taux Distribution Global", val: P(data.global.taux_global) },
    { label: "Délai Logistique Réseau", val: `${data.global.delai_moy.toFixed(1)}h` },
    { label: "Drivers Perf. Excellente", val: excelNum.toString() },
    { label: "Standard Cible", val: "Taux >= 85%" }
  ], 33);

  drawKpiCards(doc, [
    { label: "Moyenne Nationale SOC", val: `${averageSOC}/100` },
    { label: "Élite Distributeurs SOC", val: eliteSoc.toString() },
    { label: "Poids Encaissement", val: "50% du SOC" },
    { label: "Classement SOC", val: "Tranches >= 80" }
  ], 48);

  // Top 15 meilleurs livreurs
  let currentY = 67;
  drawSectionTitle(doc, "ÉLITE DU RÉSEAU IMIR — TOP 15 MEILLEURS DISTRIBUTEURS PARTENAIRES", currentY);
  const top15 = [...data.recap].sort((a, b) => b.soc - a.soc).slice(0, 15);
  
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Dispatchs", "Tx Livr.", "Délai (h)", "Incidents Ret.", "Niveau SOC", "SOC final"]],
    body: top15.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      N(l.dispatches),
      P(l.taux_livraison),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      l.delai_enc_h > 0 ? `${F(l.delai_enc_h)}h` : "–",
      getSOCLevel(l.soc),
      F(l.soc)
    ]),
    headStyles: { fillColor: [79, 70, 229], fontSize: 6.8, fontStyle: "bold" }, // Indigo / Violet
    bodyStyles: { fontSize: 6, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body") {
        if (dataCell.column.index === 7) { // Niveau
          dataCell.cell.styles.fontStyle = "bold";
          dataCell.cell.styles.textColor = [22, 163, 74];
        }
        if (dataCell.column.index === 8) { // SOC final
          dataCell.cell.styles.fontStyle = "bold";
          dataCell.cell.styles.textColor = [27, 58, 92];
        }
      }
    }
  });

  // PAGE 2: Classement complet performance
  doc.addPage();
  drawSectionTitle(doc, "CLASSEMENT INTÉGRAL DE PERFORMANCE CLASSIQUE (dispatches >= 20)", 28);
  const listPerf = [...data.recap].filter(l => l.dispatches >= 20).sort((a, b) => getCompositeScore(b) - getCompositeScore(a));
  
  autoTable(doc, {
    startY: 33,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["R", "Livreur", "Station Destination", "Disp", "Livrés", "Taux Livr", "Délai", "Compo. Score", "Type"]],
    body: listPerf.map((l, i) => {
      const score = getCompositeScore(l);
      return [
        (i + 1).toString(),
        l.livreur,
        l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
        N(l.dispatches),
        N(l.livres),
        P(l.taux_livraison),
        l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
        score.toFixed(1),
        getPerfCategory(score)
      ];
    }),
    headStyles: { fillColor: [17, 94, 89], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 6, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body" && dataCell.column.index === 7) {
        dataCell.cell.styles.fontStyle = "bold";
        const val = parseFloat(String(dataCell.cell.raw));
        if (val >= 80) dataCell.cell.styles.textColor = [22, 163, 74];
        else if (val < 50) dataCell.cell.styles.textColor = [220, 38, 38];
      }
    }
  });

  // PAGE 3: Classement complet SOC avec les 3 composantes détaillées
  doc.addPage();
  drawSectionTitle(doc, "GUIDE DE NOTATION COMPARATIVE OPERATIONAL RATINGS SOC (dispatches >= 20)", 28);
  
  const allSocSorted = [...data.recap].filter(l => l.dispatches >= 20).sort((a, b) => b.soc - a.soc);
  
  autoTable(doc, {
    startY: 33,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["Rang", "Livreur", "Station Destination", "Taux (30%)", "Rapidité (20%)", "Encaissement (50%)", "Taux Livr.", "Délai (h)", "Score SOC"]],
    body: allSocSorted.map((l, i) => [
      (i + 1).toString(),
      l.livreur,
      l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
      `${l.soc_taux.toFixed(1)}pt`,
      `${l.soc_rapidite.toFixed(1)}pt`,
      `${l.soc_enc.toFixed(1)}pt`,
      P(l.taux_livraison),
      l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
      `${l.soc.toFixed(1)} /100`
    ]),
    headStyles: { fillColor: [49, 46, 129], fontSize: 6.8, fontStyle: "bold" },
    bodyStyles: { fontSize: 5.8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body" && dataCell.column.index === 8) {
        dataCell.cell.styles.fontStyle = "bold";
        const numVal = parseFloat(String(dataCell.cell.raw));
        if (numVal >= 80) {
          dataCell.cell.styles.textColor = [22, 163, 74];
        } else if (numVal < 40) {
          dataCell.cell.styles.textColor = [220, 38, 38];
        }
      }
    }
  });

  applyHeaderFooter(doc, "AUDIT COMPARATIF RENDEMENT & SOC", "IMIR LOGISTICS — ANALYSE EN RÉGULATION DE QUALITÉ");
  saveDoc(doc, "Performance_SOC");
}

/**
 * 🏢 PDF "Stations"
 */
export async function exportStationsPdf(data: AppData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  drawSectionTitle(doc, "RÉPERTOIRE ANALYTIQUE ET DISPATCHING PAR HUB (STATION)", 28);
  
  const sortedStations = [...data.by_station].sort((a, b) => b.total_dispatches - a.total_dispatches);

  autoTable(doc, {
    startY: 33,
    margin: { left: 14, right: 14, top: 28, bottom: 15 },
    head: [["#", "Station Origin / Destination", "Actifs Drivers", "Total Dispatchs", "Livrés", "Retours", "Taux de Livraison Moyen", "Statut Hub"]],
    body: sortedStations.map((s, i) => {
      let sat = "Standard";
      if (s.taux_moy >= 85) sat = "Performante";
      else if (s.taux_moy < 60) sat = "Surveillance";
      return [
        (i + 1).toString(),
        s.station,
        s.nb_livreurs.toString(),
        N(s.total_dispatches),
        N(s.total_livres),
        N(s.total_retours),
        P(s.taux_moy),
        sat
      ];
    }),
    headStyles: { fillColor: [30, 41, 59], fontSize: 7, fontStyle: "bold" }, // Slate
    bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (dataCell) => {
      if (dataCell.section === "body" && dataCell.column.index === 7) {
        dataCell.cell.styles.fontStyle = "bold";
        const txt = String(dataCell.cell.raw);
        if (txt === "Performante") {
          dataCell.cell.styles.textColor = [22, 163, 74];
        } else if (txt === "Surveillance") {
          dataCell.cell.styles.textColor = [220, 38, 38];
        }
      }
    }
  });

  applyHeaderFooter(doc, "RÉCAPITULATIF TECHNIQUE DES HUBS (STATIONS)", "IMIR LOGISTICS · ECOTRACK SUIVI DES SECTEURS");
  saveDoc(doc, "Stations");
}
