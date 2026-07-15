import { useMemo, useState } from "react";
import { AppData, ZoneRecap } from "../types";
import { N, P } from "../utils";
import { MapPin, Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

interface ZonesTabProps {
  data: AppData;
}

type SortField = keyof Pick<ZoneRecap, "commune" | "wilaya" | "dispatches" | "taux_livraison" | "taux_retour">;

const RISQUE_CONFIG: Record<ZoneRecap["niveauRisque"], { label: string; className: string }> = {
  faible: { label: "Faible", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  moyen: { label: "Moyen", className: "bg-amber-50 text-amber-700 border-amber-200" },
  eleve: { label: "Élevé", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function ZonesTab({ data }: ZonesTabProps) {
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
    let filtered = data.zones;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(z => z.commune.toLowerCase().includes(q) || z.wilaya.toLowerCase().includes(q));
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

  const nbZonesRisque = data.zones.filter(z => z.niveauRisque === "eleve").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#DDE3EE]/40 gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight uppercase text-[#1B3A5C] flex items-center gap-1.5">
            🗺️ Vue géographique par Zone
          </h2>
          <p className="text-[11px] text-[#6B7A99]">Communes structurellement problématiques, indépendamment du livreur assigné</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rechercher une commune ou wilaya..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40"
          />
        </div>
      </div>

      {nbZonesRisque > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs font-medium">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          {nbZonesRisque} zone{nbZonesRisque > 1 ? "s" : ""} à risque élevé (taux de retour &gt; 30%)
        </div>
      )}

      <div className="glass-panel p-5 rounded-xl">
        <div className="mb-4 pb-2 border-b border-white/20">
          <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            {N(sortedAndFilteredData.length)} zone{sortedAndFilteredData.length > 1 ? "s" : ""}
          </h4>
          <p className="text-[11px] text-[#6B7A99] mt-0.5">Risque : faible &lt;15% de retour, moyen 15-30%, élevé &gt;30%</p>
        </div>

        <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
          <table className="w-full text-left text-xs font-sans text-slate-700 font-medium">
            <thead className="bg-[#1B3A5C]/85 backdrop-blur-md text-white font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-center w-12">#</th>
                <th className="px-3 py-2.5 cursor-pointer select-none" onClick={() => handleSort("commune")}>
                  Commune {renderSortIndicator("commune")}
                </th>
                <th className="px-3 py-2.5 cursor-pointer select-none" onClick={() => handleSort("wilaya")}>
                  Wilaya {renderSortIndicator("wilaya")}
                </th>
                <th className="px-3 py-2.5 text-right w-24 cursor-pointer select-none" onClick={() => handleSort("dispatches")}>
                  Colis {renderSortIndicator("dispatches")}
                </th>
                <th className="px-3 py-2.5 text-center w-32 cursor-pointer select-none" onClick={() => handleSort("taux_livraison")}>
                  Taux livraison {renderSortIndicator("taux_livraison")}
                </th>
                <th className="px-3 py-2.5 text-center w-28 cursor-pointer select-none" onClick={() => handleSort("taux_retour")}>
                  Taux retour {renderSortIndicator("taux_retour")}
                </th>
                <th className="px-3 py-2.5 text-center w-28">Risque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F3F8]">
              {sortedAndFilteredData.map((z, idx) => (
                <tr key={z.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-[#1B3A5C]">{z.commune}</td>
                  <td className="px-3 py-2.5 text-slate-600">{z.wilaya}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{N(z.dispatches)}</td>
                  <td className={`px-3 py-2.5 text-center font-mono font-bold ${
                    z.taux_livraison >= 80 ? "text-emerald-600" : z.taux_livraison >= 65 ? "text-[#1B3A5C]" : "text-red-600"
                  }`}>{P(z.taux_livraison)}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{P(z.taux_retour)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${RISQUE_CONFIG[z.niveauRisque].className}`}>
                      {RISQUE_CONFIG[z.niveauRisque].label}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedAndFilteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Aucune zone ne correspond.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
