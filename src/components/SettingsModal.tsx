import { useState } from "react";
import { motion } from "motion/react";
import { X, Settings, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Threshold, updateThreshold } from "../lib/api";

interface SettingsModalProps {
  thresholds: Threshold[];
  onClose: () => void;
  onSaved: (updated: Threshold[]) => void;
}

// Bornes de saisie raisonnables par seuil, pour éviter les valeurs absurdes
const LIMITS: Record<string, { min: number; max: number; unit: string; hint: string }> = {
  taux_livraison_min: { min: 0, max: 100, unit: "%", hint: "Alerte si le taux de livraison d'un livreur passe SOUS cette valeur." },
  soc_min: { min: 0, max: 100, unit: "pts", hint: "Alerte si le Score Opérationnel Composite passe SOUS cette valeur." },
  taux_retour_max: { min: 0, max: 100, unit: "%", hint: "Alerte si le taux de retour DÉPASSE cette valeur." },
  delai_enc_max_h: { min: 0, max: 999, unit: "h", hint: "Alerte si le délai moyen d'encaissement DÉPASSE cette valeur." },
};

export default function SettingsModal({ thresholds, onClose, onSaved }: SettingsModalProps) {
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    thresholds.forEach((t) => (v[t.key] = String(t.value)));
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const updated: Threshold[] = [];
      for (const t of thresholds) {
        const raw = values[t.key];
        const num = parseFloat(raw);
        const limits = LIMITS[t.key];
        if (isNaN(num) || (limits && (num < limits.min || num > limits.max))) {
          throw new Error(`Valeur invalide pour « ${t.label} »${limits ? ` (entre ${limits.min} et ${limits.max})` : ""}.`);
        }
        if (num !== t.value) {
          updated.push(await updateThreshold(t.key, num));
        } else {
          updated.push(t);
        }
      }
      onSaved(updated);
      setSaved(true);
      setTimeout(onClose, 700);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[#1B3A5C]/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={prefersReduced ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 12 }}
        animate={prefersReduced ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
        transition={prefersReduced ? { duration: 0.15 } : { duration: 0.25, ease: "easeOut" }}
        className="bg-white/90 backdrop-blur-xl rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/30 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-[#1B3A5C]/90 text-white p-4 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-sm font-sans">Réglages des seuils d'alerte</h3>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-55"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {thresholds.map((t) => {
            const limits = LIMITS[t.key];
            return (
              <div key={t.key}>
                <label className="text-xs font-bold text-[#1B3A5C] block mb-1">{t.label}</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={values[t.key] ?? ""}
                    min={limits?.min}
                    max={limits?.max}
                    onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
                    className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-[#1B3A5C] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8741A]/50"
                  />
                  {limits && <span className="text-xs font-bold text-slate-500">{limits.unit}</span>}
                </div>
                {limits && <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{limits.hint}</p>}
              </div>
            );
          })}

          {error && (
            <div className="p-3 bg-red-50 flex items-start text-red-800 rounded-lg space-x-2 border border-red-100">
              <AlertCircle className="w-4 h-4 text-[#D93025] flex-shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">{error}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full py-2 bg-[#1B3A5C] hover:bg-[#15304d] text-white font-bold text-xs rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Enregistré !</span>
              </>
            ) : (
              <span>Enregistrer les seuils</span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
