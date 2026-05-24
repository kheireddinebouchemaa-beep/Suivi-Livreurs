import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Clock, Percent, Coins, Calculator, HelpCircle } from "lucide-react";
import { getScoreRapidite, getScoreEncaissement } from "../utils";

export default function SOCCalculator() {
  const [taux, setTaux] = useState(80);
  const [delaiLiv, setDelaiLiv] = useState(36);
  const [delaiEnc, setDelaiEnc] = useState(60);

  // Prefers reduced motion detection
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Compute points
  const ptsTaux = parseFloat((taux * 0.30).toFixed(1));
  const rawRapidite = getScoreRapidite(delaiLiv);
  const ptsRapidite = parseFloat((rawRapidite * 0.20).toFixed(1));
  const rawEnc = getScoreEncaissement(delaiEnc);
  const ptsEnc = parseFloat((rawEnc * 0.50).toFixed(1));

  const totalExact = ptsTaux + ptsRapidite + ptsEnc;
  const soc = parseFloat(Math.min(100, Math.max(0, totalExact)).toFixed(1));

  // Determine Level and color
  let levelStr = "Faible";
  let badgeColor = "bg-red-500/15 text-red-500 border-red-500/30";
  let textColor = "text-red-500";
  let progressBg = "bg-red-500";
  
  if (soc >= 80) {
    levelStr = "🟢 Excellent";
    badgeColor = "bg-emerald-500/15 text-emerald-600 border-emerald-550/30";
    textColor = "text-emerald-600";
    progressBg = "bg-emerald-500";
  } else if (soc >= 60) {
    levelStr = "🔵 Bon";
    badgeColor = "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
    textColor = "text-indigo-700";
    progressBg = "bg-[#1B3A5C]";
  } else if (soc >= 40) {
    levelStr = "🟠 Moyen";
    badgeColor = "bg-orange-500/15 text-orange-600 border-orange-500/30";
    textColor = "text-orange-600";
    progressBg = "bg-orange-500";
  } else {
    levelStr = "🔴 Faible";
  }

  // Animation variants
  const pulseVariant = {
    animate: {
      scale: prefersReduced ? 1 : [1, 1.02, 1],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
    }
  };

  return (
    <div id="soc-calculator" className="glass-panel p-5 rounded-xl border border-white/20 shadow-xs relative overflow-hidden">
      <div className="mb-4 pb-2 border-b border-[#F0F3F8] flex items-center justify-between">
        <h4 className="font-bold text-[#1B3A5C] text-sm font-sans flex items-center">
          <Calculator className="w-4.5 h-4.5 mr-2 text-indigo-850 text-indigo-750" />
          🧮 Simulateur de Performance Interactive (SOC)
        </h4>
        <span className="text-[10px] text-slate-500 font-mono flex items-center">
          Outil d'aide à la décision
        </span>
      </div>

      <p className="text-[11px] text-slate-600 mb-5 leading-normal">
        Ajustez les sliders ci-dessous pour simuler l'impact opérationnel direct de chaque composante sur le 
        <strong> Score Opérationnel Composite (SOC)</strong> d'un collaborateur livreur.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sliders d'entrée */}
        <div className="lg:col-span-7 space-y-4">
          {/* Taux livraison */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-indigo-750" />
                Taux de Livraison (30%)
              </span>
              <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {taux}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={taux}
              onChange={(e) => setTaux(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#1B3A5C]"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-medium">
              <span>Critique (0%)</span>
              <span>Standard (75%)</span>
              <span>Cible (100%)</span>
            </div>
          </div>

          {/* Délai livraison */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Délai Moyen de Livraison (20%)
              </span>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                {delaiLiv}h
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              value={delaiLiv}
              onChange={(e) => setDelaiLiv(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#E8741A]"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-medium">
              <span>Excellent (≤12h)</span>
              <span>SLA Route (24h)</span>
              <span>Lent (72h+)</span>
            </div>
          </div>

          {/* Délai encaissement */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                Délai d'Encaissement COD (50%)
              </span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                {delaiEnc}h
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              value={delaiEnc}
              onChange={(e) => setDelaiEnc(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-medium">
              <span>Excellent (≤24h)</span>
              <span>Acceptable (72h)</span>
              <span>Critique (96h+)</span>
            </div>
          </div>
        </div>

        {/* Panneau de résultats */}
        <div className="lg:col-span-5 bg-white/40 border border-white/50 rounded-xl p-4 flex flex-col justify-between shadow-3xs backdrop-blur-md">
          <div className="text-center pb-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score Composite Simulé</p>
            
            <motion.div 
              variants={prefersReduced ? {} : pulseVariant}
              animate="animate"
              className="my-3 inline-block"
            >
              <div className="text-4xl font-black font-mono text-[#1B3A5C] tracking-tight">
                {soc} <span className="text-xs text-slate-400">/ 100</span>
              </div>
            </motion.div>

            <div className={`text-xs font-black uppercase px-3 py-1 rounded-full border inline-block ${badgeColor}`}>
              Indice : {levelStr}
            </div>
          </div>

          {/* Barre de répartition de score */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200/50">
            <h5 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Répartition des points :</h5>
            <div className="flex h-3.5 w-full rounded-md overflow-hidden bg-slate-150 border border-white/20">
              <div 
                style={{ width: `${(ptsTaux / soc) * 100 || 0}%` }} 
                className="bg-indigo-600 h-full"
                title={`Taux: ${ptsTaux} points`}
              />
              <div 
                style={{ width: `${(ptsRapidite / soc) * 100 || 0}%` }} 
                className="bg-amber-500 h-full"
                title={`Rapidité: ${ptsRapidite} points`}
              />
              <div 
                style={{ width: `${(ptsEnc / soc) * 100 || 0}%` }} 
                className="bg-emerald-500 h-full"
                title={`Encaissement: ${ptsEnc} points`}
              />
            </div>

            <div className="space-y-1 text-[11px] text-slate-700 font-medium font-sans">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-xs inline-block" />
                  Composante Taux (30%):
                </span>
                <span className="font-mono text-indigo-900 font-bold">{ptsTaux} pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs inline-block" />
                  Composante Rapidité (20%):
                </span>
                <span className="font-mono text-amber-800 font-bold">{ptsRapidite} pts</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs inline-block" />
                  Composante Encaissement (50%):
                </span>
                <span className="font-mono text-emerald-700 font-bold">{ptsEnc} pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-2.5 bg-white/40 rounded-lg border border-white/30 text-[9.5px] text-slate-500 flex items-start gap-1.5">
        <HelpCircle className="w-3.5 h-3.5 text-indigo-750 flex-shrink-0 mt-0.5" />
        <span className="leading-normal">
          <strong>Note pédagogique :</strong> Le délai d'encaissement (COD) pèse pour <strong>50%</strong> de la note globale. Réduire ce délai de 72h à 24h améliore immédiatement le score de plus de 22 points ! C'est le flux financier d'IMIR qu'il faut accélérer.
        </span>
      </div>
    </div>
  );
}
