import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";
const envJwtSecret = process.env.JWT_SECRET;
if (isProduction && !envJwtSecret) {
  throw new Error("JWT_SECRET manquant en production");
}
const JWT_SECRET = envJwtSecret || "dev-secret-change";
const COOKIE_NAME = "crm_token";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const COOKIE_BASE_OPTIONS = { httpOnly: true as const, sameSite: "lax" as const, path: "/" };

export function requireAuth(roles?: Array<"admin" | "manager" | "sales">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = (req.cookies && req.cookies[COOKIE_NAME]) || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
    if (!token) return res.status(401).json({ message: "Non authentifié" });
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string; name: string; email: string };
      (req as any).user = payload;
      if (roles && roles.length > 0 && !roles.includes(payload.role as any)) {
        return res.status(403).json({ message: "Accès interdit" });
      }
      next();
    } catch {
      return res.status(401).json({ message: "Token invalide" });
    }
  };
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = insertUserSchema.parse(req.body);
    const existing = await storage.getUserByEmail(parsed.email);
    if (existing) return res.status(400).json({ message: "Email déjà utilisé" });
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await storage.createUser({ ...parsed, passwordHash });
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis" });
  const user = await storage.getUserByEmail(email);
  if (!user) return res.status(401).json({ message: "Identifiants invalides" });
  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) return res.status(401).json({ message: "Identifiants invalides" });
  const token = jwt.sign({ sub: user.id, role: (user as any).role, name: (user as any).name, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, { 
    ...COOKIE_BASE_OPTIONS, 
    secure: isProduction, 
    domain: COOKIE_DOMAIN, 
    maxAge: 7 * 24 * 3600 * 1000 
  });
  // CSRF cookie (double submit token)
  const csrfToken = Buffer.from(`${user.id}:${Date.now()}`).toString("base64url");
  res.cookie("csrf_token", csrfToken, { 
    // DO NOT set httpOnly here; client JS must read it to send X-CSRF-Token
    sameSite: "lax", path: "/", secure: isProduction, domain: COOKIE_DOMAIN, maxAge: 7 * 24 * 3600 * 1000 
  });
  return res.json({ message: "Connecté" });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { 
    ...COOKIE_BASE_OPTIONS, 
    secure: isProduction, 
    domain: COOKIE_DOMAIN 
  });
  res.clearCookie("csrf_token", { sameSite: "lax", path: "/", secure: isProduction, domain: COOKIE_DOMAIN });
  return res.json({ message: "Déconnecté" });
}

