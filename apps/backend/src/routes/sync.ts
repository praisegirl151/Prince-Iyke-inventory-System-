import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { jsonSafe } from "../http.js";
import { toJsonValue, toMinorUnits } from "../money.js";

export const syncRouter = Router();
const operationSchema = z.object({
  operationId: z.string().uuid(), deviceId: z.string().min(1),
  entityType: z.enum(["product", "sale", "debtPayment", "settings"]), entityId: z.string().uuid(),
  baseVersion: z.number().int().nullable().optional(), kind: z.enum(["CREATE", "UPDATE", "DELETE", "SALE", "DEBT_PAYMENT"]),
  payload: z.record(z.string(), z.unknown()), clientTime: z.string().datetime(),
});
const pushSchema = z.object({ operations: z.array(operationSchema).max(100) });

const money = toMinorUnits;
const toJson = toJsonValue;

syncRouter.post("/push", async (req, res) => {
  const { operations } = pushSchema.parse(req.body);
  const auth = req.auth!;
  const results = [];
  for (const op of operations) {
    const existing = await prisma.syncOperation.findUnique({ where: { id: op.operationId } });
    if (existing) { results.push({ operationId: op.operationId, status: existing.status, error: existing.error }); continue; }
    let status: "APPLIED" | "CONFLICT" | "REJECTED" = "APPLIED";
    let error: string | null = null;
    try {
      await prisma.$transaction(async (tx) => {
        if (op.entityType === "product") {
          const p = op.payload;
          const current = await tx.product.findFirst({ where: { id: op.entityId, shopId: auth.shopId } });
          if (op.kind === "CREATE" && !current) {
            await tx.product.create({ data: { id: op.entityId, shopId: auth.shopId, name: String(p.name), category: String(p.category ?? ""), unit: String(p.unit), stock: Number(p.stock ?? 0), lowStock: Number(p.lowStock ?? 0), costMinor: money(p.cost), priceMinor: money(p.price) } });
          } else if (current && op.kind === "DELETE") {
            await tx.product.update({ where: { id: current.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
          } else if (current && op.kind === "UPDATE") {
            if (op.baseVersion != null && current.version !== op.baseVersion) {
              status = "CONFLICT";
              await tx.syncConflict.create({ data: { shopId: auth.shopId, operationId: op.operationId, type: "STALE_EDIT", entityType: "product", entityId: op.entityId, serverPayload: toJson(current), submittedPayload: toJson(p) } });
            } else await tx.product.update({ where: { id: current.id }, data: { name: p.name == null ? undefined : String(p.name), category: p.category == null ? undefined : String(p.category), unit: p.unit == null ? undefined : String(p.unit), stock: p.stock == null ? undefined : Number(p.stock), lowStock: p.lowStock == null ? undefined : Number(p.lowStock), costMinor: p.cost == null ? undefined : money(p.cost), priceMinor: p.price == null ? undefined : money(p.price), version: { increment: 1 } } });
          }
        } else if (op.entityType === "sale" && op.kind === "SALE") {
          const p = op.payload;
          const items = z.array(z.object({ productId: z.string().uuid(), name: z.string(), unit: z.string(), qty: z.number().positive(), price: z.number().nonnegative(), subtotal: z.number().nonnegative() })).parse(p.items);
          const requestedInvoice = String(p.invoiceNo);
          const invoiceNo = await tx.sale.findFirst({ where: { shopId: auth.shopId, invoiceNo: requestedInvoice } }) ? `${requestedInvoice}-${op.entityId.slice(0, 6).toUpperCase()}` : requestedInvoice;
          await tx.sale.create({ data: { id: op.entityId, shopId: auth.shopId, staffId: auth.userId, invoiceNo, occurredAt: new Date(String(p.date)), paymentType: String(p.paymentType), customerName: String(p.customerName), customerPhone: String(p.customerPhone ?? ""), customerAddress: String(p.customerAddress ?? ""), driver: String(p.driver ?? ""), car: String(p.car ?? ""), subtotalMinor: money(p.cartSubtotal), deliveryFeeMinor: money(p.deliveryFee), discountMinor: money(p.discount), totalMinor: money(p.total), amountPaidMinor: money(p.amountPaid), balanceMinor: money(p.balance), payCashMinor: money(p.payCash), payTransfer1Minor: money(p.payTransfer1), payTransfer2Minor: money(p.payTransfer2), items: { create: items.map((i) => ({ productId: i.productId, name: i.name, unit: i.unit, quantity: i.qty, unitPriceMinor: money(i.price), subtotalMinor: money(i.subtotal) })) } } });
          for (const item of items) {
            const product = await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty }, version: { increment: 1 } } });
            await tx.stockMovement.create({ data: { shopId: auth.shopId, productId: item.productId, saleId: op.entityId, kind: "SALE", quantity: -item.qty } });
            if (Number(product.stock) < 0) await tx.syncConflict.create({ data: { shopId: auth.shopId, operationId: op.operationId, type: "STOCK_SHORTAGE", entityType: "product", entityId: item.productId, serverPayload: { stock: product.stock.toString() }, submittedPayload: { saleId: op.entityId, quantity: item.qty } } });
          }
          if (Number(p.balance ?? 0) > 0) await tx.debt.create({ data: { id: String(p.debtId), shopId: auth.shopId, saleId: op.entityId, customerName: String(p.customerName), phone: String(p.customerPhone ?? ""), originalAmountMinor: money(p.balance), balanceMinor: money(p.balance), occurredAt: new Date(String(p.date)) } });
        } else if (op.entityType === "debtPayment" && op.kind === "DEBT_PAYMENT") {
          const debtId = String(op.payload.debtId);
          const amountMinor = money(op.payload.amount);
          const debt = await tx.debt.findFirstOrThrow({ where: { id: debtId, shopId: auth.shopId } });
          await tx.debtPayment.create({ data: { id: op.entityId, debtId, operationId: op.operationId, amountMinor, occurredAt: new Date(String(op.payload.date)) } });
          await tx.debt.update({ where: { id: debtId }, data: { balanceMinor: debt.balanceMinor > amountMinor ? debt.balanceMinor - amountMinor : 0n, version: { increment: 1 } } });
        } else if (op.entityType === "settings" && op.kind === "UPDATE") {
          const current = await tx.shopSettings.findUnique({ where: { shopId: auth.shopId } });
          if (current && op.baseVersion != null && current.version !== op.baseVersion) {
            status = "CONFLICT";
            await tx.syncConflict.create({ data: { shopId: auth.shopId, operationId: op.operationId, type: "STALE_EDIT", entityType: "settings", entityId: op.entityId, serverPayload: toJson(current), submittedPayload: toJson(op.payload) } });
          } else {
            await tx.shop.update({ where: { id: auth.shopId }, data: { name: String(op.payload.shopName ?? "My Shop") } });
            await tx.shopSettings.upsert({ where: { shopId: auth.shopId }, create: { shopId: auth.shopId, address: String(op.payload.address ?? ""), phone: String(op.payload.phone ?? "") }, update: { address: String(op.payload.address ?? ""), phone: String(op.payload.phone ?? ""), version: { increment: 1 } } });
          }
        }
        await tx.syncOperation.create({ data: { id: op.operationId, shopId: auth.shopId, userId: auth.userId, deviceId: op.deviceId, entityType: op.entityType, entityId: op.entityId, baseVersion: op.baseVersion, kind: op.kind, payload: toJson(op.payload), clientTime: new Date(op.clientTime), status } });
      });
    } catch (cause) {
      status = "REJECTED"; error = cause instanceof Error ? cause.message : "Operation rejected";
      await prisma.syncOperation.create({ data: { id: op.operationId, shopId: auth.shopId, userId: auth.userId, deviceId: op.deviceId, entityType: op.entityType, entityId: op.entityId, baseVersion: op.baseVersion, kind: op.kind, payload: toJson(op.payload), clientTime: new Date(op.clientTime), status, error } }).catch(() => undefined);
    }
    results.push({ operationId: op.operationId, status, error });
  }
  res.json({ results });
});

syncRouter.get("/pull", async (req, res) => {
  const cursor = z.coerce.bigint().default(0n).parse(req.query.cursor ?? "0");
  const shopId = req.auth!.shopId;
  const operations = await prisma.syncOperation.findMany({ where: { shopId, serverSequence: { gt: cursor } }, orderBy: { serverSequence: "asc" }, take: 500 });
  const nextCursor = operations.at(-1)?.serverSequence ?? cursor;
  const conflicts = await prisma.syncConflict.findMany({ where: { shopId, status: "OPEN", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } });
  res.json(jsonSafe({ operations, conflicts, cursor: nextCursor.toString() }));
});
