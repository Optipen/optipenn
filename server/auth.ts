import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

const envJwtSecret = process.env.JWT_SECRET;
const JWT_SECRET = envJwtSecret || "dev-secret-change";
const COOKIE_NAME = "crm_token";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

// Validate JWT_SECRET in production
function validateProductionConfig() {
  if (isProduction() && !envJwtSecret) {
    throw new Error("JWT_SECRET manquant en production");
  }
}

// Helper function to get production status
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// Helper function to get cookie base options (dynamic based on current NODE_ENV)
function getCookieBaseOptions() {
  const prodMode = isProduction();
  return { 
    httpOnly: true, 
    sameSite: (prodMode ? "strict" : "lax") as "strict" | "lax", 
    path: "/",
    secure: prodMode
  } as const;
}

// Helper functions for JWT and cookie settings
function getJwtExpiration(): string {
  return isProduction() ? "2h" : "7d";
}

function getCookieMaxAge(): number {
  return isProduction() ? 2 * 3600 * 1000 : 7 * 24 * 3600 * 1000; // 2h in prod, 7d in dev
}

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
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  try {
    const parsed = insertUserSchema.parse(req.body);
    const existing = await storage.getUserByEmail(parsed.email);
    if (existing) {
      // Log failed registration attempt for existing email
      console.warn(`[SECURITY] Registration attempt for existing email: ${parsed.email} from IP: ${clientIP}`);
      return res.status(400).json({ message: "Email déjà utilisé" });
    }
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await storage.createUser({ ...parsed, passwordHash });
    console.info(`[AUTH] New user registered: ${user.email} from IP: ${clientIP}`);
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (e: any) {
    console.warn(`[SECURITY] Failed registration attempt from IP: ${clientIP}, error: ${e.message}`);
    return res.status(400).json({ message: e.message });
  }
}

export async function login(req: Request, res: Response) {
  // Validate production configuration
  validateProductionConfig();
  
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const { email, password } = req.body as { email: string; password: string };
  
  if (!email || !password) {
    console.warn(`[SECURITY] Login attempt with missing credentials from IP: ${clientIP}`);
    return res.status(400).json({ message: "Email et mot de passe requis" });
  }
  
  const user = await storage.getUserByEmail(email);
  if (!user) {
    console.warn(`[SECURITY] Login attempt for non-existent email: ${email} from IP: ${clientIP}`);
    return res.status(401).json({ message: "Identifiants invalides" });
  }
  
  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) {
    console.warn(`[SECURITY] Failed login attempt for email: ${email} from IP: ${clientIP}`);
    return res.status(401).json({ message: "Identifiants invalides" });
  }
  
  // Successful login
  console.info(`[AUTH] Successful login for user: ${email} from IP: ${clientIP}`);
  
  const token = jwt.sign(
    { sub: user.id, role: (user as any).role, name: (user as any).name, email: user.email }, 
    JWT_SECRET, 
    { expiresIn: getJwtExpiration() }
  );
  
  // Set main JWT cookie with hardened security options
  res.cookie(COOKIE_NAME, token, { 
    ...getCookieBaseOptions(), 
    domain: COOKIE_DOMAIN, 
    maxAge: getCookieMaxAge() 
  });
  
  // CSRF cookie (double submit token) - uses same security settings but accessible to JS
  const csrfToken = Buffer.from(`${user.id}:${Date.now()}`).toString("base64url");
  res.cookie("csrf_token", csrfToken, { 
    // DO NOT set httpOnly here; client JS must read it to send X-CSRF-Token
    sameSite: isProduction() ? "strict" : "lax", 
    path: "/", 
    secure: isProduction(), 
    domain: COOKIE_DOMAIN, 
    maxAge: getCookieMaxAge() 
  });
  
  return res.json({ message: "Connecté" });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { 
    ...getCookieBaseOptions(), 
    domain: COOKIE_DOMAIN 
  });
  res.clearCookie("csrf_token", { 
    sameSite: isProduction() ? "strict" : "lax", 
    path: "/", 
    secure: isProduction(), 
    domain: COOKIE_DOMAIN 
  });
  return res.json({ message: "Déconnecté" });
}

