import { useMemo, useState } from "react";
import { AppData, ExpediteurRecap } from "../types";
import { N, P } from "../utils";
import { Store, Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

interface ExpediteursTabProps {
  data: AppData;
}

type SortField = keyof Pick<ExpediteurRecap, "expediteur" | "dispatches" | "livres" | "taux_livraison" | "taux_retour" | "nbLivreurs" | "nbCommunes">;

export default function ExpediteursTab({ data }: ExpediteursTabProps) {
  const [searchText, setSearchText] = useState("");
  const [sortField, setSortField] = useState<SortField>("dispatches");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (field !== sortField) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const sortedAndFilteredData = useMemo(() => {
    let filtered = data.expediteurs;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(e => e.expediteur.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === "string" && typeof vb === "string") {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [data, searchText, sortField, sortAsc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            📦 Vue réseau par Expéditeur
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Volume et fiabilité de livraison par client expéditeur, tous livreurs confondus</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rechercher un expéditeur..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
          />
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-white/20 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center gap-1.5">
              <Store className="w-4 h-4" />
              {N(sortedAndFilteredData.length)} expéditeur{sortedAndFilteredData.length > 1 ? "s" : ""}
            </h4>
            <p className="text-[11px] text-[#6B7A99] mt-0.5">Repérez les gros volumes et les clients à fort taux de retour (souvent lié à la qualité des adresses fournies)</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
          <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
            <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-center w-12">#</th>
                <th className="px-3 py-2.5 cursor-pointer select-none" onClick={() => handleSort("expediteur")}>
                  Expéditeur {renderSortIndicator("expediteur")}
                </th>
                <th className="px-3 py-2.5 text-right w-28 cursor-pointer select-none" onClick={() => handleSort("dispatches")}>
                  Colis {renderSortIndicator("dispatches")}
                </th>
                <th className="px-3 py-2.5 text-right w-28 text-emerald-400 cursor-pointer select-none" onClick={() => handleSort("livres")}>
                  Livrés {renderSortIndicator("livres")}
                </th>
                <th className="px-3 py-2.5 text-center w-32 cursor-pointer select-none" onClick={() => handleSort("taux_livraison")}>
                  Taux livraison {renderSortIndicator("taux_livraison")}
                </th>
                <th className="px-3 py-2.5 text-center w-28 cursor-pointer select-none" onClick={() => handleSort("taux_retour")}>
                  Taux retour {renderSortIndicator("taux_retour")}
                </th>
                <th className="px-3 py-2.5 text-right w-32 cursor-pointer select-none" onClick={() => handleSort("nbLivreurs")}>
                  Livreurs distincts {renderSortIndicator("nbLivreurs")}
                </th>
                <th className="px-3 py-2.5 text-right w-32 cursor-pointer select-none" onClick={() => handleSort("nbCommunes")}>
                  Communes distinctes {renderSortIndicator("nbCommunes")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F8]">
              {sortedAndFilteredData.map((e, idx) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-[#1B3A5C]">{e.expediteur}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{N(e.dispatches)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{N(e.livres)}</td>
                  <td className={`px-3 py-2.5 text-center font-mono font-bold ${
                    e.taux_livraison >= 80 ? "text-emerald-600" : e.taux_livraison >= 65 ? "text-[#1B3A5C]" : "text-red-600"
                  }`}>{P(e.taux_livraison)}</td>
                  <td className={`px-3 py-2.5 text-center font-mono ${e.taux_retour > 30 ? "text-red-600 font-bold" : e.taux_retour >= 15 ? "text-amber-600" : "text-slate-600"}`}>
                    {P(e.taux_retour)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-650">{N(e.nbLivreurs)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-650">{N(e.nbCommunes)}</td>
                </tr>
              ))}
              {sortedAndFilteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">Aucun expéditeur ne correspond.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
