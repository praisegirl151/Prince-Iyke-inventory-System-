"use client";

import { useCallback, useEffect, useState } from "react";
import { uid } from "../lib/format";
import { getMeta, loadOfflineState, migrateLegacyStorage, offlineDb, queueOperation, setMeta, type ConflictRecord } from "../lib/offline-db";
import { syncNow } from "../lib/sync-engine";
import { apiRequest } from "../lib/api";
import type { Debt, PendingOperation, Product, Sale, Settings, SyncState, User } from "../lib/types";

const DEFAULT_SETTINGS: Settings = { shopName: "Prince Iyke Building & Technical Tools Merchants", address: "A Division of Obiezu Holding", phone: "" };
const INITIAL_SYNC: SyncState = { online: true, syncing: false, pending: 0, failed: 0, conflicts: 0, lastSyncedAt: null };

export function usePersistentInventory() {
  const [isMounted, setIsMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [initialLoginUserId, setInitialLoginUserId] = useState("");
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC);
  const [syncConflicts, setSyncConflicts] = useState<ConflictRecord[]>([]);

  const refreshSyncState = useCallback(async () => {
    const [pending, failed, conflicts, lastSyncedAt] = await Promise.all([offlineDb.operations.where("status").equals("pending").count(), offlineDb.operations.where("status").equals("failed").count(), offlineDb.conflicts.count(), getMeta<string>("lastSyncedAt")]);
    setSyncState((value) => ({ ...value, online: navigator.onLine, pending, failed, conflicts, lastSyncedAt: lastSyncedAt ?? null }));
    setSyncConflicts(await offlineDb.conflicts.toArray());
  }, []);

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) { await refreshSyncState(); return; }
    setSyncState((value) => ({ ...value, syncing: true, online: true }));
    try {
      await syncNow();
      const state = await loadOfflineState();
      setProducts(state.products); setSales(state.sales); setDebts(state.debts);
      if (state.settings) setSettings(state.settings);
    } catch { /* queued data remains durable */ }
    finally { setSyncState((value) => ({ ...value, syncing: false })); await refreshSyncState(); }
  }, [refreshSyncState]);

  const enqueueOperation = useCallback(async (input: Omit<PendingOperation, "operationId" | "deviceId" | "clientTime" | "status" | "attempts">) => {
    await queueOperation(input); await refreshSyncState(); void synchronize();
  }, [refreshSyncState, synchronize]);

  useEffect(() => {
    void (async () => {
      await migrateLegacyStorage();
      const state = await loadOfflineState();
      let loadedUsers = state.users, loadedActiveUser = state.activeUser;
      if (!loadedUsers.length) { const ownerId = uid(); loadedUsers = [{ id: ownerId, name: "Owner", role: "owner", pin: "0000" }]; loadedActiveUser = ownerId; await offlineDb.users.bulkPut(loadedUsers); await setMeta("activeUser", ownerId); }
      setSettings(state.settings ?? DEFAULT_SETTINGS); setUsers(loadedUsers); setActiveUser(loadedActiveUser ?? loadedUsers[0]?.id ?? null); setProducts(state.products); setSales(state.sales); setDebts(state.debts);
      const trustedUntil = await getMeta<number>("trustedUntil");
      setSessionActive(Boolean(state.sessionActive && trustedUntil && trustedUntil > Date.now()));
      setInitialLoginUserId(loadedUsers.find((user) => user.id === loadedActiveUser)?.email ?? ""); setIsMounted(true); await refreshSyncState();
      if (navigator.onLine) void synchronize();
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    })();
  }, [refreshSyncState, synchronize]);

  useEffect(() => { if (isMounted) void offlineDb.products.bulkPut(products); }, [products, isMounted]);
  useEffect(() => { if (isMounted) void offlineDb.sales.bulkPut(sales); }, [sales, isMounted]);
  useEffect(() => { if (isMounted) void offlineDb.debts.bulkPut(debts); }, [debts, isMounted]);
  useEffect(() => { if (isMounted) void offlineDb.users.bulkPut(users); }, [users, isMounted]);
  useEffect(() => { if (isMounted) void setMeta("settings", settings); }, [settings, isMounted]);
  useEffect(() => { if (isMounted && activeUser) void setMeta("activeUser", activeUser); }, [activeUser, isMounted]);
  useEffect(() => { if (isMounted) { void setMeta("sessionActive", sessionActive); if (sessionActive) void setMeta("trustedUntil", Date.now() + 7 * 86400000); } }, [sessionActive, isMounted]);
  useEffect(() => {
    const onOnline = () => void synchronize(), onOffline = () => void refreshSyncState(), onFocus = () => void synchronize();
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void synchronize(), 60_000);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [refreshSyncState, synchronize]);

  const resolveConflict = useCallback(async (id: string, choice: "server" | "submitted") => {
    await apiRequest(`/conflicts/${id}/resolve`, { method: "POST", body: JSON.stringify({ choice }) });
    await offlineDb.conflicts.delete(id); await refreshSyncState(); await synchronize();
  }, [refreshSyncState, synchronize]);

  return { isMounted, products, setProducts, sales, setSales, debts, setDebts, users, setUsers, settings, setSettings, activeUser, setActiveUser, sessionActive, setSessionActive, initialLoginUserId, syncState, syncConflicts, synchronize, enqueueOperation, resolveConflict };
}
