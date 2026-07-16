import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { LivreurRecap } from "../types";
import { N, F } from "../utils";

interface LivreursActifsModalProps {
  livreurs: LivreurRecap[];
  onClose: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Livreur "silencieux" : aucune activité connue depuis plus de 7 jours, à surveiller.
const INACTIVITY_ALERT_DAYS = 7;

export default function LivreursActifsModal({ livreurs, onClose }: LivreursActifsModalProps) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    return [...livreurs].sort((a, b) => {
      const ta = a.derniere_activite ? new Date(a.derniere_activite).getTime() : 0;
      const tb = b.derniere_activite ? new Date(b.derniere_activite).getTime() : 0;
      return tb - ta; // plus récent d'abord
    });
  }, [livreurs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(l => l.livreur.toLowerCase().includes(q) || l.station.toLowerCase().includes(q));
  }, [sorted, search]);

  const now = Date.now();

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
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="bg-[#1B3A5C] text-white px-4 py-3 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm">Livreurs actifs ({N(livreurs.length)})</h3>
              <p className="text-[10px] text-slate-300">Triés par dernière activité (le plus récent en premier)</p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un livreur ou une station..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Aucun livreur ne correspond.</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Livreur</th>
                  <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Station</th>
                  <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Dispatchés</th>
                  <th className="text-right px-3 py-2 font-bold text-[#1B3A5C]">Taux livr.</th>
                  <th className="text-left px-3 py-2 font-bold text-[#1B3A5C]">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const activityMs = l.derniere_activite ? new Date(l.derniere_activite).getTime() : 0;
                  const daysSince = activityMs > 0 ? (now - activityMs) / (1000 * 60 * 60 * 24) : Infinity;
                  const stale = daysSince > INACTIVITY_ALERT_DAYS;
                  return (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-semibold text-[#1B3A5C]">{l.livreur}</td>
                      <td className="px-3 py-1.5 text-slate-600">{l.station}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{N(l.dispatches)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{F(l.taux_livraison)}%</td>
                      <td className={`px-3 py-1.5 font-mono ${stale ? "text-amber-600 font-bold" : "text-slate-600"}`}>
                        {formatDate(l.derniere_activite)}
                        {stale && <span className="ml-1.5 text-[9px] uppercase font-sans">Inactif</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
