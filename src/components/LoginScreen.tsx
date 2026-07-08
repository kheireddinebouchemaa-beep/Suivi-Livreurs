import { useState, FormEvent } from "react";
import { motion } from "motion/react";
import { Lock, Loader2, AlertCircle } from "lucide-react";
import { login } from "../lib/api";

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Échec de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1D33] px-4">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 border border-[#DDE3EE]"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#E8741A] flex items-center justify-center shadow-sm mb-3">
            <span className="text-white font-extrabold text-sm font-mono">IM</span>
          </div>
          <h1 className="text-base font-bold text-[#1B3A5C]">Suivi-Livreurs</h1>
          <p className="text-[11px] text-[#6B7A99] mt-1 text-center">
            Accès réservé à la Direction — IMIR Logistics
          </p>
        </div>

        <label className="block text-[11px] font-semibold text-[#1B3A5C] mb-1.5">Mot de passe</label>
        <div className="relative mb-4">
          <Lock className="w-4 h-4 text-[#6B7A99] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#DDE3EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40 focus:border-[#E8741A]"
            placeholder="••••••••"
            autoFocus
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#1B3A5C] hover:bg-[#152d47] disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </motion.form>
    </div>
  );
}
