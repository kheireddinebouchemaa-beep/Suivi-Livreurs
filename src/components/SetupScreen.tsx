import { useState, FormEvent } from "react";
import { Lock, Key, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function SetupScreen() {
  const [setupSecret, setSetupSecret] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_secret: setupSecret, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ ok: true, message: "Mot de passe Direction créé avec succès. Tu peux te connecter sur la page d'accueil." });
      } else {
        setResult({ ok: false, message: `Statut ${res.status} : ${data.error || "erreur inconnue."}` });
      }
    } catch (err: any) {
      setResult({ ok: false, message: "Erreur réseau : " + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1D33] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 border border-[#DDE3EE]"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#E8741A] flex items-center justify-center shadow-sm mb-3">
            <span className="text-white font-extrabold text-sm font-mono">IM</span>
          </div>
          <h1 className="text-base font-bold text-[#1B3A5C]">Configuration Direction</h1>
          <p className="text-[11px] text-[#6B7A99] mt-1 text-center">
            À faire une seule fois — Suivi-Livreurs
          </p>
        </div>

        <label className="block text-[11px] font-semibold text-[#1B3A5C] mb-1.5">Clé de configuration</label>
        <div className="relative mb-4">
          <Key className="w-4 h-4 text-[#6B7A99] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={setupSecret}
            onChange={(e) => setSetupSecret(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#DDE3EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40 focus:border-[#E8741A]"
            placeholder="SETUP_SECRET"
            required
          />
        </div>

        <label className="block text-[11px] font-semibold text-[#1B3A5C] mb-1.5">Nouveau mot de passe Direction</label>
        <div className="relative mb-4">
          <Lock className="w-4 h-4 text-[#6B7A99] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#DDE3EE] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8741A]/40 focus:border-[#E8741A]"
            placeholder="8 caractères minimum"
            required
          />
        </div>

        {result && (
          <div
            className={`flex items-center gap-1.5 text-[11px] rounded-lg px-3 py-2 mb-4 border ${
              result.ok
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#1B3A5C] hover:bg-[#152d47] disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Envoi..." : "Créer le mot de passe"}
        </button>
      </form>
    </div>
  );
}
