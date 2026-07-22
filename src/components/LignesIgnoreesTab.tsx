import { useEffect, useState } from "react";
import { AppData } from "../types";
import { N, P } from "../utils";
import { queryRawRows, RawRowsFilter } from "../lib/api";
import { Search, Loader2, AlertCircle, Info, UserX, PackageX } from "lucide-react";

interface LignesIgnoreesTabProps {
  data: AppData;
  snapshotId: string | null;
}

type Bucket = "sans_livreur" | "sans_dispatch";

const PAGE_SIZE = 50;

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LignesIgnoreesTab({ data, snapshotId }: LignesIgnoreesTabProps) {
  const [bucket, setBucket] = useState<Bucket>("sans_livreur");
  const [selectedStatut, setSelectedStatut] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof queryRawRows>>["rows"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const breakdown = bucket === "sans_livreur" ? data.global.statuts_sans_livreur : data.global.statuts_sans_dispatch;
  const bucketTotal = bucket === "sans_livreur" ? data.global.lignes_ignorees_sans_livreur : data.global.lignes_ignorees_sans_dispatch;

  // Réinitialiser le statut sélectionné et la page quand on change de compartiment
  useEffect(() => {
    setSelectedStatut(null);
    setPage(1);
  }, [bucket]);

  useEffect(() => {
    if (!snapshotId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const filter: Omit<RawRowsFilter, "search" | "page" | "pageSize"> =
      bucket === "sans_livreur" ? { noLivreur: true } : { isDispatched: false };
    if (selectedStatut) filter.statut = selectedStatut;

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
    }, search ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [snapshotId, bucket, selectedStatut, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="pb-3 border-b border-[#DDE3EE]/40">
        <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
          🔍 Lignes ignorées à l'import
        </h2>
        <p className="text-[11px] text-[#6B7A99]">
          Détail complet des lignes du fichier importé qui n'entrent pas dans les statistiques du dashboard
        </p>
      </div>

      {/* Résumé de traçabilité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Lignes lues</p>
          <h3 className="text-2xl font-bold font-mono text-[#1B3A5C]">{N(data.global.lignes_fichier)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">Total dans le fichier importé</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Dispatchés comptabilisés</p>
          <h3 className="text-2xl font-bold font-mono text-emerald-600">{N(data.global.total_dispatches)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">Colis avec "Dispatché au livreur le"</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Sans livreur assigné</p>
          <h3 className="text-2xl font-bold font-mono text-amber-600">{N(data.global.lignes_ignorees_sans_livreur)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">
            {data.global.lignes_fichier > 0 ? P((data.global.lignes_ignorees_sans_livreur / data.global.lignes_fichier) * 100) : "0%"} du fichier
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Jamais dispatchées</p>
          <h3 className="text-2xl font-bold font-mono text-orange-600">{N(data.global.lignes_ignorees_sans_dispatch)}</h3>
          <p className="text-[10px] text-slate-500 font-sans">
            {data.global.lignes_fichier > 0 ? P((data.global.lignes_ignorees_sans_dispatch / data.global.lignes_fichier) * 100) : "0%"} du fichier
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-[11px] leading-relaxed flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Une ligne "sans livreur assigné" a une valeur vide dans la colonne Livreur — impossible de savoir qui devait la traiter.
          Une ligne "jamais dispatchée" a un livreur mais aucune date "Dispatché au livreur le" — le colis n'a pas encore été pris en charge sur le terrain (ou l'export a été fait avant sa prise en charge).
        </p>
      </div>

      {/* Sélecteur de compartiment */}
      <div className="flex gap-2">
        <button
          onClick={() => setBucket("sans_livreur")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            bucket === "sans_livreur" ? "bg-[#1B3A5C] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <UserX className="w-3.5 h-3.5" /> Sans livreur assigné ({N(data.global.lignes_ignorees_sans_livreur)})
        </button>
        <button
          onClick={() => setBucket("sans_dispatch")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            bucket === "sans_dispatch" ? "bg-[#1B3A5C] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <PackageX className="w-3.5 h-3.5" /> Jamais dispatchées ({N(data.global.lignes_ignorees_sans_dispatch)})
        </button>
      </div>

      {/* Répartition par statut du compartiment sélectionné */}
      <div className="glass-panel rounded-xl p-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Répartition par statut ECOTRACK</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedStatut(null); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
              selectedStatut === null ? "bg-[#E8741A] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({N(bucketTotal)})
          </button>
          {breakdown.map((s) => (
            <button
              key={s.statut}
              onClick={() => { setSelectedStatut(s.statut); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                selectedStatut === s.statut ? "bg-[#E8741A] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.statut} ({N(s.count)}{bucketTotal > 0 ? ` · ${P((s.count / bucketTotal) * 100)}` : ""})
            </button>
          ))}
        </div>
      </div>

      {/* Détail ligne par ligne, paginé et cherchable */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs font-bold text-[#1B3A5C]">
            {snapshotId ? `${N(total)} ligne(s) correspondante(s)` : "Détail indisponible"}
          </p>
          {snapshotId && (
            <div className="relative sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tracking, référence, client ou expéditeur..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
              />
            </div>
          )}
        </div>

        {!snapshotId ? (
          <div className="p-6 flex items-start gap-2 text-slate-600 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p>Le détail ligne par ligne n'a pas été sauvegardé pour cet import (import réalisé avant l'ajout de cette fonctionnalité, ou sauvegarde du détail échouée). Réimportez le fichier pour en bénéficier.</p>
          </div>
        ) : (
          <>
            <div className="overflow-auto custom-scrollbar relative max-h-[600px]">
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
                <div className="p-6 text-center text-xs text-slate-400">Aucune ligne ne correspond.</div>
              ) : (
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 z-[1]">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Tracking</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Référence</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Client</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Expéditeur</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livreur</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Station</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Wilaya</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Commune</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Type</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Prestation</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Statut</th>
                      <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Montant</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Expédié le</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Dispatché le</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livré le</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Encaissé le</th>
                      <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Retour demandé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono">{r.tracking || "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.reference || "–"}</td>
                        <td className="px-3 py-1.5">{r.client || "–"}</td>
                        <td className="px-3 py-1.5">{r.expediteur || "–"}</td>
                        <td className="px-3 py-1.5">{r.livreur || "–"}</td>
                        <td className="px-3 py-1.5">{r.station || "–"}</td>
                        <td className="px-3 py-1.5">{r.wilaya || "–"}</td>
                        <td className="px-3 py-1.5">{r.commune || "–"}</td>
                        <td className="px-3 py-1.5">{r.type || "–"}</td>
                        <td className="px-3 py-1.5">{r.prestation || "–"}</td>
                        <td className="px-3 py-1.5 font-semibold">{r.statut || "–"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.montant ? N(r.montant) : "–"}</td>
                        <td className="px-3 py-1.5 font-mono">{formatDate(r.expedieLe)}</td>
                        <td className="px-3 py-1.5 font-mono">{formatDate(r.dispatcheLe)}</td>
                        <td className="px-3 py-1.5 font-mono">{formatDate(r.livreLe)}</td>
                        <td className="px-3 py-1.5 font-mono">{formatDate(r.encaisseLe)}</td>
                        <td className="px-3 py-1.5 font-mono">{formatDate(r.retourDemandeLe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
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
      </div>
    </div>
  );
}
