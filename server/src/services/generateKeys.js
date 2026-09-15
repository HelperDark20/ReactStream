// src/services/generateKeys.js
// Corre UNA SOLA VEZ para generar el par de claves RSA.
// La PRIVATE KEY se queda en el servidor (NUNCA en el cliente).
// La PUBLIC KEY se embebe en el binario de ReactStream Desktop.
// Regla #64: la llave privada jamás está en el cliente.

import pkg from 'node-forge';
const { pki } = pkg;
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, "../../keys");
mkdirSync(KEYS_DIR, { recursive: true });

console.log("Generando par de claves RSA 2048...");
const keypair = pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

const privateKeyPem = pki.privateKeyToPem(keypair.privateKey);
const publicKeyPem  = pki.publicKeyToPem(keypair.publicKey);

writeFileSync(join(KEYS_DIR, "private.pem"), privateKeyPem, "utf8");
writeFileSync(join(KEYS_DIR, "public.pem"),  publicKeyPem,  "utf8");

console.log("✅ Claves generadas:");
console.log("   Private key: keys/private.pem  ← NUNCA subas esto a Git");
console.log("   Public key:  keys/public.pem   ← Esta va en el cliente (Rust)");
console.log("\nPublic key para copiar al Core de Rust (core/rust/src/license/):");
console.log("─".repeat(60));
console.log(publicKeyPem);