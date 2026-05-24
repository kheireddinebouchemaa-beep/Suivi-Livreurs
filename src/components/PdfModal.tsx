import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AppData, LivreurRecap, StationRecap } from "../types";
import { N, F, P, getPerfCategory, getDelaiCategory, getRetourCategory, getCompositeScore } from "../utils";
import { FileText, Loader2, X, Download, ShieldAlert, Clock, Trophy, Map } from "lucide-react";

interface PdfModalProps {
  data: AppData;
  onClose: () => void;
  onShowToast: (msg: string, type: "success" | "error") => void;
}

export default function PdfModal({ data, onClose, onShowToast }: PdfModalProps) {
  const [generating, setGenerating] = useState(false);
  const [stepText, setStepText] = useState("");

  // Formatage de la date du jour pour l'en-tête et les noms de fichiers
  const getTodayDateStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}${mm}${dd}`;
  };

  const getFormattedToday = () => {
    return new Date().toLocaleDateString("fr-DZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Dessine l'en-tête et le ruban d'une page
  const drawPageHeader = (doc: jsPDF, title: string) => {
    const pageW = doc.internal.pageSize.getWidth();
    
    // 1. En-tête Navy (22mm de hauteur)
    doc.setFillColor(27, 58, 92); // navy #1B3A5C
    doc.rect(0, 0, pageW, 22, "F");

    // 2. Carré Orange IMIR (12x12mm)
    doc.setFillColor(232, 116, 26); // orange #E8741A
    doc.rect(14, 5, 12, 12, "F");
    
    // Texte "IM" blanc bold
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("IM", 17.5, 13);

    // 3. Titre et sous-titre
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 31, 10.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(179, 211, 245); // bleu clair
    doc.text("IMIR LOGISTICS — PILOTAGE DE LA PERFORMANCE LIVREURS", 31, 15);

    // 4. Date de génération (coin droit)
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Édité le : ${getFormattedToday()}`, pageW - 14, 12.5, { align: "right" });

    // 5. Ruban orange (1.5mm) sous l'en-tête nany
    doc.setFillColor(232, 116, 26);
    doc.rect(0, 22, pageW, 1.5, "F");
  };

  // Dessine une section de titre dans le corps
  const drawSectionTitle = (doc: jsPDF, title: string, yPos: number) => {
    // Barre colorée orange à gauche de 3mm de largeur et 6mm de hauteur
    doc.setFillColor(232, 116, 26);
    doc.rect(14, yPos - 5, 3, 6, "F");

    doc.setTextColor(27, 58, 92);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 20, yPos);
  };

  // Traite la numérotation complète en footer en tâche finale
  const addPageNumbers = (doc: jsPDF) => {
    const pageCount = doc.internal.pages.length - 1; // page de fin jsPDF est vide
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Fond gris très clair pour le footer
      doc.setFillColor(249, 250, 251);
      doc.rect(0, pageH - 11, pageW, 11, "F");
      doc.setDrawColor(221, 227, 238);
      doc.line(0, pageH - 11, pageW, pageH - 11);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(107, 122, 153); // #6B7A99
      doc.text("IMIR Logistics — Confidentiel — Extraction ECOTRACK v3.11", 14, pageH - 4.5);
      doc.text(`Page ${i} / ${pageCount}`, pageW - 14, pageH - 4.5, { align: "right" });
    }
  };

  const generatePDF = async (section: "complet" | "performance" | "retours" | "delais" | "stations") => {
    setGenerating(true);
    setStepText("Initialisation des utilitaires PDF...");

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        if (section === "complet" || section === "performance") {
          setStepText("Génération des statistiques de performance...");
          
          if (section === "complet") {
            // COVER / SYNTHESE - PAGE 1
            drawPageHeader(doc, "RAPPORT COMPLET DE PERFORMANCE LIVREURS");
            
            // 1. KPI Cards
            doc.setFillColor(255, 255, 255);
            // On dessine 4 cartes en ligne de Y=32 à Y=54
            const cardW = (pageW - 28 - 9) / 4; // marge 14+14=28, espacement 3 interstices * 3 = 9
            const cardData = [
              { label: "Taux Livraison", val: P(data.global.taux_global) },
              { label: "Livreurs Actifs", val: N(data.global.nb_livreurs) },
              { label: "Total Dispatch", val: N(data.global.total_dispatches) },
              { label: "Total Retours", val: N(data.global.total_retours) }
            ];

            cardData.forEach((card, idx) => {
              const x = 14 + idx * (cardW + 3);
              doc.setDrawColor(221, 227, 238);
              doc.rect(x, 28, cardW, 20, "F");
              doc.rect(x, 28, cardW, 20, "S");
              doc.setFillColor(27, 58, 92);
              doc.rect(x, 28, cardW, 1.5, "F"); // ruban haut de carte

              doc.setTextColor(107, 122, 153);
              doc.setFont("Helvetica", "bold");
              doc.setFontSize(7);
              doc.text(card.label.toUpperCase(), x + cardW / 2, 34, { align: "center" });

              doc.setTextColor(27, 58, 92);
              doc.setFontSize(11);
              doc.text(card.val, x + cardW / 2, 42, { align: "center" });
            });

            // 2. Distribution section
            drawSectionTitle(doc, "RÉPARTITION GLOBALE DES FLUX LIVRAISONS", 58);
            
            // Calculs rapides
            let exCount = 0, bonCount = 0, moyCount = 0, faibCount = 0;
            data.recap.forEach(l => {
              const cat = getPerfCategory(l.taux_livraison);
              if (cat === "Excellent") exCount++;
              else if (cat === "Bon") bonCount++;
              else if (cat === "Moyen") moyCount++;
              else faibCount++;
            });

            autoTable(doc, {
              startY: 63,
              margin: { left: 14, right: 14 },
              head: [["Performance", "Seuil de Taux", "Livreurs", "Pourcentage", "Alerte Opérationnelle"]],
              body: [
                ["Excellent 🟢", "≥ 90%", exCount, P((exCount / data.global.nb_livreurs) * 100), "Aucun risque — Standard de pointe nationale"],
                ["Bon 🔵", "75% – 90%", bonCount, P((bonCount / data.global.nb_livreurs) * 100), "Risque minime — Dans le standard standard"],
                ["Moyen 🟠", "60% – 75%", moyCount, P((moyCount / data.global.nb_livreurs) * 100), "Risque modéré — Plan d'encadrement requis"],
                ["Faible 🔴", "< 60%", faibCount, P((faibCount / data.global.nb_livreurs) * 100), "Critique — Restructuration d'itinéraires requise"]
              ],
              headStyles: { fillColor: [27, 58, 92], fontSize: 8, fontStyle: "bold" },
              bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
              alternateRowStyles: { fillColor: [249, 250, 251] }
            });

            // 3. Mini Tops
            drawSectionTitle(doc, "SYNTHÈSE TECHNIQUE — TOP 5 VOLUMES & TOP 5 RETOURS (dispatches >= 20)", 111);
            const top5V = [...data.recap].sort((a, b) => b.livres - a.livres).slice(0, 5);
            const top5R = [...data.recap].sort((a, b) => b.retours - a.retours).slice(0, 5);

            autoTable(doc, {
              startY: 115,
              margin: { left: 14, right: 14 },
              head: [["#", "Top Volume", "Colis", "Taux", "Top Retours (Absolus)", "Retours", "Taux Ret."]],
              body: top5V.map((v, i) => {
                const r = top5R[i];
                return [
                  (i + 1).toString(),
                  v.livreur,
                  v.livres.toLocaleString(),
                  P(v.taux_livraison),
                  r ? r.livreur : "–",
                  r ? r.retours.toLocaleString() : "–",
                  r ? P(r.taux_retour) : "–"
                ];
              }),
              headStyles: { fillColor: [27, 58, 92], fontSize: 7.5, fontStyle: "bold" },
              bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
              alternateRowStyles: { fillColor: [249, 250, 251] }
            });

            // Ajouter une nouvelle page pour le classement performance de la suite
            doc.addPage();
          }

          // CLASSEMENT PERFORMANCE (Page suivante pour complet, page 1 pour performance)
          setStepText("Génération du classement de performance globale...");
          drawPageHeader(doc, "FICHE DE PERFORMANCE ET COMPOSITE SOC");
          drawSectionTitle(doc, "CLASSEMENT D'EFFICACITÉ GLOBALE DES LIVREURS (dispatches ≥ 20)", 29);
          
          const perfList = [...data.recap]
            .filter(l => l.dispatches >= 20)
            .sort((a, b) => b.taux_livraison - a.taux_livraison);

          autoTable(doc, {
            startY: 33,
            margin: { left: 14, right: 14 },
            head: [["Rég", "Livreur", "Station Destination", "Dispatch", "Livrés", "Retours", "Tx Livr.", "Tx Ret.", "Délai", "Score SOC"]],
            body: perfList.map((l, i) => [
              (i + 1).toString(),
              l.livreur,
              l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
              N(l.dispatches),
              N(l.livres),
              N(l.retours),
              P(l.taux_livraison),
              P(l.taux_retour),
              l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
              `${F(getCompositeScore(l))}/100`
            ]),
            headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (dataCell) => {
              if (dataCell.section === "body") {
                const textVal = String(dataCell.cell.raw);
                if (dataCell.column.index === 6) { // Taux livraison
                  const numVal = parseFloat(textVal);
                  if (numVal >= 90) {
                    dataCell.cell.styles.textColor = [24, 165, 88]; // Vert imir
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (numVal < 60) {
                    dataCell.cell.styles.textColor = [217, 48, 37]; // Rouge
                    dataCell.cell.styles.fontStyle = "bold";
                  }
                }
                if (dataCell.column.index === 9) { // Score SOC
                  const numVal = parseFloat(textVal);
                  if (numVal >= 85) {
                    dataCell.cell.styles.textColor = [24, 165, 88];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (numVal < 60) {
                    dataCell.cell.styles.textColor = [217, 48, 37];
                    dataCell.cell.styles.fontStyle = "bold";
                  }
                }
              }
            }
          });
        }

        if (section === "complet" || section === "retours") {
          setStepText("Génération de l'analyse des incidents de retour...");
          // Si rapport complet, ajouter une page. Si uniquement retours, on démarre direct page 1.
          if (doc.internal.pages.length > 2 && section === "complet") {
            doc.addPage();
          }

          drawPageHeader(doc, "RAPPORT SUR LES RETOURS COLI & INCIDENTS");
          drawSectionTitle(doc, "COMPTE RENDU EXHAUSTIF DES RETOURS (dispatches ≥ 10)", 29);

          const retList = [...data.recap]
            .filter(l => l.dispatches >= 10)
            .sort((a, b) => b.taux_retour - a.taux_retour);

          autoTable(doc, {
            startY: 33,
            margin: { left: 14, right: 14 },
            head: [["#", "Livreur", "Station Destination", "Dispatchs", "Livrés", "Retours", "Taux Retour", "Danger Alerte"]],
            body: retList.map((l, i) => {
              const cat = getRetourCategory(l.taux_retour);
              return [
                (i + 1).toString(),
                l.livreur,
                l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
                N(l.dispatches),
                N(l.livres),
                N(l.retours),
                P(l.taux_retour),
                cat === "Critique" ? "🔴 Critique" :
                cat === "Élevé" ? "🟠 Élevé" :
                cat === "Normal" ? "🔵 Normal" : "🟢 Faible"
              ];
            }),
            headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (dataCell) => {
              if (dataCell.section === "body") {
                const textVal = String(dataCell.cell.raw);
                if (dataCell.column.index === 6) { // Taux retour
                  const numVal = parseFloat(textVal);
                  if (numVal >= 30) {
                    dataCell.cell.styles.textColor = [217, 48, 37]; // Rouge
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (numVal < 10) {
                    dataCell.cell.styles.textColor = [24, 165, 88]; // Vert
                  }
                }
                if (dataCell.column.index === 7) { // Danger Alerte text
                  if (textVal.includes("Critique")) {
                    dataCell.cell.styles.textColor = [217, 48, 37];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (textVal.includes("Élevé")) {
                    dataCell.cell.styles.textColor = [232, 116, 26]; // Orange
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (textVal.includes("Faible")) {
                    dataCell.cell.styles.textColor = [24, 165, 88];
                  }
                }
              }
            }
          });
        }

        if (section === "complet" || section === "delais") {
          setStepText("Génération de l'historique chronométrique des délais...");
          if (doc.internal.pages.length > 2 && section === "complet") {
            doc.addPage();
          }

          drawPageHeader(doc, "RAPPORT CHRONOMÉTRIQUE DES DÉLAIS ROUTE");
          drawSectionTitle(doc, "AUDIT COMPLET DES DÉLAIS DE TRANSIT (dispatches ≥ 10)", 29);

          const delayList = [...data.recap]
            .filter(l => l.dispatches >= 10 && l.delai_moy_h > 0)
            .sort((a, b) => b.delai_moy_h - a.delai_moy_h);

          autoTable(doc, {
            startY: 33,
            margin: { left: 14, right: 14 },
            head: [["#", "Livreur", "Station Destination", "Livrés", "Délai Dispatch", "Délai FDR", "Délai Encaissement", "Classement de Diligence"]],
            body: delayList.map((l, i) => {
              const cat = getDelaiCategory(l.delai_moy_h);
              return [
                (i + 1).toString(),
                l.livreur,
                l.station.replace(/^(\d+)\s*-\s*Station\s+/, ""),
                N(l.livres),
                l.delai_moy_h > 0 ? `${F(l.delai_moy_h)}h` : "–",
                l.delai_fdr_h > 0 ? `${F(l.delai_fdr_h)}h` : "–",
                l.delai_enc_h > 0 ? `${F(l.delai_enc_h)}h` : "–",
                cat === "Très lent" ? "🔴 Très lent (>72h)" :
                cat === "Lent" ? "🟠 Lent (48-72h)" :
                cat === "Normal" ? "🔵 Normal (24-48h)" : "🟢 Rapide (≤24h)"
              ];
            }),
            headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (dataCell) => {
              if (dataCell.section === "body") {
                const textVal = String(dataCell.cell.raw);
                if (dataCell.column.index === 4) { // Délai route
                  const numVal = parseFloat(textVal);
                  if (numVal > 72) {
                    dataCell.cell.styles.textColor = [217, 48, 37]; // Rouge
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (numVal <= 24) {
                    dataCell.cell.styles.textColor = [24, 165, 88]; // Vert
                  }
                }
                if (dataCell.column.index === 7) { // Diligence category
                  if (textVal.includes("Très lent")) {
                    dataCell.cell.styles.textColor = [217, 48, 37];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (textVal.includes("Lent")) {
                    dataCell.cell.styles.textColor = [232, 116, 26];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (textVal.includes("Rapide")) {
                    dataCell.cell.styles.textColor = [24, 165, 88];
                  }
                }
              }
            }
          });
        }

        if (section === "complet" || section === "stations") {
          setStepText("Génération de la synthèse comparative des gares...");
          if (doc.internal.pages.length > 2 && section === "complet") {
            doc.addPage();
          }

          drawPageHeader(doc, "SYNTHÈSE PAR HUB ET STATIONS DE LIVRAISON");
          drawSectionTitle(doc, "CLASSEMENT DES STATIONS NATIONALES D'EXPERTISES (Top 25)", 29);

          const sList = [...data.by_station]
            .sort((a, b) => b.total_dispatches - a.total_dispatches)
            .slice(0, 25);

          autoTable(doc, {
            startY: 33,
            margin: { left: 14, right: 14 },
            head: [["#", "Station Destination", "Livreurs", "Total Dispatchs", "Total Livrés", "Total Retours", "Taux Réussite Moyen", "Délai Route", "Statut Hub"]],
            body: sList.map((s, i) => [
              (i + 1).toString(),
              s.station,
              N(s.nb_livreurs),
              N(s.total_dispatches),
              N(s.total_livres),
              N(s.total_retours),
              P(s.taux_moy),
              `${F(s.delai_moy)}h`,
              s.taux_moy >= 80 ? "🟢 Performante" :
              s.taux_moy >= 65 ? "🔵 Normale" : "🔴 À améliorer"
            ]),
            headStyles: { fillColor: [27, 58, 92], fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 6.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (dataCell) => {
              if (dataCell.section === "body") {
                const textVal = String(dataCell.cell.raw);
                if (dataCell.column.index === 6) { // Taux moyen de reussite
                  const numVal = parseFloat(textVal);
                  if (numVal >= 80) {
                    dataCell.cell.styles.textColor = [24, 165, 88];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (numVal < 65) {
                    dataCell.cell.styles.textColor = [217, 48, 37];
                    dataCell.cell.styles.fontStyle = "bold";
                  }
                }
                if (dataCell.column.index === 8) { // Statut hub text
                  if (textVal.includes("Performante")) {
                    dataCell.cell.styles.textColor = [24, 165, 88];
                    dataCell.cell.styles.fontStyle = "bold";
                  } else if (textVal.includes("À améliorer")) {
                    dataCell.cell.styles.textColor = [217, 48, 37];
                    dataCell.cell.styles.fontStyle = "bold";
                  }
                }
              }
            }
          });
        }

        // ÉTAPE FINALE : Appliquer les numéros de page pour toutes les pages créées
        setStepText("Indexation et mise en page finale du document...");
        addPageNumbers(doc);

        // Télécharger
        const sectionFormatted = section.toUpperCase();
        const dateFormatted = getTodayDateStr();
        const fileName = `IMIR_KPI_Livreurs_${sectionFormatted}_${dateFormatted}.pdf`;
        doc.save(fileName);

        onShowToast(`✅ Rapport PDF "${sectionFormatted}" exporté avec succès !`, "success");
        setGenerating(false);
        onClose();
      } catch (err: any) {
        onShowToast(`❌ Erreur de génération PDF : ${err.message || err}`, "error");
        setGenerating(false);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 bg-[#1B3A5C]/35 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/85 backdrop-blur-xl rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/30">
        
        {/* Header */}
        <div className="bg-[#1B3A5C]/90 text-white p-4 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#E8741A]" />
            <h3 className="font-bold text-sm font-sans">Exporter des rapports PDF professionnels</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={generating}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-55"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          
          {generating ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-[#E8741A] animate-spin" />
              <div className="text-center">
                <span className="text-xs font-bold text-[#1B3A5C] block">{stepText}</span>
                <span className="text-[10px] text-[#6B7A99] mt-1 block">Création des graphiques vectoriels et formateurs...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Choisissez l'extraction de rapport dont vous avez besoin. Chaque PDF est généré dynamiquement aux formats officiels d'<strong>IMIR Logistics</strong> avec en-têtes et signatures conformes.
              </p>

              <div className="space-y-2 pt-2">
                {/* Rapport complet - Bouton principal */}
                <button
                  onClick={() => generatePDF("complet")}
                  className="w-full py-3 bg-[#1B3A5C] hover:bg-[#142b45] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2"
                >
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span>📋 RAPPORT EXHAUSTIF COMPLET</span>
                </button>

                <div className="text-[10px] uppercase font-bold text-slate-400 text-center py-1">Éditions sectorielles</div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Performance */}
                  <button
                    onClick={() => generatePDF("performance")}
                    className="py-2.5 bg-white/40 border border-[#1B3A5C]/30 text-[#1B3A5C] hover:bg-white/60 font-bold text-[11px] rounded-xl transition-colors flex flex-col items-center justify-center space-y-1 backdrop-blur-sm"
                  >
                    <Trophy className="w-4.5 h-4.5 text-amber-500" />
                    <span>🏆 Performance</span>
                  </button>

                  {/* Retours */}
                  <button
                    onClick={() => generatePDF("retours")}
                    className="py-2.5 bg-white/40 border border-[#1B3A5C]/30 text-[#1B3A5C] hover:bg-white/60 font-bold text-[11px] rounded-xl transition-colors flex flex-col items-center justify-center space-y-1 backdrop-blur-sm"
                  >
                    <ShieldAlert className="w-4.5 h-4.5 text-red-650 text-red-600" />
                    <span>↩️ Incidents</span>
                  </button>

                  {/* Délais */}
                  <button
                    onClick={() => generatePDF("delais")}
                    className="py-2.5 bg-white/40 border border-[#1B3A5C]/30 text-[#1B3A5C] hover:bg-white/60 font-bold text-[11px] rounded-xl transition-colors flex flex-col items-center justify-center space-y-1 backdrop-blur-sm"
                  >
                    <Clock className="w-4.5 h-4.5 text-[#E8741A]" />
                    <span>⏱️ Délais route</span>
                  </button>

                  {/* Stations */}
                  <button
                    onClick={() => generatePDF("stations")}
                    className="py-2.5 bg-white/40 border border-[#1B3A5C]/30 text-[#1B3A5C] hover:bg-white/60 font-bold text-[11px] rounded-xl transition-colors flex flex-col items-center justify-center space-y-1 backdrop-blur-sm"
                  >
                    <Map className="w-4.5 h-4.5 text-blue-800" />
                    <span>🏢 Par Station</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-white/20 border border-white/30 rounded-xl text-[10px] text-slate-700 leading-relaxed font-sans backdrop-blur-md">
            📌 <strong>Astuce :</strong> Le rapport exhaustif regroupe l'intégralité des sections en un unique document PDF multi-pages prêt à être imprimé ou partagé en comité de direction.
          </div>

        </div>
      </div>
    </div>
  );
}
