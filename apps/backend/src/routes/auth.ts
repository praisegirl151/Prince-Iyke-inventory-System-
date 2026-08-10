import { createHash } from "node:crypto";
import argon2 from "argon2";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { createRefreshToken, refreshCookie, signAccessToken } from "../auth.js";
import { env } from "../config.js";
import { prisma } from "../db.js";
import { HttpError } from "../http.js";

export const authRouter = Router();
const credentials = z.object({ email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(8) });

authRouter.post("/register", async (req, res) => {
  const input = credentials.extend({ name: z.string().min(2), shopName: z.string().min(2) }).parse(req.body);
  const passwordHash = await argon2.hash(input.password);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
    const shop = await tx.shop.create({ data: { name: input.shopName, settings: { create: {} }, memberships: { create: { userId: user.id, role: "OWNER" } } } });
    return { user, shop };
  });
  const auth = { userId: result.user.id, shopId: result.shop.id, role: "OWNER" as const };
  res.cookie("refreshToken", await createRefreshToken(result.user.id), refreshCookie).status(201).json({ accessToken: signAccessToken(auth), user: { id: result.user.id, email: result.user.email, name: result.user.name, role: auth.role }, shop: result.shop });
});

authRouter.post("/login", async (req, res) => {
  const input = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { memberships: { include: { shop: true } } } });
  if (!user || !(await argon2.verify(user.passwordHash, input.password))) throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  const membership = user.memberships[0];
  if (!membership) throw new HttpError(403, "No shop membership", "FORBIDDEN");
  const auth = { userId: user.id, shopId: membership.shopId, role: membership.role };
  res.cookie("refreshToken", await createRefreshToken(user.id), refreshCookie).json({ accessToken: signAccessToken(auth), user: { id: user.id, email: user.email, name: user.name, role: membership.role, mustChangePassword: user.mustChangePassword }, shop: membership.shop });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken as string | undefined;
  if (!token) throw new HttpError(401, "Refresh token required", "UNAUTHORIZED");
  try {
    const payload = z.object({ sub: z.string().uuid(), sid: z.string().uuid(), type: z.literal("refresh") }).parse(jwt.verify(token, env.JWT_REFRESH_SECRET));
    const session = await prisma.refreshSession.findUnique({ where: { id: payload.sid }, include: { user: { include: { memberships: true } } } });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!session || session.tokenHash !== tokenHash || session.revokedAt || session.expiresAt < new Date()) throw new Error();
    await prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const membership = session.user.memberships[0];
    if (!membership) throw new Error();
    const auth = { userId: session.user.id, shopId: membership.shopId, role: membership.role };
    res.cookie("refreshToken", await createRefreshToken(session.user.id), refreshCookie).json({ accessToken: signAccessToken(auth) });
  } catch { throw new HttpError(401, "Invalid refresh token", "UNAUTHORIZED"); }
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies.refreshToken as string | undefined;
  if (token) await prisma.refreshSession.updateMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie("refreshToken", refreshCookie).status(204).end();
});
