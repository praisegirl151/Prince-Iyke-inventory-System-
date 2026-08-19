"use client";

import Image from "next/image";
import type { TabName, User } from "../lib/types";

interface AppHeaderProps {
  shopName: string;
  showSubtitle: boolean;
  address: string;
  phone: string;
  activeUser: User | null;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AppHeader({
  shopName,
  showSubtitle,
  address,
  phone,
  activeUser,
  onOpenSettings,
  onLogout,
}: AppHeaderProps) {
  const division =
    address === "A Division of Obiezu Holding"
      ? `(A Division of Obiezu Holding)${phone ? ` · ${phone}` : ""}`
      : [address, phone].filter(Boolean).join(" · ");

  return (
    <div className="topbar">
      <Image
        src="/Prince Iyke logo.png"
        alt="Logo"
        width={312}
        height={100}
        className="brand-logo"
        onClick={onOpenSettings}
      />
      <div className="topbar-center">
        <div className="brand-title">{shopName}</div>
        {showSubtitle && (
          <div className="brand-subtitle">
            BUILDING &amp; TECHNICAL TOOLS MERCHANTS
          </div>
        )}
        <div className="brand-division">{division}</div>
        <div className="brand-rc">RC: 3620072</div>
        <div className="brand-deals">
          Ultimate in Building Material such as Cement, Zinc, Nails, Spade,
          Wheelbarrow, Paints, Welding/Filling Machine, General Supplies &amp;
          General Merchants
        </div>
      </div>
      <div className="who">
        <span>
          {activeUser ? `${activeUser.name} (${activeUser.role})` : "—"}
        </span>
        <button onClick={onLogout}>Lock / Switch Shift</button>
      </div>
    </div>
  );
}

interface NavigationProps {
  activeTab: TabName;
  isOwner: boolean;
  hasLowStock: boolean;
  hasDebt: boolean;
  onTabChange: (tab: TabName) => void;
  onAddProduct: () => void;
}

export function Navigation({
  activeTab,
  isOwner,
  hasLowStock,
  hasDebt,
  onTabChange,
  onAddProduct,
}: NavigationProps) {
  return (
    <>
      <div className="tabbar">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => onTabChange("dashboard")}
        >
          <span>Home</span>
        </button>
        <button
          className={`inventory ${activeTab === "inventory" ? "active" : ""} ${hasLowStock ? "has-alert" : ""}`}
          onClick={() => onTabChange("inventory")}
        >
          <span>Inventory</span>
          <span className="dot"></span>
        </button>
        <button
          className={activeTab === "sale" ? "active" : ""}
          onClick={() => onTabChange("sale")}
        >
          <span>New Sale</span>
        </button>
        <button
          className={activeTab === "quick-sale" ? "active" : ""}
          onClick={() => onTabChange("quick-sale")}
        >
          <span>Quick Sale</span>
        </button>
        <button
          className={activeTab === "sales-log" ? "active" : ""}
          onClick={() => onTabChange("sales-log")}
        >
          <span>Sales Log</span>
        </button>
        <button
          className={`debts ${activeTab === "debts" ? "active" : ""} ${hasDebt ? "has-alert" : ""}`}
          onClick={() => onTabChange("debts")}
        >
          <span>Debts</span>
          <span className="dot"></span>
        </button>
        {isOwner && (
          <button
            className={activeTab === "reports" ? "active" : ""}
            onClick={() => onTabChange("reports")}
          >
            <span>Reports</span>
          </button>
        )}
      </div>
      {activeTab === "inventory" && isOwner && (
        <button className="fab" id="fabAdd" onClick={onAddProduct}>
          +
        </button>
      )}
    </>
  );
}
