import Dexie, { type EntityTable } from "dexie";
import type { Debt, PendingOperation, Product, Sale, Settings, User } from "./types";

interface KeyValue { key: string; value: unknown }
export interface ConflictRecord { id: string; type: string; entityType: string; entityId: string; serverPayload: unknown; submittedPayload: unknown; createdAt: string }

class InventoryDatabase extends Dexie {
  products!: EntityTable<Product, "id">;
  sales!: EntityTable<Sale, "id">;
  debts!: EntityTable<Debt, "id">;
  users!: EntityTable<User, "id">;
  operations!: EntityTable<PendingOperation, "operationId">;
  conflicts!: EntityTable<ConflictRecord, "id">;
  meta!: EntityTable<KeyValue, "key">;
  constructor() {
    super("stockpoint-inventory");
    this.version(1).stores({ products: "id, name, category", sales: "id, invoiceNo, date", debts: "id, saleId, date", users: "id, name, role", operations: "operationId, status, clientTime, [entityType+entityId]", conflicts: "id, type, entityType, entityId, createdAt", meta: "key" });
  }
}

export const offlineDb = new InventoryDatabase();
export async function getMeta<T>(key: string): Promise<T | undefined> { return (await offlineDb.meta.get(key))?.value as T | undefined; }
export async function setMeta(key: string, value: unknown) { await offlineDb.meta.put({ key, value }); }
export async function loadOfflineState() {
  const [products, sales, debts, users, settings, activeUser, sessionActive] = await Promise.all([offlineDb.products.toArray(), offlineDb.sales.toArray(), offlineDb.debts.toArray(), offlineDb.users.toArray(), getMeta<Settings>("settings"), getMeta<string>("activeUser"), getMeta<boolean>("sessionActive")]);
  return { products, sales, debts, users, settings, activeUser, sessionActive };
}
export async function queueOperation(input: Omit<PendingOperation, "operationId" | "deviceId" | "clientTime" | "status" | "attempts">) {
  let deviceId = await getMeta<string>("deviceId");
  if (!deviceId) { deviceId = crypto.randomUUID(); await setMeta("deviceId", deviceId); }
  await offlineDb.operations.add({ ...input, operationId: crypto.randomUUID(), deviceId, clientTime: new Date().toISOString(), status: "pending", attempts: 0 });
}
export async function migrateLegacyStorage() {
  if (await getMeta<boolean>("legacyRead")) return false;
  const parse = <T>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
  const products = parse<Product[]>("sp_products", []), sales = parse<Sale[]>("sp_sales", []), debts = parse<Debt[]>("sp_debts", []), users = parse<User[]>("sp_users", []), settings = parse<Settings | null>("sp_settings", null);
  await offlineDb.transaction("rw", [offlineDb.products, offlineDb.sales, offlineDb.debts, offlineDb.users, offlineDb.meta], async () => {
    if (products.length) await offlineDb.products.bulkPut(products);
    if (sales.length) await offlineDb.sales.bulkPut(sales);
    if (debts.length) await offlineDb.debts.bulkPut(debts);
    if (users.length) await offlineDb.users.bulkPut(users);
    if (settings) await setMeta("settings", settings);
    await setMeta("activeUser", localStorage.getItem("sp_activeUser"));
    await setMeta("sessionActive", parse("sp_sessionActive", false));
    await setMeta("legacyRead", true);
    await setMeta("legacyPendingUpload", products.length + sales.length + debts.length > 0);
  });
  return products.length + sales.length + debts.length + users.length > 0;
}
export async function clearLegacyStorageAfterImport() {
  ["sp_products", "sp_sales", "sp_debts", "sp_users", "sp_settings", "sp_activeUser", "sp_sessionActive"].forEach((key) => localStorage.removeItem(key));
  await setMeta("legacyPendingUpload", false);
}

export async function getLegacyImportPayload() {
  if (!(await getMeta<boolean>("legacyPendingUpload"))) return null;
  const [products, sales, debts, settings] = await Promise.all([offlineDb.products.toArray(), offlineDb.sales.toArray(), offlineDb.debts.toArray(), getMeta<Settings>("settings")]);
  const content = JSON.stringify({ products, sales, debts, settings });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const fingerprint = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { fingerprint, products, sales, debts, settings };
}
