import { createHash, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "./config.js";
import { HttpError } from "./http.js";
import { prisma } from "./db.js";

export interface AuthContext {
  userId: string;
  shopId: string;
  role: "OWNER" | "STAFF";
}

declare global {
  // Express request augmentation is the canonical middleware typing pattern.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { auth?: AuthContext }
  }
}

const accessSchema = z.object({
  sub: z.string().uuid(),
  shopId: z.string().uuid(),
  role: z.enum(["OWNER", "STAFF"]),
  type: z.literal("access"),
});

export function signAccessToken(auth: AuthContext) {
  return jwt.sign(
    { shopId: auth.shopId, role: auth.role, type: "access" },
    env.JWT_ACCESS_SECRET,
    { subject: auth.userId, expiresIn: "15m" },
  );
}

export async function createRefreshToken(userId: string) {
  const sessionId = randomUUID();
  const secret = randomUUID() + randomUUID();
  const token = jwt.sign({ sid: sessionId, secret, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: "30d",
  });
  await prisma.refreshSession.create({ data: {
    id: sessionId,
    userId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }});
  return token;
}

export const refreshCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/v1/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Authentication required", "UNAUTHORIZED");
    const payload = accessSchema.parse(jwt.verify(token, env.JWT_ACCESS_SECRET));
    req.auth = { userId: payload.sub, shopId: payload.shopId, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired access token", "UNAUTHORIZED"));
  }
}

export function ownerOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== "OWNER") return next(new HttpError(403, "Owner access required", "FORBIDDEN"));
  next();
}
