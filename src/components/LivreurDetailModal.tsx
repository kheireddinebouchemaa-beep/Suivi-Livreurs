import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Search, Loader2, AlertCircle, X, Package, Store, MapPin } from "lucide-react";
import { queryRawRows, queryBreakdown } from "../lib/api";
import { LivreurRecap, FlatRow, BreakdownRow } from "../types";
import { N, P } from "../utils";

interface LivreurDetailModalProps {
  snapshotId: string | null;
  livreur: LivreurRecap;
  onClose: () => void;
}

const PAGE_SIZE = 50;

// Doit correspondre au pseudo-livreur utilisé dans parser.ts pour les colis sans livreur assigné.
// Ces colis sont stockés avec un champ livreur NULL en base (pas la chaîne "(Sans livreur)"), donc
// on ne peut pas les retrouver par une simple égalité — voir noLivreur ci-dessous.
const SANS_LIVREUR_LABEL = "(Sans livreur)";

type Tab = "colis" | "expediteurs" | "communes";
type StatusChip = "tous" | "livres" | "retours" | "en_traitement";

const STATUS_FILTERS: Record<StatusChip, { label: string; filter: { isLivre?: boolean; isRetour?: boolean } }> = {
  tous: { label: "Tous", filter: {} },
  livres: { label: "Livrés", filter: { isLivre: true } },
  retours: { label: "Retours", filter: { isRetour: true } },
  en_traitement: { label: "En traitement", filter: { isLivre: false, isRetour: false } },
};

function BreakdownTable({ rows, groupLabel, showWilaya }: { rows: BreakdownRow[]; groupLabel: string; showWilaya: boolean }) {
  if (rows.length === 0) {
    return <div className="p-6 text-center text-xs text-slate-400">Aucune donnée.</div>;
  }
  return (
    <table className="w-full text-[11px]">
      <thead className="bg-slate-100 sticky top-0">
        <tr>
          <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">{groupLabel}</th>
          {showWilaya && <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Wilaya</th>}
          <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Colis</th>
          <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Livrés</th>
          <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Retours</th>
          <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Taux livr.</th>
          <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Taux retour</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
            <td className="px-3 py-1.5 font-semibold text-[#1B3A5C]">{r.label}</td>
            {showWilaya && <td className="px-3 py-1.5 text-slate-600">{r.wilaya}</td>}
            <td className="px-3 py-1.5 text-right font-mono">{N(r.dispatches)}</td>
            <td className="px-3 py-1.5 text-right font-mono text-emerald-600 font-bold">{N(r.livres)}</td>
            <td className="px-3 py-1.5 text-right font-mono text-red-600">{N(r.retours)}</td>
            <td className="px-3 py-1.5 text-right font-mono">{P(r.taux_livraison)}</td>
            <td className={`px-3 py-1.5 text-right font-mono ${r.taux_retour > 30 ? "text-red-600 font-bold" : r.taux_retour >= 15 ? "text-amber-600" : ""}`}>{P(r.taux_retour)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LivreurDetailModal({ snapshotId, livreur, onClose }: LivreurDetailModalProps) {
  const [tab, setTab] = useState<Tab>("colis");
  const [statusChip, setStatusChip] = useState<StatusChip>("tous");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Répartition par expéditeur / par zone (onglets dédiés) — calculée côté serveur à la
  // demande depuis le détail ligne par ligne, plutôt qu'embarquée dans le snapshot.
  const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshotId || (tab !== "expediteurs" && tab !== "communes")) return;
    let cancelled = false;
    setBreakdownLoading(true);
    setBreakdownError(null);
    queryBreakdown(snapshotId, livreur.livreur, livreur.station, tab === "expediteurs" ? "expediteur" : "zone")
      .then((res) => {
        if (cancelled) return;
        setBreakdownRows(res.rows);
      })
      .catch((err: any) => {
        if (!cancelled) setBreakdownError(err?.message || "Erreur lors du chargement.");
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false);
      });
    return () => { cancelled = true; };
  }, [snapshotId, tab, livreur.livreur, livreur.station]);

  // Liste des colis (onglet "Colis") — recherche côté serveur sur le détail ligne par ligne
  useEffect(() => {
    if (!snapshotId || tab !== "colis") return;
    let cancelled = false;
    setRowsLoading(true);
    setRowsError(null);
    const timeout = setTimeout(() => {
      queryRawRows(snapshotId, {
        ...(livreur.livreur === SANS_LIVREUR_LABEL ? { noLivreur: true } : { livreur: livreur.livreur }),
        station: livreur.station,
        ...STATUS_FILTERS[statusChip].filter,
        search,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          if (cancelled) return;
          setRows(res.rows);
          setTotal(res.total);
        })
        .catch((err: any) => {
          if (!cancelled) setRowsError(err?.message || "Erreur lors du chargement.");
        })
        .finally(() => {
          if (!cancelled) setRowsLoading(false);
        });
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [snapshotId, tab, statusChip, search, page, livreur.livreur, livreur.station]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#1B3A5C]/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* En-tête : identité + KPI clés du livreur */}
        <div className="bg-[#1B3A5C] text-white px-4 py-3 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm">{livreur.livreur}</h3>
              <p className="text-[10px] text-slate-300">{livreur.station}</p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3 text-center">
            <div><span className="block text-[9px] text-slate-300 uppercase">Dispatchés</span><span className="font-mono font-bold text-sm">{N(livreur.dispatches)}</span></div>
            <div><span className="block text-[9px] text-slate-300 uppercase">Livrés</span><span className="font-mono font-bold text-sm text-emerald-300">{N(livreur.livres)}</span></div>
            <div><span className="block text-[9px] text-slate-300 uppercase">Retours</span><span className="font-mono font-bold text-sm text-red-300">{N(livreur.retours)}</span></div>
            <div><span className="block text-[9px] text-slate-300 uppercase">Taux livr.</span><span className="font-mono font-bold text-sm text-[#F5A623]">{P(livreur.taux_livraison)}</span></div>
            <div><span className="block text-[9px] text-slate-300 uppercase">SOC</span><span className="font-mono font-bold text-sm">{livreur.soc}</span></div>
            <div><span className="block text-[9px] text-slate-300 uppercase">Montant enc.</span><span className="font-mono font-bold text-sm">{N(livreur.montant_enc)}</span></div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-200 flex-shrink-0">
          {([
            { id: "colis" as Tab, label: "Colis", icon: Package },
            { id: "expediteurs" as Tab, label: "Par expéditeur", icon: Store },
            { id: "communes" as Tab, label: "Par zone", icon: MapPin },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                tab === id ? "border-[#E8741A] text-[#1B3A5C]" : "border-transparent text-slate-400 hover:text-[#1B3A5C]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "expediteurs" || tab === "communes" ? (
          !snapshotId ? (
            <div className="p-6 flex items-start gap-2 text-slate-600 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p>Le détail ligne par ligne n'a pas été sauvegardé pour cet import (import réalisé avant l'ajout de cette fonctionnalité, ou sauvegarde du détail échouée). Réimportez le fichier pour en bénéficier.</p>
            </div>
          ) : breakdownError ? (
            <div className="p-6 flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{breakdownError}</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 custom-scrollbar relative">
              {breakdownLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-[#E8741A] animate-spin" />
                </div>
              )}
              <BreakdownTable
                rows={breakdownRows}
                groupLabel={tab === "expediteurs" ? "Expéditeur" : "Commune"}
                showWilaya={tab === "communes"}
              />
            </div>
          )
        ) : !snapshotId ? (
          <div className="p-6 flex items-start gap-2 text-slate-600 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p>Le détail ligne par ligne n'a pas été sauvegardé pour cet import (import réalisé avant l'ajout de cette fonctionnalité, ou sauvegarde du détail échouée). Réimportez le fichier pour en bénéficier.</p>
          </div>
        ) : (
          <>
            {/* Filtres de statut + recherche */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0 flex flex-wrap items-center gap-2">
              {(Object.entries(STATUS_FILTERS) as [StatusChip, typeof STATUS_FILTERS[StatusChip]][]).map(([id, s]) => (
                <button
                  key={id}
                  onClick={() => { setStatusChip(id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                    statusChip === id ? "bg-[#1B3A5C] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Tracking, référence, client ou expéditeur..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar relative">
              {rowsLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-[#E8741A] animate-spin" />
                </div>
              )}
              {rowsError ? (
                <div className="p-6 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{rowsError}</p>
                </div>
              ) : rows.length === 0 && !rowsLoading ? (
                <div className="p-6 text-center text-xs text-slate-400">Aucun colis ne correspond.</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Tracking</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Expéditeur</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Client</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Commune</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Statut</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livré le</th>
                      <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono">{r.tracking || "–"}</td>
                        <td className="px-3 py-1.5">{r.expediteur || "–"}</td>
                        <td className="px-3 py-1.5">{r.client || "–"}</td>
                        <td className="px-3 py-1.5">{r.commune || "–"}</td>
                        <td className="px-3 py-1.5">{r.statut || "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.livreLe ? new Date(r.livreLe).toLocaleDateString("fr-DZ") : "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.montant ? N(r.montant) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between flex-shrink-0 text-[11px]">
              <span className="text-slate-500">{N(total)} colis</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-2.5 py-1 rounded-md bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 cursor-pointer"
                  >
                    Précédent
                  </button>
                  <span className="text-slate-500">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-2.5 py-1 rounded-md bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 cursor-pointer"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
