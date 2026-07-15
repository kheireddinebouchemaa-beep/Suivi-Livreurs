import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Search, Loader2, AlertCircle, X } from "lucide-react";
import { queryRawRows, RawRowsFilter } from "../lib/api";
import { N } from "../utils";

interface DrillDownModalProps {
  snapshotId: string | null;
  title: string;
  filter: Omit<RawRowsFilter, "search" | "page" | "pageSize">;
  onClose: () => void;
}

const PAGE_SIZE = 50;

export default function DrillDownModal({ snapshotId, title, filter, onClose }: DrillDownModalProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof queryRawRows>>["rows"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshotId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => {
      queryRawRows(snapshotId, { ...filter, search, page, pageSize: PAGE_SIZE })
        .then((res) => {
          if (cancelled) return;
          setRows(res.rows);
          setTotal(res.total);
        })
        .catch((err: any) => {
          if (cancelled) return;
          setError(err?.message || "Erreur lors du chargement.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 300 : 0); // léger anti-rebond sur la recherche texte
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, search, page, JSON.stringify(filter)]);

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
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="bg-[#1B3A5C] text-white px-4 py-3 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="font-bold text-sm">{title}</h3>
            <p className="text-[10px] text-slate-300">{snapshotId ? `${N(total)} colis correspondants` : "Détail indisponible"}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!snapshotId ? (
          <div className="p-6 flex items-start gap-2 text-slate-600 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p>Le détail ligne par ligne n'a pas été sauvegardé pour cet import (import réalisé avant l'ajout de cette fonctionnalité, ou sauvegarde du détail échouée). Réimportez le fichier pour en bénéficier.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Rechercher par tracking, référence ou client..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar relative">
              {loading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-[#E8741A] animate-spin" />
                </div>
              )}
              {error ? (
                <div className="p-6 flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              ) : rows.length === 0 && !loading ? (
                <div className="p-6 text-center text-xs text-slate-400">Aucun colis ne correspond.</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Tracking</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Client</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livreur</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Station</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Statut</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livré le</th>
                      <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono">{r.tracking || "–"}</td>
                        <td className="px-3 py-1.5">{r.client || "–"}</td>
                        <td className="px-3 py-1.5">{r.livreur || "–"}</td>
                        <td className="px-3 py-1.5">{r.station || "–"}</td>
                        <td className="px-3 py-1.5">{r.statut || "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.livreLe ? new Date(r.livreLe).toLocaleDateString("fr-DZ") : "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.montant ? N(r.montant) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between flex-shrink-0 text-[11px]">
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
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
