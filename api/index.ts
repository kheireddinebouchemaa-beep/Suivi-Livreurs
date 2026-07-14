import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
// Le frontend appelle l'API en même origine (rewrite Vercel /api/*) : pas besoin d'ouvrir le CORS à d'autres sites.
app.use(cors({ origin: false }));
app.use(express.json({ limit: "15mb" })); // les snapshots KPI peuvent être volumineux

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Sauvegarder un nouveau snapshot (après import Excel ou sync API) ──
app.post("/api/snapshots", async (req, res) => {
  const { file_name, source, period_label, data } = req.body;
  if (!file_name || !data) {
    return res.status(400).json({ error: "file_name et data sont requis." });
  }
  const { data: inserted, error } = await supabase
    .from("kpi_snapshots")
    .insert({
      file_name,
      source: source === "api" ? "api" : "import",
      period_label: period_label || null,
      data,
    })
    .select("id, created_at, file_name, source, period_label")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(inserted);
});

// ── Liste des snapshots (historique, sans le payload complet) ──
app.get("/api/snapshots", async (_req, res) => {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("id, created_at, file_name, source, period_label")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Dernier snapshot complet (chargé au démarrage du dashboard) ──
app.get("/api/snapshots/latest", async (_req, res) => {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Aucun snapshot enregistré." });
  res.json(data);
});

// ── Snapshot précis par ID (pour comparer des périodes) ──
app.get("/api/snapshots/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Snapshot introuvable." });
  res.json(data);
});

// ── Seuils d'alerte ─────────────────────────────────────────
app.get("/api/thresholds", async (_req, res) => {
  const { data, error } = await supabase.from("alert_thresholds").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/thresholds/:key", async (req, res) => {
  const { value } = req.body;
  if (typeof value !== "number") return res.status(400).json({ error: "value doit être un nombre." });

  const { data, error } = await supabase
    .from("alert_thresholds")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default app;
