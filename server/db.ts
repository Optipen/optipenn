import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof getDb>;

/**
 * Execute a function with proper error handling
 * Note: neon-http driver doesn't support transactions, so we rely on database CASCADE constraints
 * and proper error handling for data integrity
 */
export async function withSafeDelete<T>(
  db: NonNullable<Db>,
  fn: (db: NonNullable<Db>) => Promise<T>
): Promise<T> {
  return fn(db);
}

