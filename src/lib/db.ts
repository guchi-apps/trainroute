import { PrismaClient } from "@prisma/client";

/**
 * Prisma クライアント。
 *
 * 開発中は Next.js のホットリロードでモジュールが読み直されるため、
 * グローバルへ退避しないと接続が積み上がって MariaDB の上限に当たる。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
