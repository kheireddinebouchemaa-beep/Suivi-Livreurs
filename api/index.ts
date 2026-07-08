import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" })); // les snapshots KPI peuvent être volumineux

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const JWT_SECRET = process.env.JWT_SECRET!;
const SETUP_SECRET = process.env.SETUP_SECRET!; // clé unique pour initialiser/réinitialiser le mot de passe Direction

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Middleware d'authentification ──────────────────────────
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  const token = header.slice(7);
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session invalide ou expirée." });
  }
}

// ── Setup initial du mot de passe Direction ────────────────
// À appeler UNE FOIS après déploiement (Postman/curl), avec SETUP_SECRET.
app.post("/api/auth/setup", async (req, res) => {
  const { setup_secret, password } = req.body;
  if (setup_secret !== SETUP_SECRET) {
    return res.status(403).json({ error: "Clé de configuration invalide." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
  }
  const hash = await bcrypt.hash(password, 12);
  const { error } = await supabase
    .from("direction_access")
    .upsert({ id: 1, password_hash: hash });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, message: "Mot de passe Direction configuré." });
});

// ── Login ───────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Mot de passe requis." });

  const { data, error } = await supabase
    .from("direction_access")
    .select("password_hash")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return res.status(500).json({ error: "Accès Direction non configuré. Contacter l'administrateur." });
  }

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return res.status(401).json({ error: "Mot de passe incorrect." });

  const token = jwt.sign({ role: "direction" }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

// ── Sauvegarder un nouveau snapshot (après import Excel ou sync API) ──
app.post("/api/snapshots", requireAuth, async (req, res) => {
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
app.get("/api/snapshots", requireAuth, async (_req, res) => {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("id, created_at, file_name, source, period_label")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Dernier snapshot complet (chargé au démarrage du dashboard) ──
app.get("/api/snapshots/latest", requireAuth, async (_req, res) => {
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
app.get("/api/snapshots/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Snapshot introuvable." });
  res.json(data);
});

// ── Seuils d'alerte ─────────────────────────────────────────
app.get("/api/thresholds", requireAuth, async (_req, res) => {
  const { data, error } = await supabase.from("alert_thresholds").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/thresholds/:key", requireAuth, async (req, res) => {
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
