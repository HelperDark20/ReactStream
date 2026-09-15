// src/services/licenseService.js
import pkg from 'node-forge';
const { pki, md, util } = pkg;
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR  = join(__dirname, "../../keys");

// Cargar private key del servidor
let privateKey = null;
const PRIVATE_KEY_PATH = join(KEYS_DIR, "private.pem");
if (existsSync(PRIVATE_KEY_PATH)) {
  privateKey = pki.privateKeyFromPem(readFileSync(PRIVATE_KEY_PATH, "utf8"));
}

/** Features disponibles por plan */
const PLAN_FEATURES = {
  FREE: {
    max_automations: 3,
    overlays: true,
    sounds: true,
    simulation: false,
    history: false,
    priority_support: false,
  },
  PRO: {
    max_automations: -1, // ilimitado
    overlays: true,
    sounds: true,
    simulation: true,
    history: true,
    priority_support: false,
  },
  STUDIO: {
    max_automations: -1,
    overlays: true,
    sounds: true,
    simulation: true,
    history: true,
    priority_support: true,
  },
};

/**
 * Genera un payload de licencia firmado con RSA-SHA256.
 * Regla #65: licencias usan payload firmado.
 * Regla #64: la llave privada nunca sale del servidor.
 */
export function generateSignedPayload(license, deviceId, expiresAt) {
  if (!privateKey) throw new Error("Private key no cargada — corre 'npm run generate-keys' primero");

  const payload = {
    licenseId: license.id,
    deviceId,
    plan: license.plan,
    features: PLAN_FEATURES[license.plan] ?? PLAN_FEATURES.FREE,
    issuedAt: Date.now(),
    expiresAt: expiresAt ?? (Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días por defecto
  };

  const payloadStr = JSON.stringify(payload);
  const digest = md.sha256.create();
  digest.update(payloadStr, "utf8");
  const signature = util.encode64(privateKey.sign(digest));

  return { payload, signature, raw: payloadStr };
}

export function generateLicenseKey() {
  // Formato: RS-XXXX-XXXX-XXXX-XXXX (RS = ReactStream)
  const seg = () => uuidv4().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `RS-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export function getPlanFeatures(plan) {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.FREE;
}