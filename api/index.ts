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

// ── Lignes brutes de l'import (détail permanent, ligne par ligne) ──
// Alimentées par lots depuis le Web Worker d'import juste après la création du snapshot
// (un import de 545k lignes tient en ~110 lots de 5000, chacun bien sous la limite de
// taille de requête). Permet un vrai drill-down filtré/paginé côté serveur, y compris
// après rechargement de la page.
app.post("/api/snapshots/:id/raw-rows", async (req, res) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows (tableau non vide) est requis." });
  }

  const toInsert = rows.map((r) => ({
    snapshot_id: req.params.id,
    tracking: r.tracking || null,
    reference: r.reference || null,
    client: r.client || null,
    livreur: r.livreur || null,
    station: r.station || null,
    wilaya: r.wilaya || null,
    commune: r.commune || null,
    montant: r.montant ?? null,
    statut: r.statut || null,
    type: r.type || null,
    prestation: r.prestation || null,
    expedie_le: r.expedieLe || null,
    dispatche_le: r.dispatcheLe || null,
    livre_le: r.livreLe || null,
    encaisse_le: r.encaisseLe || null,
    retour_demande_le: r.retourDemandeLe || null,
    is_dispatched: !!r.isDispatched,
    is_livre: !!r.isLivre,
    is_retour: !!r.isRetour,
  }));

  const { error } = await supabase.from("snapshot_rows").insert(toInsert);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ inserted: toInsert.length });
});

app.get("/api/snapshots/:id/raw-rows", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || "50"), 10) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("snapshot_rows")
    .select(
      "tracking, reference, client, livreur, station, wilaya, commune, montant, statut, type, prestation, expedie_le, dispatche_le, livre_le, encaisse_le, retour_demande_le, is_dispatched, is_livre, is_retour",
      { count: "exact" }
    )
    .eq("snapshot_id", req.params.id);

  if (req.query.livreur) query = query.eq("livreur", String(req.query.livreur));
  if (req.query.station) query = query.eq("station", String(req.query.station));
  if (req.query.statut) query = query.eq("statut", String(req.query.statut));
  if (req.query.isDispatched !== undefined) query = query.eq("is_dispatched", req.query.isDispatched === "true");
  if (req.query.isLivre !== undefined) query = query.eq("is_livre", req.query.isLivre === "true");
  if (req.query.isRetour !== undefined) query = query.eq("is_retour", req.query.isRetour === "true");
  if (req.query.search) {
    const term = String(req.query.search).replace(/[%_,()]/g, "");
    query = query.or(`tracking.ilike.%${term}%,reference.ilike.%${term}%,client.ilike.%${term}%`);
  }

  const { data, error, count } = await query.order("id", { ascending: true }).range(from, to);
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    rows: (data || []).map((r) => ({
      tracking: r.tracking,
      reference: r.reference,
      client: r.client,
      livreur: r.livreur,
      station: r.station,
      wilaya: r.wilaya,
      commune: r.commune,
      montant: r.montant,
      statut: r.statut,
      type: r.type,
      prestation: r.prestation,
      expedieLe: r.expedie_le,
      dispatcheLe: r.dispatche_le,
      livreLe: r.livre_le,
      encaisseLe: r.encaisse_le,
      retourDemandeLe: r.retour_demande_le,
      isDispatched: r.is_dispatched,
      isLivre: r.is_livre,
      isRetour: r.is_retour,
    })),
    total: count || 0,
    page,
    pageSize,
  });
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
