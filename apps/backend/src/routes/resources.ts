import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { ownerOnly } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError, jsonSafe } from "../http.js";

export const resourcesRouter = Router();
const uuid = z.string().uuid();
const productInput = z.object({ id: uuid.optional(), name: z.string().min(1), category: z.string().default(""), unit: z.string().min(1), stock: z.number(), lowStock: z.number(), costMinor: z.coerce.bigint().nonnegative(), priceMinor: z.coerce.bigint().nonnegative() });

resourcesRouter.patch("/account/password", async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
  if (!(await argon2.verify(user.passwordHash, input.currentPassword))) throw new HttpError(401, "Current password is incorrect", "INVALID_CREDENTIALS");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(input.newPassword), mustChangePassword: false } });
  res.status(204).end();
});

resourcesRouter.get("/snapshot", async (req, res) => {
  const shopId = req.auth!.shopId;
  const [shop, products, sales, debts, memberships, conflicts] = await Promise.all([
    prisma.shop.findUniqueOrThrow({ where: { id: shopId }, include: { settings: true } }),
    prisma.product.findMany({ where: { shopId, deletedAt: null } }),
    prisma.sale.findMany({ where: { shopId }, include: { items: true }, orderBy: { createdAt: "asc" } }),
    prisma.debt.findMany({ where: { shopId }, include: { payments: true }, orderBy: { createdAt: "asc" } }),
    prisma.shopMembership.findMany({ where: { shopId }, include: { user: { select: { id: true, name: true, email: true, mustChangePassword: true } } } }),
    prisma.syncConflict.findMany({ where: { shopId, status: "OPEN" }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json(jsonSafe({ shop, products, sales, debts, users: memberships.map((m) => ({ ...m.user, role: m.role })), conflicts, cursor: Date.now().toString() }));
});

resourcesRouter.get("/products", async (req, res) => res.json(jsonSafe(await prisma.product.findMany({ where: { shopId: req.auth!.shopId, deletedAt: null } }))));
resourcesRouter.post("/products", ownerOnly, async (req, res) => {
  const input = productInput.parse(req.body);
  const product = await prisma.product.create({ data: { ...input, id: input.id ?? randomUUID(), shopId: req.auth!.shopId } });
  res.status(201).json(jsonSafe(product));
});
resourcesRouter.patch("/products/:id", ownerOnly, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const input = productInput.partial().extend({ baseVersion: z.number().int() }).parse(req.body);
  const current = await prisma.product.findFirst({ where: { id, shopId: req.auth!.shopId, deletedAt: null } });
  if (!current) throw new HttpError(404, "Product not found", "NOT_FOUND");
  if (current.version !== input.baseVersion) throw new HttpError(409, "Product has changed", "VERSION_CONFLICT");
  const { baseVersion, ...data } = input;
  void baseVersion;
  res.json(jsonSafe(await prisma.product.update({ where: { id }, data: { ...data, version: { increment: 1 } } })));
});
resourcesRouter.delete("/products/:id", ownerOnly, async (req, res) => {
  const id = uuid.parse(req.params.id);
  await prisma.product.updateMany({ where: { id, shopId: req.auth!.shopId, deletedAt: null }, data: { deletedAt: new Date(), version: { increment: 1 } } });
  res.status(204).end();
});

resourcesRouter.get("/staff", ownerOnly, async (req, res) => {
  const rows = await prisma.shopMembership.findMany({ where: { shopId: req.auth!.shopId }, include: { user: { select: { id: true, email: true, name: true, mustChangePassword: true } } } });
  res.json(rows.map((row) => ({ ...row.user, role: row.role })));
});
resourcesRouter.post("/staff", ownerOnly, async (req, res) => {
  const input = z.object({ email: z.string().email().transform((v) => v.toLowerCase()), name: z.string().min(2), temporaryPassword: z.string().min(8) }).parse(req.body);
  const passwordHash = await argon2.hash(input.temporaryPassword);
  const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash, mustChangePassword: true, memberships: { create: { shopId: req.auth!.shopId, role: "STAFF" } } }, select: { id: true, email: true, name: true, mustChangePassword: true } });
  res.status(201).json({ ...user, role: "STAFF" });
});
resourcesRouter.delete("/staff/:id", ownerOnly, async (req, res) => {
  const userId = uuid.parse(req.params.id);
  if (userId === req.auth!.userId) throw new HttpError(400, "Cannot remove yourself", "INVALID_OPERATION");
  await prisma.shopMembership.deleteMany({ where: { shopId: req.auth!.shopId, userId, role: "STAFF" } });
  res.status(204).end();
});

resourcesRouter.get("/conflicts", ownerOnly, async (req, res) => res.json(jsonSafe(await prisma.syncConflict.findMany({ where: { shopId: req.auth!.shopId, status: "OPEN" } }))));
resourcesRouter.post("/conflicts/:id/resolve", ownerOnly, async (req, res) => {
  const id = uuid.parse(req.params.id);
  const resolution = z.object({ choice: z.enum(["server", "submitted"]), merged: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
  const conflict = await prisma.syncConflict.findFirst({ where: { id, shopId: req.auth!.shopId, status: "OPEN" } });
  if (!conflict) throw new HttpError(404, "Conflict not found", "NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    const selected = resolution.merged ?? (resolution.choice === "submitted" ? conflict.submittedPayload : null);
    if (selected && conflict.type === "STALE_EDIT" && conflict.entityType === "product") {
      const payload = selected as Record<string, unknown>;
      await tx.product.update({ where: { id: conflict.entityId }, data: { name: payload.name == null ? undefined : String(payload.name), category: payload.category == null ? undefined : String(payload.category), unit: payload.unit == null ? undefined : String(payload.unit), stock: payload.stock == null ? undefined : Number(payload.stock), lowStock: payload.lowStock == null ? undefined : Number(payload.lowStock), costMinor: payload.cost == null ? undefined : BigInt(Math.round(Number(payload.cost) * 100)), priceMinor: payload.price == null ? undefined : BigInt(Math.round(Number(payload.price) * 100)), version: { increment: 1 } } });
    } else if (selected && conflict.type === "STALE_EDIT" && conflict.entityType === "settings") {
      const payload = selected as Record<string, unknown>;
      if (payload.shopName) await tx.shop.update({ where: { id: req.auth!.shopId }, data: { name: String(payload.shopName) } });
      await tx.shopSettings.update({ where: { shopId: req.auth!.shopId }, data: { address: payload.address == null ? undefined : String(payload.address), phone: payload.phone == null ? undefined : String(payload.phone), version: { increment: 1 } } });
    }
    await tx.syncConflict.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolution: JSON.parse(JSON.stringify(resolution)) } });
  });
  res.status(204).end();
});

const legacyImport = z.object({
  fingerprint: z.string().min(8),
  products: z.array(z.object({ id: z.string(), name: z.string(), category: z.string().default(""), unit: z.string(), stock: z.number(), lowStock: z.number(), cost: z.number(), price: z.number() })),
  sales: z.array(z.record(z.string(), z.unknown())),
  debts: z.array(z.record(z.string(), z.unknown())),
  settings: z.object({ shopName: z.string(), address: z.string(), phone: z.string() }).optional(),
});

resourcesRouter.post("/import/legacy", ownerOnly, async (req, res) => {
  const input = legacyImport.parse(req.body);
  const shopId = req.auth!.shopId;
  const previous = await prisma.importBatch.findUnique({ where: { shopId_fingerprint: { shopId, fingerprint: input.fingerprint } } });
  if (previous) { res.json(jsonSafe({ imported: false, duplicate: true, summary: previous.summary })); return; }
  const productIds = new Map(input.products.map((product) => [product.id, randomUUID()]));
  const saleIds = new Map(input.sales.map((sale) => [String(sale.id), randomUUID()]));
  const summary = await prisma.$transaction(async (tx) => {
    for (const product of input.products) await tx.product.create({ data: { id: productIds.get(product.id)!, shopId, name: product.name, category: product.category, unit: product.unit, stock: product.stock, lowStock: product.lowStock, costMinor: BigInt(Math.round(product.cost * 100)), priceMinor: BigInt(Math.round(product.price * 100)) } });
    let salesImported = 0;
    for (const sale of input.sales) {
      const validItems = ((sale.items as Array<Record<string, unknown>>) ?? []).filter((item) => productIds.has(String(item.productId)));
      if (!validItems.length) continue;
      await tx.sale.create({ data: { id: saleIds.get(String(sale.id))!, shopId, staffId: req.auth!.userId, invoiceNo: `${String(sale.invoiceNo ?? "LEGACY")}-${salesImported + 1}`, occurredAt: new Date(String(sale.date)), paymentType: String(sale.paymentType ?? "cash"), customerName: String(sale.customerName ?? "Walk-in"), customerPhone: String(sale.customerPhone ?? ""), customerAddress: String(sale.customerAddress ?? ""), driver: String(sale.driver ?? ""), car: String(sale.car ?? ""), subtotalMinor: BigInt(Math.round(Number(sale.cartSubtotal ?? 0) * 100)), deliveryFeeMinor: BigInt(Math.round(Number(sale.deliveryFee ?? 0) * 100)), discountMinor: BigInt(Math.round(Number(sale.discount ?? 0) * 100)), totalMinor: BigInt(Math.round(Number(sale.total ?? 0) * 100)), amountPaidMinor: BigInt(Math.round(Number(sale.amountPaid ?? 0) * 100)), balanceMinor: BigInt(Math.round(Number(sale.balance ?? 0) * 100)), items: { create: validItems.map((item) => ({ productId: productIds.get(String(item.productId))!, name: String(item.name), unit: String(item.unit), quantity: Number(item.qty), unitPriceMinor: BigInt(Math.round(Number(item.price) * 100)), subtotalMinor: BigInt(Math.round(Number(item.subtotal) * 100)) })) } } });
      salesImported++;
    }
    let debtsImported = 0;
    for (const debt of input.debts) {
      const saleId = saleIds.get(String(debt.saleId));
      if (!saleId || !(await tx.sale.findUnique({ where: { id: saleId } }))) continue;
      await tx.debt.create({ data: { id: randomUUID(), shopId, saleId, customerName: String(debt.customerName), phone: String(debt.phone ?? ""), originalAmountMinor: BigInt(Math.round(Number(debt.originalAmount) * 100)), balanceMinor: BigInt(Math.round(Number(debt.balance) * 100)), occurredAt: new Date(String(debt.date)) } });
      debtsImported++;
    }
    if (input.settings) { await tx.shop.update({ where: { id: shopId }, data: { name: input.settings.shopName } }); await tx.shopSettings.upsert({ where: { shopId }, create: { shopId, address: input.settings.address, phone: input.settings.phone }, update: { address: input.settings.address, phone: input.settings.phone, version: { increment: 1 } } }); }
    const result = { products: input.products.length, sales: salesImported, debts: debtsImported };
    await tx.importBatch.create({ data: { shopId, fingerprint: input.fingerprint, summary: result } });
    return result;
  });
  res.status(201).json(jsonSafe({ imported: true, duplicate: false, summary }));
});
