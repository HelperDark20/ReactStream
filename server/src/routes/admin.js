// src/routes/admin.js — CRUD completo del panel de administración
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import db from "../db/init.js";
import { requireAdmin, generateAdminToken } from "../middleware/auth.js";
import { generateLicenseKey, getPlanFeatures } from "../services/licenseService.js";

const router = Router();

function hashPassword(password) {
  return createHash("sha256").update(password + (process.env.PASSWORD_SALT ?? "rs-salt")).digest("hex");
}

// POST /admin/login
router.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "username y password requeridos" });

  const admin = db.prepare("SELECT * FROM admins WHERE username=?").get(username);
  if (!admin || admin.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  const token = generateAdminToken(admin);
  return res.json({ token, username: admin.username });
});

// POST /admin/setup — solo si no hay admins (primer arranque)
router.post("/setup", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM admins").get().c;
  if (count > 0) return res.status(403).json({ error: "Ya existe un administrador" });
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "username y password requeridos" });

  db.prepare("INSERT INTO admins (id, username, password_hash, created_at) VALUES (?,?,?,?)")
    .run(uuidv4(), username, hashPassword(password), Date.now());
  return res.json({ message: "Administrador creado correctamente" });
});

// Todas las rutas siguientes requieren autenticación
router.use(requireAdmin);

// GET /admin/stats
router.get("/stats", (_req, res) => {
  const total     = db.prepare("SELECT COUNT(*) as c FROM licenses").get().c;
  const active    = db.prepare("SELECT COUNT(*) as c FROM licenses WHERE status='ACTIVE'").get().c;
  const revoked   = db.prepare("SELECT COUNT(*) as c FROM licenses WHERE status='REVOKED'").get().c;
  const devices   = db.prepare("SELECT COUNT(*) as c FROM devices WHERE revoked=0").get().c;
  const today     = db.prepare("SELECT COUNT(*) as c FROM validation_log WHERE created_at > ?").get(Date.now() - 86400000).c;
  const byPlan    = db.prepare("SELECT plan, COUNT(*) as count FROM licenses GROUP BY plan").all();
  return res.json({ total, active, revoked, devices, validationsToday: today, byPlan });
});

// GET /admin/licenses
router.get("/licenses", (req, res) => {
  const { plan, status, q, limit = 50, offset = 0 } = req.query;
  let query = "SELECT * FROM licenses WHERE 1=1";
  const params = [];
  if (plan)   { query += " AND plan=?";           params.push(plan); }
  if (status) { query += " AND status=?";         params.push(status); }
  if (q)      { query += " AND (key LIKE ? OR email LIKE ? OR name LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));
  const licenses = db.prepare(query).all(...params);
  const total = db.prepare("SELECT COUNT(*) as c FROM licenses WHERE 1=1").get().c;
  return res.json({ licenses, total });
});

// POST /admin/licenses — crear nueva licencia
router.post("/licenses", (req, res) => {
  const { plan, email, name, maxDevices = 1, expiresAt, notes } = req.body ?? {};
  if (!plan || !email || !name) return res.status(400).json({ error: "plan, email y name son requeridos" });
  if (!["FREE","PRO","STUDIO"].includes(plan)) return res.status(400).json({ error: "plan inválido" });

  const id  = uuidv4();
  const key = generateLicenseKey();
  const now = Date.now();

  db.prepare(
    "INSERT INTO licenses (id, key, plan, email, name, status, max_devices, expires_at, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).run(id, key, plan, email, name, "ACTIVE", maxDevices, expiresAt ?? null, notes ?? null, now, now);

  const license = db.prepare("SELECT * FROM licenses WHERE id=?").get(id);
  return res.status(201).json({ license, features: getPlanFeatures(plan) });
});

// GET /admin/licenses/:id
router.get("/licenses/:id", (req, res) => {
  const license = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id);
  if (!license) return res.status(404).json({ error: "Licencia no encontrada" });
  const devices = db.prepare("SELECT * FROM devices WHERE license_id=? ORDER BY activated_at DESC").all(license.id);
  const logs    = db.prepare("SELECT * FROM validation_log WHERE license_id=? ORDER BY created_at DESC LIMIT 50").all(license.id);
  return res.json({ license, devices, logs, features: getPlanFeatures(license.plan) });
});

// PATCH /admin/licenses/:id — actualizar licencia
router.patch("/licenses/:id", (req, res) => {
  const { plan, status, maxDevices, expiresAt, notes } = req.body ?? {};
  const license = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id);
  if (!license) return res.status(404).json({ error: "Licencia no encontrada" });

  db.prepare(
    "UPDATE licenses SET plan=?, status=?, max_devices=?, expires_at=?, notes=?, updated_at=? WHERE id=?"
  ).run(
    plan ?? license.plan,
    status ?? license.status,
    maxDevices ?? license.max_devices,
    expiresAt !== undefined ? expiresAt : license.expires_at,
    notes !== undefined ? notes : license.notes,
    Date.now(),
    license.id
  );

  return res.json(db.prepare("SELECT * FROM licenses WHERE id=?").get(license.id));
});

// POST /admin/licenses/:id/revoke
router.post("/licenses/:id/revoke", (req, res) => {
  db.prepare("UPDATE licenses SET status='REVOKED', updated_at=? WHERE id=?").run(Date.now(), req.params.id);
  return res.json({ message: "Licencia revocada" });
});

// POST /admin/devices/:id/revoke — revocar dispositivo específico
router.post("/devices/:id/revoke", (req, res) => {
  db.prepare("UPDATE devices SET revoked=1 WHERE id=?").run(req.params.id);
  return res.json({ message: "Dispositivo revocado" });
});

// GET /admin/logs
router.get("/logs", (req, res) => {
  const { limit = 100 } = req.query;
  const logs = db.prepare("SELECT * FROM validation_log ORDER BY created_at DESC LIMIT ?").all(Number(limit));
  return res.json({ logs });
});

export default router;
