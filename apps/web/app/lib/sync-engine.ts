import { apiRequest } from "./api";
import { getMeta, offlineDb, setMeta } from "./offline-db";
import type { Debt, Product, Sale, Settings } from "./types";

export async function syncNow() {
  if (!navigator.onLine) return;
  const pending = await offlineDb.operations.where("status").anyOf("pending", "failed").limit(100).toArray();
  if (pending.length) {
    await offlineDb.operations.bulkUpdate(pending.map((op) => ({ key: op.operationId, changes: { status: "syncing" as const, attempts: op.attempts + 1 } })));
    try {
      const pushed = await apiRequest<{ results: Array<{ operationId: string; status: "APPLIED" | "CONFLICT" | "REJECTED"; error?: string }> }>("/sync/push", { method: "POST", body: JSON.stringify({ operations: pending.map((op) => ({ operationId: op.operationId, deviceId: op.deviceId, entityType: op.entityType, entityId: op.entityId, baseVersion: op.baseVersion, kind: op.kind, payload: op.payload, clientTime: op.clientTime })) }) });
      for (const result of pushed.results) {
        if (result.status === "APPLIED" || result.status === "CONFLICT") await offlineDb.operations.delete(result.operationId);
        else await offlineDb.operations.update(result.operationId, { status: "failed", error: result.error ?? "Rejected by server" });
      }
    } catch (error) {
      await offlineDb.operations.bulkUpdate(pending.map((op) => ({ key: op.operationId, changes: { status: "failed" as const, error: error instanceof Error ? error.message : "Network error" } })));
      throw error;
    }
  }
  const cursor = (await offlineDb.meta.get("syncCursor"))?.value ?? "0";
  const pulled = await apiRequest<{ cursor: string; operations: Array<{ id: string; entityId: string; deviceId: string; entityType: string; kind: string; payload: Record<string, unknown>; status: string }>; conflicts: Array<{ id: string; type: string; entityType: string; entityId: string; serverPayload: unknown; submittedPayload: unknown; createdAt: string }> }>(`/sync/pull?cursor=${encodeURIComponent(String(cursor))}`);
  const deviceId = await getMeta<string>("deviceId");
  await offlineDb.transaction("rw", [offlineDb.products, offlineDb.sales, offlineDb.debts, offlineDb.conflicts, offlineDb.meta], async () => {
    for (const operation of pulled.operations) {
      if (operation.deviceId === deviceId || operation.status !== "APPLIED") continue;
      const payload = operation.payload;
      if (operation.entityType === "product") {
        if (operation.kind === "DELETE") await offlineDb.products.delete(operation.entityId);
        else { const existing = await offlineDb.products.get(operation.entityId); await offlineDb.products.put({ ...existing, ...(payload as unknown as Product), id: operation.entityId }); }
      } else if (operation.entityType === "sale") {
        const sale = payload as unknown as Sale;
        await offlineDb.sales.put(sale);
        for (const item of sale.items) { const product = await offlineDb.products.get(item.productId); if (product) await offlineDb.products.update(item.productId, { stock: product.stock - item.qty, version: (product.version ?? 1) + 1 }); }
        if (Number(payload.balance ?? 0) > 0 && payload.debtId) await offlineDb.debts.put({ id: String(payload.debtId), saleId: sale.id, customerName: sale.customerName, phone: sale.customerPhone, originalAmount: sale.balance, balance: sale.balance, date: sale.date, payments: [] });
      } else if (operation.entityType === "debtPayment") {
        const debt = await offlineDb.debts.get(String(payload.debtId));
        if (debt) await offlineDb.debts.put({ ...debt, balance: Math.max(0, debt.balance - Number(payload.amount)), payments: [...debt.payments, { date: String(payload.date), amount: Number(payload.amount) }] } as Debt);
      } else if (operation.entityType === "settings") await setMeta("settings", payload as unknown as Settings);
    }
    await offlineDb.conflicts.bulkPut(pulled.conflicts); await setMeta("syncCursor", pulled.cursor); await setMeta("lastSyncedAt", new Date().toISOString());
  });
}
