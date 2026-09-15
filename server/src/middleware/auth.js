// src/middleware/auth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("[auth] ADVERTENCIA: JWT_SECRET no está configurado en las variables de entorno");
}

export function requireAdmin(req, res, next) {
  const header = req.headers["authorization"] ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET ?? "dev-secret-change-in-production");
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function generateAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET ?? "dev-secret-change-in-production",
    { expiresIn: "8h" }
  );
}
