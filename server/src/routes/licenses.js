// src/routes/licenses.js — API pública consumida por el cliente Rust
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import db from "../db/init.js";
import { generateSignedPayload } from "../services/licenseService.js";

const router = Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Demasiadas solicitudes, intenta en 15 minutos" },
});
router.use(apiLimiter);

function logAction(licenseId, deviceId, action, result, ip) {
  db.prepare(
    "INSERT INTO validation_log (license_id, device_id, action, result, ip, created_at) VALUES (?,?,?,?,?,?)"
  ).run(licenseId ?? null, deviceId ?? null, action, result, ip ?? null, Date.now());
}

// POST /api/licenses/activate
router.post("/activate", (req, res) => {
  const { licenseKey, deviceId, deviceName, platform, appVersion } = req.body ?? {};
  const ip = req.ip;

  if (!licenseKey || !deviceId) {
    return res.status(400).json({ error: "licenseKey y deviceId son requeridos" });
  }

  const license = db.prepare("SELECT * FROM licenses WHERE key = ?").get(licenseKey);

  if (!license) {
    logAction(null, deviceId, "activate", "NOT_FOUND", ip);
    return res.status(404).json({ error: "Licencia no encontrada" });
  }

  if (license.status !== "ACTIVE") {
    logAction(license.id, deviceId, "activate", license.status, ip);
    return res.status(403).json({ error: `Licencia ${license.status.toLowerCase()}` });
  }

  if (license.expires_at && license.expires_at < Date.now()) {
    db.prepare("UPDATE licenses SET status='EXPIRED', updated_at=? WHERE id=?").run(Date.now(), license.id);
    logAction(license.id, deviceId, "activate", "EXPIRED", ip);
    return res.status(403).json({ error: "Licencia expirada" });
  }

  // Verificar si el dispositivo ya está activado
  const existingDevice = db.prepare(
    "SELECT * FROM devices WHERE license_id=? AND device_id=? AND revoked=0"
  ).get(license.id, deviceId);

  if (!existingDevice) {
    // Verificar límite de dispositivos
    const activeDevices = db.prepare(
      "SELECT COUNT(*) as count FROM devices WHERE license_id=? AND revoked=0"
    ).get(license.id);

    if (activeDevices.count >= license.max_devices) {
      logAction(license.id, deviceId, "activate", "DEVICE_LIMIT", ip);
      return res.status(403).json({ error: `Límite de dispositivos alcanzado (máx. ${license.max_devices})` });
    }

    db.prepare(
      "INSERT INTO devices (id, license_id, device_id, device_name, platform, app_version, activated_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?)"
    ).run(uuidv4(), license.id, deviceId, deviceName ?? null, platform ?? null, appVersion ?? null, Date.now(), Date.now());
  } else {
    db.prepare("UPDATE devices SET last_seen_at=?, app_version=? WHERE id=?")
      .run(Date.now(), appVersion ?? null, existingDevice.id);
  }

  try {
    const { payload, signature } = generateSignedPayload(license, deviceId, license.expires_at);
    logAction(license.id, deviceId, "activate", "OK", ip);
    return res.json({ payload, signature, plan: license.plan });
  } catch (err) {
    console.error("[activate] Error al firmar payload:", err);
    return res.status(500).json({ error: "Error interno al generar payload" });
  }
});

// POST /api/licenses/validate
router.post("/validate", (req, res) => {
  const { licenseId, deviceId } = req.body ?? {};
  const ip = req.ip;

  if (!licenseId || !deviceId) {
    return res.status(400).json({ error: "licenseId y deviceId son requeridos" });
  }

  const license = db.prepare("SELECT * FROM licenses WHERE id=?").get(licenseId);

  if (!license || license.status !== "ACTIVE") {
    logAction(licenseId, deviceId, "validate", "INVALID", ip);
    return res.status(403).json({ status: "INVALID" });
  }

  if (license.expires_at && license.expires_at < Date.now()) {
    logAction(licenseId, deviceId, "validate", "EXPIRED", ip);
    return res.status(403).json({ status: "EXPIRED" });
  }

  const device = db.prepare(
    "SELECT * FROM devices WHERE license_id=? AND device_id=? AND revoked=0"
  ).get(license.id, deviceId);

  if (!device) {
    logAction(licenseId, deviceId, "validate", "DEVICE_NOT_FOUND", ip);
    return res.status(403).json({ status: "DEVICE_NOT_FOUND" });
  }

  db.prepare("UPDATE devices SET last_seen_at=? WHERE id=?").run(Date.now(), device.id);

  try {
    const { payload, signature } = generateSignedPayload(license, deviceId, license.expires_at);
    logAction(licenseId, deviceId, "validate", "OK", ip);
    return res.json({ status: "ACTIVE", payload, signature });
  } catch (err) {
    console.error("[validate] Error al firmar:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
