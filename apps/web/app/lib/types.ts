export type UserRole = "owner" | "staff";
export type ReceiptType = "sale" | "debt";
export type TabName =
  | "dashboard"
  | "inventory"
  | "sale"
  | "quick-sale"
  | "sales-log"
  | "debts"
  | "reports";
export type ModalName =
  | "product"
  | "checkout"
  | "confirm-cancel"
  | "receipt"
  | "user"
  | "settings"
  | "payment";

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  lowStock: number;
  cost: number;
  price: number;
  version?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
}

export interface SaleItem extends CartItem {
  subtotal: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  items: SaleItem[];
  total: number;
  cartSubtotal: number;
  deliveryFee: number;
  discount: number;
  paymentType: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  driver: string;
  car: string;
  staffName: string;
  amountPaid: number;
  balance: number;
  payCash: number;
  payTransfer1: number;
  payTransfer2: number;
}

export interface DebtPayment {
  date: string;
  amount: number;
}

export interface Debt {
  id: string;
  saleId: string;
  customerName: string;
  phone: string;
  originalAmount: number;
  balance: number;
  date: string;
  payments: DebtPayment[];
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin?: string;
  email?: string;
  mustChangePassword?: boolean;
}

export interface Settings {
  shopName: string;
  address: string;
  phone: string;
  version?: number;
}

export type SyncEntityType = "product" | "sale" | "debtPayment" | "settings";
export type SyncOperationKind = "CREATE" | "UPDATE" | "DELETE" | "SALE" | "DEBT_PAYMENT";

export interface PendingOperation {
  operationId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  baseVersion?: number | null;
  kind: SyncOperationKind;
  payload: Record<string, unknown>;
  clientTime: string;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  error?: string;
}

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  conflicts: number;
  lastSyncedAt: string | null;
}

export type Receipt = Sale & Debt;

export interface PersistedInventoryState {
  products: Product[];
  sales: Sale[];
  debts: Debt[];
  users: User[];
  settings: Settings;
  activeUser: string;
  sessionActive: boolean;
}
