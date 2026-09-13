import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;
const pgPool =
  connectionString
    ? globalForPrisma.pgPool ??
      new Pool({
        connectionString,
        max: Number(process.env.DB_POOL_MAX ?? 1),
        idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 1000),
        connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 10000)
      })
    : undefined;

const adapter = pgPool ? new PrismaPg(pgPool) : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pgPool;
}
