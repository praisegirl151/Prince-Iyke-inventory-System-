"use client";

import React, { useMemo, useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import html2canvas from "html2canvas";
import {
  debtToReceipt,
  formatGrandTotalInWords,
  naira,
  saleToReceipt,
  todayStr,
  uid,
} from "../lib/format";
import type { Debt, Product } from "../lib/types";
import { clearLegacyStorageAfterImport, getLegacyImportPayload, offlineDb } from "../lib/offline-db";
import { apiRequest, cloudLogin, setAccessToken } from "../lib/api";
import { useInventorySystem } from "../hooks/use-inventory-system";
import { LoadingScreen, LoginScreen } from "./system-states";
import { AppHeader, Navigation } from "./app-shell";
import {
  DashboardView,
  DebtsView,
  InventoryView,
  QuickSaleView,
  ReportsView,
  SaleView,
  SalesLogView,
} from "./views/view-panels";
import {
  CancelCheckoutDialog,
  CheckoutDialog,
  DebtPaymentDialog,
  ProductDialog,
  ReceiptDialog,
  SettingsDialog,
  StaffDialog,
} from "./dialogs/dialog-panels";

export function InventorySystemApp() {
  const {
    isMounted,
    products,
    setProducts,
    sales,
    setSales,
    debts,
    setDebts,
    users,
    setUsers,
    settings,
    setSettings,
    activeUser,
    setActiveUser,
    sessionActive,
    setSessionActive,
    activeTab,
    setActiveTab,
    activeModal,
    setActiveModal,
    editingProduct,
    setEditingProduct,
    toast,
    setToast,
    cart,
    setCart,
    invSearch,
    setInvSearch,
    saleSearch,
    setSaleSearch,
    salesLogSearch,
    setSalesLogSearch,
    salesLogPeriod,
    setSalesLogPeriod,
    salesLogType,
    setSalesLogType,
    salesLogStaff,
    setSalesLogStaff,
    reportRange,
    setReportRange,
    checkoutForm,
    setCheckoutForm,
    currentReceipt,
    setCurrentReceipt,
    currentReceiptType,
    setCurrentReceiptType,
    currentDebtPaymentAmount,
    setCurrentDebtPaymentAmount,
    newStaff,
    setNewStaff,
    recordingPaymentDebt,
    setRecordingPaymentDebt,
    recordingPaymentAmount,
    setRecordingPaymentAmount,
    loginPin,
    setLoginPin,
    loginUserId,
    setLoginUserId,
    syncState,
    syncConflicts,
    synchronize,
    enqueueOperation,
    resolveConflict,
  } = useInventorySystem();
  const [showConflicts, setShowConflicts] = useState(false);
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);

  // --- QUICK SALE STATE & LOGIC ---
  const [quickCart, setQuickCart] = useState<Array<{ productId: string; name: string; unit: string; qty: number; price: number }>>([]);
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemQty, setQuickItemQty] = useState("1");
  const [quickItemUnit, setQuickItemUnit] = useState("pcs");
  const [quickItemPrice, setQuickItemPrice] = useState("");

  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickCustomerAddress, setQuickCustomerAddress] = useState("");
  const [quickDeliveryFee, setQuickDeliveryFee] = useState("");
  const [quickDiscount, setQuickDiscount] = useState("");
  const [quickPaymentType, setQuickPaymentType] = useState("cash");
  const [quickAmountPaid, setQuickAmountPaid] = useState("");
  const [quickDriver, setQuickDriver] = useState("");
  const [quickPayCash, setQuickPayCash] = useState("");
  const [quickPayTransfer1, setQuickPayTransfer1] = useState("");
  const [quickPayTransfer2, setQuickPayTransfer2] = useState("");

  const addQuickItem = () => {
    const name = quickItemName.trim();
    const qty = parseFloat(quickItemQty) || 0;
    const price = parseFloat(quickItemPrice) || 0;
    const unit = quickItemUnit.trim();

    if (!name) {
      showToast("Enter item name");
      return;
    }
    if (qty <= 0) {
      showToast("Quantity must be greater than 0");
      return;
    }
    if (price < 0) {
      showToast("Price cannot be negative");
      return;
    }

    const tempId = `quick-${uid()}`;
    setQuickCart((prev) => [
      ...prev,
      { productId: tempId, name, unit, qty, price },
    ]);

    // Reset inputs
    setQuickItemName("");
    setQuickItemQty("1");
    setQuickItemUnit("pcs");
    setQuickItemPrice("");
  };

  const removeQuickItem = (productId: string) => {
    setQuickCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const quickCartTotal = useMemo(() => {
    return quickCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [quickCart]);

  const quickGrandTotal = useMemo(() => {
    const delivery = parseFloat(quickDeliveryFee) || 0;
    const discount = parseFloat(quickDiscount) || 0;
    return quickCartTotal + delivery - discount;
  }, [quickCartTotal, quickDeliveryFee, quickDiscount]);

  const handleCompleteQuickSale = () => {
    if (quickCart.length === 0) {
      showToast("Add items to quick sale cart first");
      return;
    }

    const type = quickPaymentType;
    const customerName = quickCustomerName.trim();
    const customerPhone = quickCustomerPhone.trim();
    const customerAddress = quickCustomerAddress.trim();
    const deliveryFee = parseFloat(quickDeliveryFee) || 0;
    const discount = parseFloat(quickDiscount) || 0;
    const payCash = parseFloat(quickPayCash) || 0;
    const payTransfer1 = parseFloat(quickPayTransfer1) || 0;
    const payTransfer2 = parseFloat(quickPayTransfer2) || 0;

    if (type === "credit" && !customerName) {
      showToast("Customer name required for credit sale");
      return;
    }

    const subtotal = quickCartTotal;
    const grandTotal = quickGrandTotal;
    let amountPaid = grandTotal;
    let balance = 0;

    if (type === "credit") {
      amountPaid = parseFloat(quickAmountPaid) || 0;
      balance = grandTotal - amountPaid;
    }

    const invoiceSeq = sales.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNo = `PI-${currentYear}-${String(invoiceSeq).padStart(4, "0")}`;

    const newSale = {
      id: uid(),
      invoiceNo,
      date: new Date().toISOString(),
      items: quickCart.map((c) => ({ ...c, subtotal: c.price * c.qty })),
      total: grandTotal,
      cartSubtotal: subtotal,
      deliveryFee,
      discount,
      paymentType: type,
      customerName: customerName || "Walk-in",
      customerPhone,
      customerAddress,
      driver: quickDriver.trim(),
      car: "",
      staffName: activeUserObj ? activeUserObj.name : "System",
      amountPaid,
      balance,
      payCash,
      payTransfer1,
      payTransfer2,
    };

    const newSalesList = [...sales, newSale];
    setSales(newSalesList);

    let debtId: string | undefined;
    if (type === "credit" && balance > 0) {
      debtId = uid();
      const newDebt = {
        id: debtId,
        saleId: newSale.id,
        customerName,
        phone: customerPhone,
        originalAmount: balance,
        balance,
        date: newSale.date,
        payments: [],
      };
      setDebts([...debts, newDebt]);
    }

    void enqueueOperation({
      entityType: "sale",
      entityId: newSale.id,
      kind: "SALE",
      payload: { ...newSale, debtId },
    });

    // Reset quick sale cart and inputs
    setQuickCart([]);
    setQuickCustomerName("");
    setQuickCustomerPhone("");
    setQuickCustomerAddress("");
    setQuickDeliveryFee("");
    setQuickDiscount("");
    setQuickPaymentType("cash");
    setQuickAmountPaid("");
    setQuickDriver("");
    setQuickPayCash("");
    setQuickPayTransfer1("");
    setQuickPayTransfer2("");

    // Show receipt
    setCurrentReceiptType("sale");
    setCurrentReceipt(saleToReceipt(newSale));
    setActiveModal("receipt");
    showToast("Quick Sale receipt generated!");
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("print-a4-active", "print-small-active");
        const style = document.getElementById("small-print-page-style");
        if (style) {
          style.remove();
        }
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // --- VIEW ROLES & USER CONTROLS ---
  const activeUserObj = useMemo(() => {
    return users.find((u) => u.id === activeUser) || users[0] || null;
  }, [users, activeUser]);

  const isOwner = useMemo(() => {
    return activeUserObj && activeUserObj.role === "owner";
  }, [activeUserObj]);

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
  };

  // --- HEADER DETAILS ---
  const shopNameDisplay =
    settings.shopName === "Prince Iyke Building & Technical Tools Merchants"
      ? "PRINCE IYKE"
      : settings.shopName;
  const showSubtitle =
    settings.shopName === "Prince Iyke Building & Technical Tools Merchants";

  // --- DASHBOARD LOGIC ---
  const todaySales = useMemo(() => {
    const today = todayStr();
    return sales
      .filter((s) => s.date.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  const lowStockItems = useMemo(() => {
    return products.filter((p) => p.stock <= p.lowStock);
  }, [products]);

  const totalDebtsOwed = useMemo(() => {
    return debts.reduce((sum, d) => sum + d.balance, 0);
  }, [debts]);

  const totalStockValue = useMemo(() => {
    return products.reduce(
      (sum, p) => sum + p.stock * (isOwner ? p.cost : p.price),
      0,
    );
  }, [products, isOwner]);

  const recentSales = useMemo(() => {
    return sales.slice().reverse().slice(0, 6);
  }, [sales]);

  // --- INVENTORY VIEW ---
  const filteredProducts = useMemo(() => {
    const q = invSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, invSearch]);

  // --- SALE Cart & PICKER LOGIC ---
  const salePickerProducts = useMemo(() => {
    const q = saleSearch.toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [products, saleSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  }, [cart]);

  const addToCart = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (p.stock <= 0) {
      showToast("Out of stock");
      return;
    }
    const existing = cart.find((c) => c.productId === productId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.productId === productId ? { ...c, qty: c.qty + 1 } : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        { productId, name: p.name, unit: p.unit, qty: 1, price: p.price },
      ]);
    }
    setSaleSearch("");
  };

  const changeQty = (productId: string, delta: number) => {
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter((c) => c.productId !== productId));
    } else {
      setCart(
        cart.map((c) =>
          c.productId === productId ? { ...c, qty: newQty } : c,
        ),
      );
    }
  };

  const changePrice = (productId: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price) && price >= 0) {
      setCart(
        cart.map((c) => (c.productId === productId ? { ...c, price } : c)),
      );
    }
  };

  // --- CHECKOUT LOGIC ---
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast("Add items to cart first");
      return;
    }
    setCheckoutForm({
      paymentType: "cash",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      amountPaid: "",
      driver: "",
      car: "",
      deliveryFee: "",
      discount: "",
      payCash: "",
      payTransfer1: "",
      payTransfer2: "",
    });
    setActiveModal("checkout");
  };

  const checkoutSummary = useMemo(() => {
    const subtotal = cartTotal;
    const deliveryFee = parseFloat(checkoutForm.deliveryFee) || 0;
    const discount = parseFloat(checkoutForm.discount) || 0;
    const grandTotal = subtotal + deliveryFee - discount;
    const type = checkoutForm.paymentType;

    let summaryHtml = `Cart Subtotal: ${naira(subtotal)}\n`;
    if (deliveryFee > 0)
      summaryHtml += `Delivery Fee: +${naira(deliveryFee)}\n`;
    if (discount > 0) summaryHtml += `Discount: -${naira(discount)}\n`;
    summaryHtml += `Grand Total: ${naira(grandTotal)}\n`;

    if (type === "credit") {
      const amountPaid = parseFloat(checkoutForm.amountPaid) || 0;
      const balance = grandTotal - amountPaid;
      summaryHtml += `Paid Now: ${naira(amountPaid)}\n`;
      summaryHtml += `Balance (Credit): ${naira(balance)}`;
    } else {
      summaryHtml += `Payment Status: PAID IN FULL`;
    }
    return { summaryHtml, grandTotal };
  }, [cartTotal, checkoutForm]);

  const handleCompleteSale = () => {
    const type = checkoutForm.paymentType;
    const customerName = checkoutForm.customerName.trim();
    const customerPhone = checkoutForm.customerPhone.trim();
    const customerAddress = checkoutForm.customerAddress.trim();
    const driver = checkoutForm.driver.trim();
    const car = checkoutForm.car.trim();
    const deliveryFee = parseFloat(checkoutForm.deliveryFee) || 0;
    const discount = parseFloat(checkoutForm.discount) || 0;
    const payCash = parseFloat(checkoutForm.payCash) || 0;
    const payTransfer1 = parseFloat(checkoutForm.payTransfer1) || 0;
    const payTransfer2 = parseFloat(checkoutForm.payTransfer2) || 0;

    if (type === "credit" && !customerName) {
      showToast("Customer name required for credit sale");
      return;
    }

    const subtotal = cartTotal;
    const grandTotal = subtotal + deliveryFee - discount;
    let amountPaid = grandTotal;
    let balance = 0;

    if (type === "credit") {
      amountPaid = parseFloat(checkoutForm.amountPaid) || 0;
      balance = grandTotal - amountPaid;
    }

    // Deduct stock levels
    const updatedProducts = products.map((p) => {
      const cartItem = cart.find((c) => c.productId === p.id);
      if (cartItem) {
        return { ...p, stock: p.stock - cartItem.qty, version: (p.version ?? 1) + 1 };
      }
      return p;
    });
    setProducts(updatedProducts);

    const invoiceSeq = sales.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNo = `PI-${currentYear}-${String(invoiceSeq).padStart(4, "0")}`;

    const newSale = {
      id: uid(),
      invoiceNo,
      date: new Date().toISOString(),
      items: cart.map((c) => ({ ...c, subtotal: c.price * c.qty })),
      total: grandTotal,
      cartSubtotal: subtotal,
      deliveryFee,
      discount,
      paymentType: type,
      customerName: customerName || "Walk-in",
      customerPhone,
      customerAddress,
      driver,
      car,
      staffName: activeUserObj ? activeUserObj.name : "System",
      amountPaid,
      balance,
      payCash,
      payTransfer1,
      payTransfer2,
    };

    const newSalesList = [...sales, newSale];
    setSales(newSalesList);

    let debtId: string | undefined;
    if (type === "credit" && balance > 0) {
      debtId = uid();
      const newDebt = {
        id: debtId,
        saleId: newSale.id,
        customerName,
        phone: customerPhone,
        originalAmount: balance,
        balance,
        date: newSale.date,
        payments: [],
      };
      setDebts([...debts, newDebt]);
    }

    void enqueueOperation({ entityType: "sale", entityId: newSale.id, kind: "SALE", payload: { ...newSale, debtId } });

    setCart([]);
    setActiveModal(null);
    setCurrentReceiptType("sale");
    setCurrentReceipt(saleToReceipt(newSale));
    setActiveModal("receipt");
  };

  // --- SALES LOG FILTERS & DATA ---
  const salesLogSummary = useMemo(() => {
    const q = salesLogSearch.toLowerCase();
    const period = salesLogPeriod;
    const type = salesLogType;
    const staff = salesLogStaff;
    const now = new Date();

    const filtered = sales.filter((s) => {
      if (q) {
        const invMatch = (s.invoiceNo || s.id || "").toLowerCase().includes(q);
        const custMatch = (s.customerName || "").toLowerCase().includes(q);
        const staffMatch = (s.staffName || "").toLowerCase().includes(q);
        const itemMatch = s.items.some((i) => i.name.toLowerCase().includes(q));
        if (!invMatch && !custMatch && !staffMatch && !itemMatch) return false;
      }

      if (period !== "all") {
        const sDate = new Date(s.date);
        if (period === "today") {
          if (sDate.toDateString() !== now.toDateString()) return false;
        } else if (period === "week") {
          const diffDays =
            (now.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) return false;
        } else if (period === "month") {
          if (
            sDate.getMonth() !== now.getMonth() ||
            sDate.getFullYear() !== now.getFullYear()
          )
            return false;
        }
      }

      if (type !== "all") {
        if (s.paymentType !== type) return false;
      }

      if (staff !== "all") {
        if (s.staffName !== staff) return false;
      }

      return true;
    });

    const count = filtered.length;
    const totalSalesVal = filtered.reduce((sum, s) => sum + s.total, 0);
    const cashVal = filtered.reduce(
      (sum, s) => sum + (s.paymentType === "cash" ? s.total : s.amountPaid),
      0,
    );
    const creditVal = filtered.reduce(
      (sum, s) => sum + (s.paymentType === "credit" ? s.balance : 0),
      0,
    );

    return { filtered, count, totalSalesVal, cashVal, creditVal };
  }, [sales, salesLogSearch, salesLogPeriod, salesLogType, salesLogStaff]);

  // --- DEBTS LOGIC ---
  const activeDebts = useMemo(() => {
    return debts.filter((d) => d.balance > 0);
  }, [debts]);

  const handleOpenDebtPayment = (debt: Debt) => {
    setRecordingPaymentDebt(debt);
    setRecordingPaymentAmount("");
    setActiveModal("payment");
  };

  const handleRecordDebtPayment = () => {
    const amount = parseFloat(recordingPaymentAmount) || 0;
    if (amount <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    if (!recordingPaymentDebt) return;
    const paymentId = uid();
    const paymentDate = new Date().toISOString();

    const updatedDebts = debts.map((d) => {
      if (d.id === recordingPaymentDebt.id) {
        const updatedBalance = Math.max(0, d.balance - amount);
        const updatedPayments = [
          ...d.payments,
          { date: paymentDate, amount },
        ];

        // Build the receipt object
        const targetDebt = {
          ...d,
          balance: updatedBalance,
          payments: updatedPayments,
        };
        setCurrentReceiptType("debt");
        setCurrentDebtPaymentAmount(amount);
        setCurrentReceipt(debtToReceipt(targetDebt));
        return targetDebt;
      }
      return d;
    });

    setDebts(updatedDebts);
    void enqueueOperation({ entityType: "debtPayment", entityId: paymentId, kind: "DEBT_PAYMENT", payload: { debtId: recordingPaymentDebt.id, amount, date: paymentDate } });
    setActiveModal(null);
    setActiveModal("receipt");
    showToast("Payment recorded");
  };

  // --- REPORTS VIEW ---
  const reportsData = useMemo(() => {
    const range = reportRange;
    const filteredSales = sales.filter((s) => {
      if (range === "all") return true;
      const d = new Date(s.date);
      const now = new Date();
      if (range === "today") return d.toDateString() === now.toDateString();
      if (range === "week") {
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      return true;
    });

    const qtyMap: Record<string, number> = {};
    filteredSales.forEach((s) =>
      s.items.forEach((i) => {
        qtyMap[i.name] = (qtyMap[i.name] || 0) + i.qty;
      }),
    );

    const bestSellers = Object.entries(qtyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let profit = 0;
    let revenue = 0;
    filteredSales.forEach((s) =>
      s.items.forEach((i) => {
        const p = products.find((x) => x.name === i.name);
        revenue += i.subtotal;
        if (p) profit += (i.price - p.cost) * i.qty;
      }),
    );

    return {
      bestSellers,
      revenue,
      profit,
      lowStockCount: lowStockItems.length,
    };
  }, [sales, products, reportRange, lowStockItems]);

  // --- PRODUCT FORM CONTROLS ---
  const handleOpenAddProduct = () => {
    if (!isOwner) {
      showToast("Only Owner can add/edit products");
      return;
    }
    setEditingProduct(null);
    setActiveModal("product");
  };

  const handleOpenEditProduct = (p: Product) => {
    if (!isOwner) {
      showToast("Only Owner can add/edit products");
      return;
    }
    setEditingProduct(p);
    setActiveModal("product");
  };

  const handleSaveProduct = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("p_name") ?? "").trim();
    if (!name) {
      showToast("Enter a product name");
      return;
    }

    const data = {
      name,
      category: String(form.get("p_category") ?? "").trim(),
      unit: String(form.get("p_unit") ?? ""),
      stock: parseFloat(String(form.get("p_stock") ?? "")) || 0,
      lowStock: parseFloat(String(form.get("p_lowStock") ?? "")) || 0,
      cost: parseFloat(String(form.get("p_cost") ?? "")) || 0,
      price: parseFloat(String(form.get("p_price") ?? "")) || 0,
    };

    if (editingProduct) {
      setProducts(
        products.map((p) =>
          p.id === editingProduct.id ? { ...p, ...data, version: (p.version ?? 1) + 1 } : p,
        ),
      );
      void enqueueOperation({ entityType: "product", entityId: editingProduct.id, baseVersion: editingProduct.version ?? 1, kind: "UPDATE", payload: data });
    } else {
      const product = { id: uid(), ...data, version: 1 };
      setProducts([...products, product]);
      void enqueueOperation({ entityType: "product", entityId: product.id, kind: "CREATE", payload: data });
    }

    setActiveModal(null);
    showToast("Product saved");
  };

  const handleDeleteProduct = () => {
    if (!editingProduct) return;
    if (!confirm("Delete this product?")) return;
    setProducts(products.filter((p) => p.id !== editingProduct.id));
    void offlineDb.products.delete(editingProduct.id);
    void enqueueOperation({ entityType: "product", entityId: editingProduct.id, baseVersion: editingProduct.version ?? 1, kind: "DELETE", payload: {} });
    setActiveModal(null);
    showToast("Product deleted");
  };

  // --- STAFF/USERS LOGIC ---
  const handleOpenStaffManagement = () => {
    setNewStaff({ name: "", email: "", pin: "" });
    setActiveModal("user");
  };

  const handleAddStaff = async () => {
    const name = newStaff.name.trim();
    const email = newStaff.email.trim().toLowerCase();
    const temporaryPassword = newStaff.pin;
    if (!name) {
      showToast("Enter staff name");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showToast("Enter a valid staff email");
      return;
    }
    if (temporaryPassword.length < 8) {
      showToast("Temporary password must be at least 8 characters");
      return;
    }
    try {
      const user = await apiRequest<{ id: string; name: string; email: string }>("/staff", { method: "POST", body: JSON.stringify({ name, email, temporaryPassword }) });
      setUsers([...users, { ...user, role: "staff", mustChangePassword: true }]);
      setNewStaff({ name: "", email: "", pin: "" });
      showToast("Staff account created");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not create staff"); }
  };

  const handleRemoveStaff = (userId: string) => {
    if (userId === activeUser) {
      showToast("Cannot remove currently active user");
      return;
    }
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    void apiRequest(`/staff/${userId}`, { method: "DELETE" }).then(() => { setUsers(users.filter((u) => u.id !== userId)); void offlineDb.users.delete(userId); showToast("Staff member removed"); }).catch((error) => showToast(error instanceof Error ? error.message : "Could not remove staff"));
  };

  // --- SETTINGS CONTROLS ---
  const handleOpenSettings = () => {
    if (!isOwner) {
      showToast("Only the Owner can access settings");
      return;
    }
    setActiveModal("settings");
  };

  const handleSaveSettings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const shopName = String(form.get("s_shopName") ?? "").trim() || "My Shop";
    const address = String(form.get("s_address") ?? "").trim();
    const phone = String(form.get("s_phone") ?? "").trim();
    setSettings({ shopName, address, phone, version: (settings.version ?? 1) + 1 });
    void enqueueOperation({ entityType: "settings", entityId: activeUser ?? uid(), baseVersion: settings.version ?? 1, kind: "UPDATE", payload: { shopName, address, phone } });
    setActiveModal(null);
    showToast("Settings saved");
  };

  // --- EXPORT & IMPORT DATA BACKUPS ---
  const handleExportBackup = () => {
    const backup = {
      sp_products: products,
      sp_sales: sales,
      sp_debts: debts,
      sp_users: users,
      sp_settings: settings,
      sp_activeUser: activeUser,
      sp_sessionActive: sessionActive,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockpoint-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") return;
        const backup = JSON.parse(reader.result);
        if (backup.sp_products) setProducts(backup.sp_products);
        if (backup.sp_sales) setSales(backup.sp_sales);
        if (backup.sp_debts) setDebts(backup.sp_debts);
        if (backup.sp_users) setUsers(backup.sp_users);
        if (backup.sp_settings) setSettings(backup.sp_settings);
        if (backup.sp_activeUser) setActiveUser(backup.sp_activeUser);
        if (backup.sp_sessionActive !== undefined)
          setSessionActive(backup.sp_sessionActive);
        showToast("Backup restored — reloading state...");
        setActiveModal(null);
      } catch {
        showToast("Invalid backup file");
      }
    };
    reader.readAsText(file);
  };

  // --- LOGIN CONTROLS ---
  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loginUserId) {
      showToast("Enter your email address");
      return;
    }
    if (!navigator.onLine) { showToast("First sign-in requires an internet connection"); return; }
    try {
      const auth = await cloudLogin(loginUserId, loginPin);
      const cloudUser = auth.user as { id: string; email: string; name: string; role: "OWNER" | "STAFF"; mustChangePassword?: boolean };
      if (cloudUser.mustChangePassword) {
        const newPassword = prompt("You must replace your temporary password before continuing. Enter a new password (at least 8 characters):");
        if (!newPassword || newPassword.length < 8) throw new Error("Password change is required");
        await apiRequest("/account/password", { method: "PATCH", body: JSON.stringify({ currentPassword: loginPin, newPassword }) });
      }
      const legacy = await getLegacyImportPayload();
      if (legacy && cloudUser.role === "OWNER" && confirm(`Import the records saved on this browser into this shop?\n\n${legacy.products.length} products\n${legacy.sales.length} sales\n${legacy.debts.length} debts`)) {
        await apiRequest("/import/legacy", { method: "POST", body: JSON.stringify(legacy) });
        await clearLegacyStorageAfterImport();
      }
      const snapshot = await apiRequest<{
        shop: { name: string; settings?: { address: string; phone: string; version: number } };
        users: Array<{ id: string; email: string; name: string; role: "OWNER" | "STAFF" }>;
        products: Array<{ id: string; name: string; category: string; unit: string; stock: string; lowStock: string; costMinor: string; priceMinor: string; version: number }>;
        sales: Array<Record<string, unknown>>; debts: Array<Record<string, unknown>>;
      }>("/snapshot");
      setUsers(snapshot.users.map((u) => ({ ...u, role: u.role.toLowerCase() as "owner" | "staff" })));
      setProducts(snapshot.products.map((p) => ({ id: p.id, name: p.name, category: p.category, unit: p.unit, stock: Number(p.stock), lowStock: Number(p.lowStock), cost: Number(p.costMinor) / 100, price: Number(p.priceMinor) / 100, version: p.version })));
      setSales(snapshot.sales.map((raw) => ({ id: String(raw.id), invoiceNo: String(raw.invoiceNo), date: String(raw.occurredAt), items: ((raw.items as Array<Record<string, unknown>>) ?? []).map((item) => ({ productId: String(item.productId), name: String(item.name), unit: String(item.unit), qty: Number(item.quantity), price: Number(item.unitPriceMinor) / 100, subtotal: Number(item.subtotalMinor) / 100 })), total: Number(raw.totalMinor) / 100, cartSubtotal: Number(raw.subtotalMinor) / 100, deliveryFee: Number(raw.deliveryFeeMinor) / 100, discount: Number(raw.discountMinor) / 100, paymentType: String(raw.paymentType), customerName: String(raw.customerName), customerPhone: String(raw.customerPhone), customerAddress: String(raw.customerAddress), driver: String(raw.driver), car: String(raw.car), staffName: "Staff", amountPaid: Number(raw.amountPaidMinor) / 100, balance: Number(raw.balanceMinor) / 100, payCash: Number(raw.payCashMinor) / 100, payTransfer1: Number(raw.payTransfer1Minor) / 100, payTransfer2: Number(raw.payTransfer2Minor) / 100 })));
      setDebts(snapshot.debts.map((raw) => ({ id: String(raw.id), saleId: String(raw.saleId), customerName: String(raw.customerName), phone: String(raw.phone), originalAmount: Number(raw.originalAmountMinor) / 100, balance: Number(raw.balanceMinor) / 100, date: String(raw.occurredAt), payments: ((raw.payments as Array<Record<string, unknown>>) ?? []).map((payment) => ({ date: String(payment.occurredAt), amount: Number(payment.amountMinor) / 100 })) })));
      setSettings({ shopName: snapshot.shop.name, address: snapshot.shop.settings?.address ?? "", phone: snapshot.shop.settings?.phone ?? "", version: snapshot.shop.settings?.version });
      setActiveUser(cloudUser.id);
      setSessionActive(true);
      setLoginPin("");
      setActiveTab("dashboard");
      showToast(`Welcome, ${cloudUser.name}`);
      void synchronize();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to sign in");
      setLoginPin("");
    }
  };

  const handleLogout = () => {
    void apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    void offlineDb.meta.delete("trustedUntil");
    setSessionActive(false);
    setLoginPin("");
    showToast("App Locked");
  };

  // --- RECEIPT SHARING ---
  const handleShareReceipt = async () => {
    if (!currentReceipt || isSharingReceipt) return;

    const receiptElement = document.querySelector("#printArea .invoice-a4") as HTMLElement | null;
    if (!receiptElement) {
      showToast("Receipt preview not found");
      return;
    }

    setIsSharingReceipt(true);
    showToast("Generating receipt image...");

    try {
      // Clone the element to render it off-screen and avoid scrollbar/viewport cropping issues
      const clone = receiptElement.cloneNode(true) as HTMLElement;
      
      // Reset styling on the clone for clean image generation
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.width = "780px"; // standard desktop width of .invoice-a4
      clone.style.minHeight = "auto";
      clone.style.height = "auto";
      clone.style.margin = "0";
      clone.style.padding = "16px 20px";
      clone.style.transform = "none";
      clone.style.boxShadow = "none";
      
      document.body.appendChild(clone);

      // Render clone to high-res canvas
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 780,
        height: clone.scrollHeight,
      });

      // Cleanup cloned element from DOM
      document.body.removeChild(clone);

      const invoiceNum =
        currentReceipt.invoiceNo || currentReceipt.id.slice(-8).toUpperCase();
      const fileName = `Receipt_${invoiceNum}.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast("Failed to generate receipt image");
          setIsSharingReceipt(false);
          return;
        }

        const file = new File([blob], fileName, { type: "image/png" });

        // Check if Web Share API with files is supported
        if (
          typeof navigator !== "undefined" &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              title: `Receipt - ${invoiceNum}`,
              files: [file],
            });
            showToast("Receipt shared successfully!");
          } catch (err: any) {
            if (err?.name !== "AbortError") {
              downloadBlob(blob, fileName);
              showToast("Receipt image saved to Downloads!");
            }
          }
        } else {
          // Desktop or browsers without direct file sharing
          downloadBlob(blob, fileName);
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
              showToast("Receipt image downloaded & copied to clipboard!");
            } else {
              showToast("Receipt image saved to Downloads!");
            }
          } catch {
            showToast("Receipt image saved to Downloads!");
          }
        }
        setIsSharingReceipt(false);
      }, "image/png");
    } catch (err) {
      console.error("Error generating receipt image:", err);
      showToast("Error generating receipt image");
      setIsSharingReceipt(false);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleShowReceiptById = (saleId: string) => {
    const saleObj = sales.find((s) => s.id === saleId);
    if (saleObj) {
      setCurrentReceiptType("sale");
      setCurrentReceipt(saleToReceipt(saleObj));
      setActiveModal("receipt");
    }
  };

  const handleShowDebtReceipt = (debtObj: Debt) => {
    setCurrentReceiptType("debt");
    setCurrentDebtPaymentAmount(0); // View only mode
    setCurrentReceipt(debtToReceipt(debtObj));
    setActiveModal("receipt");
  };

  const handlePrint = () => {
    if (typeof document !== "undefined") {
      document.body.classList.add("print-a4-active");
      document.body.classList.remove("print-small-active");
    }
    window.print();
  };

  const handlePrintSmall = () => {
    if (typeof document !== "undefined") {
      document.body.classList.add("print-small-active");
      document.body.classList.remove("print-a4-active");
      
      const style = document.createElement("style");
      style.id = "small-print-page-style";
      style.innerHTML = "@page { size: auto; margin: 4mm 2mm; }";
      document.head.appendChild(style);
    }
    window.print();
  };

  if (!isMounted) {
    return <LoadingScreen />;
  }

  // --- RENDER SECURITY LOGIN OVERLAY ---
  if (!sessionActive) {
    return (
      <LoginScreen
        loginUserId={loginUserId}
        loginPin={loginPin}
        toast={toast}
        onUserChange={setLoginUserId}
        onPinChange={setLoginPin}
        onSubmit={handleLogin}
      />
    );
  }

  // --- RENDER MAIN INTERFACE ---
  return (
    <div className="app-container">
      <button
        type="button"
        onClick={() => syncState.conflicts ? setShowConflicts((value) => !value) : void synchronize()}
        title="Click to synchronize now"
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 900, border: 0, borderRadius: 999, padding: "8px 12px", background: syncState.failed ? "#9f2d20" : syncState.online ? "#173f35" : "#70551c", color: "white", fontSize: 12, cursor: "pointer" }}
      >
        {syncState.syncing ? "Syncing…" : !syncState.online ? `Offline · ${syncState.pending} pending` : syncState.failed ? `${syncState.failed} sync failed` : syncState.pending ? `${syncState.pending} pending` : syncState.conflicts ? `${syncState.conflicts} conflicts` : "Online · synced"}
      </button>
      {showConflicts && isOwner && (
        <div style={{ position: "fixed", right: 12, bottom: 56, width: 340, maxHeight: "60vh", overflow: "auto", zIndex: 901, background: "var(--paper-raised)", border: "1px solid var(--line-strong)", borderRadius: 12, padding: 14, boxShadow: "0 8px 28px rgba(0,0,0,.2)" }}>
          <strong>Reconciliation required</strong>
          {syncConflicts.map((conflict) => (
            <div key={conflict.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 13 }}>{conflict.type === "STOCK_SHORTAGE" ? "Stock fell below zero" : `Competing ${conflict.entityType} edit`}</div>
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => void resolveConflict(conflict.id, "server")}>Keep server</button>
                {conflict.type === "STALE_EDIT" && <button className="btn btn-primary btn-sm" onClick={() => void resolveConflict(conflict.id, "submitted")}>Use submitted</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <AppHeader
        shopName={shopNameDisplay}
        showSubtitle={showSubtitle}
        address={settings.address}
        phone={settings.phone}
        activeUser={activeUserObj}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />

      {/* DASHBOARD VIEW */}
      <DashboardView activeTab={activeTab}>
        <div className="stat-grid">
          <div className="stat stat-sales">
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,6V12H16V14H9V6H11Z"
              />
            </svg>
            <div className="num">{naira(todaySales)}</div>
            <div className="label">Today&apos;s Sales</div>
          </div>
          <div
            className="stat stat-lowstock"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveTab("inventory")}
          >
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z"
              />
            </svg>
            <div className="num">{lowStockItems.length}</div>
            <div className="label">Low Stock Items</div>
          </div>
          <div
            className="stat stat-debt"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveTab("debts")}
          >
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,2L21,5V11M12,4.8L6,6.8V11C6,15.22 8.76,19.34 12,20.8C15.24,19.34 18,15.22 18,11V6.8L12,4.8M11,10H13V15H11V10M11,7H13V9H11V7Z"
              />
            </svg>
            <div className="num">{naira(totalDebtsOwed)}</div>
            <div className="label">Total Owed</div>
          </div>
          <div className="stat stat-stockval">
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12,3L2,8L12,13L22,8L12,3M12,5.18L19.63,9L12,12.82L4.37,9L12,5.18M12,15L3,10.5V13.5L12,18L21,13.5V10.5L12,15M12,17.18L19.63,13.36V14.36L12,18.18L4.37,13.36V14.36L12,17.18Z"
              />
            </svg>
            <div className="num">{naira(totalStockValue)}</div>
            <div className="label">Stock Value</div>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="card" style={{ borderColor: "var(--rust)" }}>
            <div
              className="section-title"
              style={{ color: "var(--rust)", margin: "0 0 8px" }}
            >
              ⚠ Running Low
            </div>
            <div id="lowStockList">
              {lowStockItems.map((p) => (
                <div className="list-row" key={p.id}>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-stock low">
                    {p.stock} {p.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-columns">
          <div className="card">
            <div className="section-title">Quick Actions Panel</div>
            <div className="action-grid">
              <button
                className="action-btn"
                onClick={() => setActiveTab("sale")}
              >
                <span className="action-title">New Sale Checkout</span>
                <span className="action-desc">
                  Sell technical tools &amp; gear
                </span>
              </button>
              <button
                className="action-btn"
                onClick={() => setActiveTab("inventory")}
              >
                <span className="action-title">Stock Inventory</span>
                <span className="action-desc">
                  View products &amp; check levels
                </span>
              </button>
              <button
                className="action-btn"
                onClick={() => setActiveTab("debts")}
              >
                <span className="action-title">Debts &amp; Payments</span>
                <span className="action-desc">
                  Track customers owes &amp; histories
                </span>
              </button>
              {isOwner && (
                <button
                  className="action-btn"
                  onClick={() => setActiveTab("reports")}
                >
                  <span className="action-title">Business Reports</span>
                  <span className="action-desc">
                    Review sales metrics &amp; profits
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Recent Sales</div>
            <div id="recentSalesList">
              {recentSales.length === 0 ? (
                <div className="empty">No sales yet today</div>
              ) : (
                recentSales.map((s) => (
                  <div
                    className="list-row"
                    key={s.id}
                    onClick={() => handleShowReceiptById(s.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      <div className="prod-name">
                        {naira(s.total)}{" "}
                        {s.paymentType === "credit" ? (
                          <span className="badge badge-credit">Credit</span>
                        ) : (
                          ""
                        )}
                      </div>
                      <div className="prod-meta">
                        {s.customerName || "Walk-in"} · {s.staffName} ·{" "}
                        {new Date(s.date).toLocaleString("en-NG", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DashboardView>

      {/* INVENTORY VIEW */}
      <InventoryView activeTab={activeTab}>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products…"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
          />
        </div>
        <div className="card" style={{ paddingTop: "10px" }}>
          <div className="section-title" style={{ marginBottom: "6px" }}>
            All Products
          </div>
          <div id="inventoryList">
            {filteredProducts.length === 0 ? (
              <div className="empty">No products found</div>
            ) : (
              filteredProducts.map((p) => {
                const low = p.stock <= p.lowStock;
                return (
                  <div
                    className="list-row"
                    key={p.id}
                    onClick={() => handleOpenEditProduct(p)}
                  >
                    <div>
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-meta">
                        {p.category || "—"} · {naira(p.price)}/{p.unit}{" "}
                        {low ? (
                          <span className="badge badge-low">Low</span>
                        ) : (
                          ""
                        )}
                      </div>
                    </div>
                    <div className={`prod-stock ${low ? "low" : ""}`}>
                      {p.stock} {p.unit}
                      {p.stock !== 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </InventoryView>

      {/* SALE CHECKOUT VIEW */}
      <SaleView activeTab={activeTab}>
        <div className="sale-layout">
          <div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search to add product…"
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
              />
            </div>
            <div id="salePicker" className="card">
              {saleSearch.trim() === "" ? (
                <div className="empty">Start typing a product name</div>
              ) : salePickerProducts.length === 0 ? (
                <div className="empty">No matching product</div>
              ) : (
                salePickerProducts.map((p) => (
                  <div
                    className="list-row"
                    key={p.id}
                    onClick={() => addToCart(p.id)}
                  >
                    <div>
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-meta">
                        {naira(p.price)}/{p.unit} · {p.stock} in stock
                      </div>
                    </div>
                    <div style={{ fontSize: "20px", color: "var(--steel)" }}>
                      +
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="card">
              <div className="section-title">Cart</div>
              <div id="cartList">
                {cart.length === 0 ? (
                  <div className="empty">
                    Cart is empty — search above to add items
                  </div>
                ) : (
                  cart.map((c) => (
                    <div className="cart-item" key={c.productId}>
                      <div style={{ flex: 1 }}>
                        <div className="prod-name">{c.name}</div>
                        <div
                          className="prod-meta"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "4px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>Price: ₦</span>
                          <input
                            type="number"
                            className="cart-price-input"
                            value={c.price}
                            onChange={(e) =>
                              changePrice(c.productId, e.target.value)
                            }
                            min="0"
                            step="any"
                          />
                          <span>
                            × {c.qty} {c.unit} = {naira(c.price * c.qty)}
                          </span>
                        </div>
                      </div>
                      <div className="qty-ctrl">
                        <button onClick={() => changeQty(c.productId, -1)}>
                          −
                        </button>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            minWidth: "20px",
                            textAlign: "center",
                          }}
                        >
                          {c.qty}
                        </span>
                        <button onClick={() => changeQty(c.productId, 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cart-total-row">
                <span>Total</span>
                <span id="cartTotal">{naira(cartTotal)}</span>
              </div>
              <button
                className="btn btn-amber"
                style={{ marginTop: "12px" }}
                onClick={handleOpenCheckout}
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </SaleView>

      {/* QUICK SALE VIEW */}
      <QuickSaleView activeTab={activeTab}>
        <div className="sale-layout">
          {/* LEFT COLUMN: Custom Items Builder */}
          <div>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div className="section-title">Add Custom Item</div>
              <div className="field-grid" style={{ gridTemplateColumns: "1fr", gap: "12px" }}>
                <div className="field">
                  <label htmlFor="qs_itemName">Item Name / Description</label>
                  <input
                    id="qs_itemName"
                    type="text"
                    placeholder="Enter item name..."
                    value={quickItemName}
                    onChange={(e) => setQuickItemName(e.target.value)}
                  />
                </div>
                <div className="field-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  <div className="field">
                    <label htmlFor="qs_itemQty">Quantity</label>
                    <input
                      id="qs_itemQty"
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Qty"
                      value={quickItemQty}
                      onChange={(e) => setQuickItemQty(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="qs_itemUnit">Unit</label>
                    <input
                      id="qs_itemUnit"
                      type="text"
                      placeholder="e.g. pcs, bags"
                      value={quickItemUnit}
                      onChange={(e) => setQuickItemUnit(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="qs_itemPrice">Unit Price (₦)</label>
                    <input
                      id="qs_itemPrice"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Rate"
                      value={quickItemPrice}
                      onChange={(e) => setQuickItemPrice(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-amber"
                  style={{ marginTop: "8px", width: "100%" }}
                  onClick={addQuickItem}
                >
                  + Add Item to Receipt
                </button>
              </div>
            </div>

            <div className="card">
              <div className="section-title">Receipt Items</div>
              <div id="quickCartList">
                {quickCart.length === 0 ? (
                  <div className="empty">No custom items added yet</div>
                ) : (
                  quickCart.map((item) => (
                    <div className="list-row" key={item.productId} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", marginBottom: "8px", borderRadius: "6px" }}>
                      <div style={{ flex: 1 }}>
                        <div className="prod-name" style={{ fontWeight: 600 }}>{item.name}</div>
                        <div className="prod-meta" style={{ marginTop: "4px" }}>
                          {item.qty} {item.unit} × {naira(item.price)} = <strong>{naira(item.price * item.qty)}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ color: "var(--rust)", borderColor: "rgba(159,45,32,0.2)", width: "auto" }}
                        onClick={() => removeQuickItem(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
              {quickCart.length > 0 && (
                <div className="cart-total-row" style={{ marginTop: "12px", borderTop: "1px solid var(--line-strong)", paddingTop: "12px" }}>
                  <span>Subtotal</span>
                  <strong>{naira(quickCartTotal)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Quick Checkout Panel */}
          <div>
            <div className="card">
              <div className="section-title">Quick Receipt Details</div>
              
              <div className="field-grid" style={{ gridTemplateColumns: "1fr", gap: "10px" }}>
                <div className="field">
                  <label htmlFor="qs_customerName">Customer Name</label>
                  <input
                    id="qs_customerName"
                    type="text"
                    placeholder="Walk-in Customer (Default)"
                    value={quickCustomerName}
                    onChange={(e) => setQuickCustomerName(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="qs_customerPhone">Customer Phone</label>
                  <input
                    id="qs_customerPhone"
                    type="text"
                    placeholder="Phone number..."
                    value={quickCustomerPhone}
                    onChange={(e) => setQuickCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="qs_customerAddress">Customer Address</label>
                  <input
                    id="qs_customerAddress"
                    type="text"
                    placeholder="Address details..."
                    value={quickCustomerAddress}
                    onChange={(e) => setQuickCustomerAddress(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="qs_driver">Driver Name / Vehicle</label>
                  <input
                    id="qs_driver"
                    type="text"
                    placeholder="e.g. Driver John (Truck 4)"
                    value={quickDriver}
                    onChange={(e) => setQuickDriver(e.target.value)}
                  />
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "8px 0" }} />

                <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label htmlFor="qs_delivery">Delivery Fee (₦)</label>
                    <input
                      id="qs_delivery"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickDeliveryFee}
                      onChange={(e) => setQuickDeliveryFee(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="qs_discount">Discount (₦)</label>
                    <input
                      id="qs_discount"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickDiscount}
                      onChange={(e) => setQuickDiscount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="qs_paymentType">Payment Mode</label>
                  <select
                    id="qs_paymentType"
                    value={quickPaymentType}
                    onChange={(e) => setQuickPaymentType(e.target.value)}
                  >
                    <option value="cash">Cash / Full Payment</option>
                    <option value="credit">Credit (Owed / Balance)</option>
                  </select>
                </div>

                {quickPaymentType === "credit" && (
                  <div className="field">
                    <label htmlFor="qs_amountPaid">Amount Paid Now (₦)</label>
                    <input
                      id="qs_amountPaid"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={quickAmountPaid}
                      onChange={(e) => setQuickAmountPaid(e.target.value)}
                    />
                  </div>
                )}

                {quickPaymentType !== "credit" && (
                  <div style={{ marginTop: "4px", padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                    <div className="section-title" style={{ fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", opacity: 0.8 }}>Split Payment Breakdown</div>
                    <div className="field-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor="qs_payCash" style={{ fontSize: "10px" }}>Cash Portion</label>
                        <input
                          id="qs_payCash"
                          type="number"
                          placeholder="₦"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={quickPayCash}
                          onChange={(e) => setQuickPayCash(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="qs_payT1" style={{ fontSize: "10px" }}>Transfer 1</label>
                        <input
                          id="qs_payT1"
                          type="number"
                          placeholder="₦"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={quickPayTransfer1}
                          onChange={(e) => setQuickPayTransfer1(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="qs_payT2" style={{ fontSize: "10px" }}>Transfer 2</label>
                        <input
                          id="qs_payT2"
                          type="number"
                          placeholder="₦"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={quickPayTransfer2}
                          onChange={(e) => setQuickPayTransfer2(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="cart-total-row" style={{ marginTop: "10px", padding: "10px 0", borderTop: "2px double var(--line-strong)" }}>
                  <span style={{ fontSize: "15px", fontWeight: "bold" }}>Grand Total</span>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: "var(--amber)" }}>{naira(quickGrandTotal)}</span>
                </div>

                <button
                  type="button"
                  className="btn btn-amber btn-lg"
                  style={{ width: "100%", padding: "12px", fontSize: "15px", fontWeight: "bold" }}
                  onClick={handleCompleteQuickSale}
                >
                  Generate & Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      </QuickSaleView>

      {/* SALES LOG VIEW */}
      <SalesLogView activeTab={activeTab}>
        <div className="stat-grid">
          <div className="stat stat-sales">
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M10 16h4v-2h-4v2zm3-11H11v6h2V5zm-1-3C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
              />
            </svg>
            <div className="num">{salesLogSummary.count}</div>
            <div className="label">Total Invoices</div>
          </div>
          <div className="stat stat-stockval">
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M5 6h14v2H5V6zm0 4h14v2H5v-2zm0 4h14v2H5v-2zm0 4h14v2H5v-2z"
              />
            </svg>
            <div className="num">{naira(salesLogSummary.totalSalesVal)}</div>
            <div className="label">Total Sales</div>
          </div>
          <div
            className="stat stat-debt"
            style={{ background: "linear-gradient(135deg, #104080, #0c3060)" }}
          >
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"
              />
            </svg>
            <div className="num">{naira(salesLogSummary.cashVal)}</div>
            <div className="label">Cash Sales</div>
          </div>
          <div
            className="stat stat-lowstock"
            style={{ background: "linear-gradient(135deg, #cc8b2b, #8a5714)" }}
          >
            <svg className="stat-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"
              />
            </svg>
            <div className="num">{naira(salesLogSummary.creditVal)}</div>
            <div className="label">Credit Sales</div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Filter Transactions Database</div>
          <div
            className="field-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
            }}
          >
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Search Query</label>
              <input
                type="text"
                placeholder="Invoice #, customer, item, or staff..."
                value={salesLogSearch}
                onChange={(e) => setSalesLogSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Date Period</label>
              <select
                value={salesLogPeriod}
                onChange={(e) => setSalesLogPeriod(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select
                value={salesLogType}
                onChange={(e) => setSalesLogType(e.target.value)}
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash / Full</option>
                <option value="credit">Credit (Owed)</option>
              </select>
            </div>
            <div className="field">
              <label>Issued By (Staff)</label>
              <select
                value={salesLogStaff}
                onChange={(e) => setSalesLogStaff(e.target.value)}
              >
                <option value="all">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ paddingTop: "10px" }}>
          <div className="section-title" style={{ marginBottom: "6px" }}>
            Transaction Ledger
          </div>
          <div id="saleslog-list">
            {salesLogSummary.filtered.length === 0 ? (
              <div className="empty">
                No matching transactions found in the database.
              </div>
            ) : (
              salesLogSummary.filtered
                .slice()
                .reverse()
                .map((s) => {
                  const itemsPreview = s.items.map((i) => (
                    <span key={i.productId} className="saleslog-item-tag">
                      {i.name} x{i.qty}
                    </span>
                  ));
                  const badgeClass =
                    s.paymentType === "credit" ? "badge-credit" : "badge-ok";
                  const badgeText =
                    s.paymentType === "credit" ? "Credit" : "Cash";
                  const dateFormatted = new Date(s.date).toLocaleString(
                    "en-NG",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  );
                  return (
                    <div className="saleslog-row" key={s.id}>
                      <div className="saleslog-col-main">
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: "var(--steel)",
                          }}
                        >
                          {s.invoiceNo || s.id.slice(-8).toUpperCase()}
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "13.5px",
                            marginTop: "2px",
                          }}
                        >
                          {s.customerName}
                        </div>
                        <div
                          className="prod-meta"
                          style={{ fontSize: "11.5px", marginTop: "2px" }}
                        >
                          {dateFormatted}
                        </div>
                      </div>

                      <div className="saleslog-col-items">{itemsPreview}</div>

                      <div className="saleslog-col-meta">
                        <div
                          className="prod-stock"
                          style={{ fontSize: "16px", color: "var(--ink)" }}
                        >
                          {naira(s.total)}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span className={`badge ${badgeClass}`}>
                            {badgeText}
                          </span>
                          {s.paymentType === "credit" && s.balance > 0 && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "var(--rust)",
                                fontWeight: 700,
                              }}
                            >
                              Bal: {naira(s.balance)}
                            </span>
                          )}
                        </div>
                        <div
                          className="prod-meta"
                          style={{ fontSize: "11px", marginTop: "1px" }}
                        >
                          By: {s.staffName}
                        </div>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{
                            marginTop: "6px",
                            padding: "4px 8px",
                            fontSize: "11.5px",
                            width: "auto",
                            height: "auto",
                            minHeight: "auto",
                          }}
                          onClick={() => handleShowReceiptById(s.id)}
                        >
                          View Receipt
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </SalesLogView>

      {/* DEBTS VIEW */}
      <DebtsView activeTab={activeTab}>
        <div className="card">
          <div className="section-title">Customer Debts (Credit)</div>
          <div id="debtsList">
            {activeDebts.length === 0 ? (
              <div className="empty">No outstanding debts 🎉</div>
            ) : (
              activeDebts
                .slice()
                .reverse()
                .map((d) => (
                  <div className="list-row" key={d.id}>
                    <div>
                      <div
                        className="prod-name"
                        style={{
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                        onClick={() => handleShowDebtReceipt(d)}
                      >
                        {d.customerName}
                      </div>
                      <div className="prod-meta">
                        {d.phone ? d.phone + " · " : ""}since{" "}
                        {new Date(d.date).toLocaleDateString("en-NG")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="prod-stock low">{naira(d.balance)}</div>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ marginTop: "4px" }}
                        onClick={() => handleOpenDebtPayment(d)}
                      >
                        Add Payment
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </DebtsView>

      {/* REPORTS VIEW */}
      <ReportsView activeTab={activeTab}>
        <div className="card">
          <div className="section-title">Reports</div>
          <select
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div className="card">
          <div className="section-title">Best Sellers</div>
          <div id="bestSellers">
            {reportsData.bestSellers.length === 0 ? (
              <div className="empty">No sales in this range</div>
            ) : (
              reportsData.bestSellers.map(([name, qty]) => (
                <div className="list-row" key={name}>
                  <div className="prod-name">{name}</div>
                  <div className="prod-stock">{qty} sold</div>
                </div>
              ))
            )}
          </div>
        </div>

        {isOwner && (
          <div className="card" id="profitCard">
            <div className="section-title">Profit</div>
            <div id="profitReport">
              <div className="ticket-row" style={{ fontSize: "14px" }}>
                <span>Revenue</span>
                <span>{naira(reportsData.revenue)}</span>
              </div>
              <div
                className="ticket-row"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--green)",
                }}
              >
                <span>Profit</span>
                <span>{naira(reportsData.profit)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-title">Low Stock</div>
          <div id="reportLowStock">
            {lowStockItems.length === 0 ? (
              <div className="empty">All stock levels healthy</div>
            ) : (
              lowStockItems.map((p) => (
                <div className="list-row" key={p.id}>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-stock low">
                    {p.stock} {p.unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ReportsView>

      <Navigation
        activeTab={activeTab}
        isOwner={Boolean(isOwner)}
        hasLowStock={lowStockItems.length > 0}
        hasDebt={totalDebtsOwed > 0}
        onTabChange={setActiveTab}
        onAddProduct={handleOpenAddProduct}
      />

      {/* --- MODALS BACKDROPS --- */}

      {/* MODAL: ADD/EDIT PRODUCT */}
      <ProductDialog activeModal={activeModal}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            ✕
          </button>
          <div className="modal-title">
            {editingProduct ? "Edit Product" : "Add Product"}
          </div>

          <form onSubmit={handleSaveProduct}>
            <div className="field-grid">
              <div className="field">
                <label>Product Name</label>
                <input
                  name="p_name"
                  defaultValue={editingProduct ? editingProduct.name : ""}
                  placeholder="e.g. Cement (Dangote 50kg)"
                />
              </div>
              <div className="field">
                <label>Category</label>
                <input
                  name="p_category"
                  defaultValue={editingProduct ? editingProduct.category : ""}
                  placeholder="e.g. Cement, Nails, Roofing"
                />
              </div>
              <div className="field">
                <label>Unit of Sale</label>
                <select
                  name="p_unit"
                  defaultValue={editingProduct ? editingProduct.unit : "bag"}
                >
                  <option value="bag">bag</option>
                  <option value="piece">piece</option>
                  <option value="box">box</option>
                  <option value="bundle">bundle</option>
                  <option value="kg">kg</option>
                  <option value="ton">ton</option>
                  <option value="litre">litre</option>
                  <option value="bucket">bucket</option>
                  <option value="roll">roll</option>
                  <option value="pack">pack</option>
                </select>
              </div>
              <div className="field">
                <label>Current Stock</label>
                <input
                  name="p_stock"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={editingProduct ? editingProduct.stock : ""}
                  placeholder="0"
                />
              </div>
              <div className="field">
                <label>Low Stock Alert Below</label>
                <input
                  name="p_lowStock"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={editingProduct ? editingProduct.lowStock : ""}
                  placeholder="e.g. 10"
                />
              </div>
              {isOwner && (
                <div className="field owner-only">
                  <label>Cost Price (₦ per unit)</label>
                  <input
                    name="p_cost"
                    type="number"
                    min="0"
                    defaultValue={editingProduct ? editingProduct.cost : ""}
                    placeholder="0"
                  />
                </div>
              )}
              <div className="field">
                <label>Selling Price (₦ per unit)</label>
                <input
                  name="p_price"
                  type="number"
                  min="0"
                  defaultValue={editingProduct ? editingProduct.price : ""}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: "16px" }}>
              {editingProduct && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleDeleteProduct}
                >
                  Delete
                </button>
              )}
              <button type="submit" className="btn btn-primary">
                Save Product
              </button>
            </div>
          </form>
        </div>
      </ProductDialog>

      {/* MODAL: CHECKOUT */}
      <CheckoutDialog activeModal={activeModal}>
        <div className="modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <div className="modal-handle"></div>
          <button
            className="modal-back"
            onClick={() => setActiveModal("confirm-cancel")}
          >
            ←
          </button>
          <button
            className="modal-close"
            onClick={() => setActiveModal("confirm-cancel")}
          >
            ✕
          </button>
          <div className="modal-title" style={{ paddingLeft: "28px" }}>
            Checkout &amp; Invoice Details
          </div>

          <div className="field-grid">
            <div className="field">
              <label>Payment Type</label>
              <select
                value={checkoutForm.paymentType}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    paymentType: e.target.value,
                  })
                }
              >
                <option value="cash">Cash / Full Payment</option>
                <option value="credit">Credit (Pay Later)</option>
              </select>
            </div>
            <div className="field">
              <label>Customer Name</label>
              <input
                value={checkoutForm.customerName}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    customerName: e.target.value,
                  })
                }
                placeholder="Customer name"
              />
            </div>
            <div className="field">
              <label>Customer Phone</label>
              <input
                value={checkoutForm.customerPhone}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    customerPhone: e.target.value,
                  })
                }
                placeholder="080…"
                type="tel"
              />
            </div>
            <div className="field">
              <label>Customer Address</label>
              <input
                value={checkoutForm.customerAddress}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    customerAddress: e.target.value,
                  })
                }
                placeholder="Customer address"
              />
            </div>

            {checkoutForm.paymentType === "credit" && (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Amount Paid Now (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={checkoutForm.amountPaid}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      amountPaid: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div
            className="field-grid"
            style={{
              marginTop: "10px",
              borderTop: "1px solid var(--line)",
              paddingTop: "10px",
            }}
          >
            <div
              className="field"
              style={{ gridColumn: "1 / -1", marginBottom: "2px" }}
            >
              <label style={{ fontWeight: 700, color: "var(--steel-dark)" }}>
                Delivery &amp; Logistics (Optional)
              </label>
            </div>
            <div className="field">
              <label>Driver Name</label>
              <input
                value={checkoutForm.driver}
                onChange={(e) =>
                  setCheckoutForm({ ...checkoutForm, driver: e.target.value })
                }
                placeholder="Driver name"
              />
            </div>
            <div className="field">
              <label>Car / Vehicle Details</label>
              <input
                value={checkoutForm.car}
                onChange={(e) =>
                  setCheckoutForm({ ...checkoutForm, car: e.target.value })
                }
                placeholder="e.g. Toyota Hilux (White)"
              />
            </div>
            <div className="field">
              <label>Delivery Fee (₦)</label>
              <input
                type="number"
                min="0"
                value={checkoutForm.deliveryFee}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    deliveryFee: e.target.value,
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Discount (₦)</label>
              <input
                type="number"
                min="0"
                value={checkoutForm.discount}
                onChange={(e) =>
                  setCheckoutForm({ ...checkoutForm, discount: e.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div
            className="field-grid"
            style={{
              marginTop: "10px",
              borderTop: "1px solid var(--line)",
              paddingTop: "10px",
            }}
          >
            <div
              className="field"
              style={{ gridColumn: "1 / -1", marginBottom: "2px" }}
            >
              <label style={{ fontWeight: 700, color: "var(--steel-dark)" }}>
                Settlement Breakdown (Optional)
              </label>
            </div>
            <div className="field">
              <label>Cash Paid (₦)</label>
              <input
                type="number"
                min="0"
                value={checkoutForm.payCash}
                onChange={(e) =>
                  setCheckoutForm({ ...checkoutForm, payCash: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Transfer 1 Paid (₦)</label>
              <input
                type="number"
                min="0"
                value={checkoutForm.payTransfer1}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    payTransfer1: e.target.value,
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Transfer 2 Paid (₦)</label>
              <input
                type="number"
                min="0"
                value={checkoutForm.payTransfer2}
                onChange={(e) =>
                  setCheckoutForm({
                    ...checkoutForm,
                    payTransfer2: e.target.value,
                  })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div
            id="checkoutSummary"
            style={{
              marginTop: "14px",
              background: "rgba(0,0,0,0.03)",
              padding: "10px",
              borderRadius: "4px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {checkoutSummary.summaryHtml}
          </div>

          <button
            className="btn btn-amber"
            style={{ marginTop: "14px", width: "100%" }}
            onClick={handleCompleteSale}
          >
            Complete Sale &amp; Generate E-Invoice
          </button>
        </div>
      </CheckoutDialog>

      {/* MODAL: CONFIRM CANCEL CHECKOUT */}
      <CancelCheckoutDialog activeModal={activeModal}>
        <div
          className="modal"
          style={{ maxWidth: "400px", textAlign: "center" }}
        >
          <div className="modal-title">Cancel Checkout?</div>
          <p
            style={{
              marginBottom: "20px",
              color: "var(--ink-soft)",
              fontSize: "14.5px",
            }}
          >
            Are you sure you want to cancel the checkout? Your cart items will
            be saved.
          </p>
          <div className="btn-row">
            <button
              className="btn btn-ghost"
              onClick={() => setActiveModal("checkout")}
            >
              No, Continue
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setActiveModal(null)}
            >
              Yes, Cancel
            </button>
          </div>
        </div>
      </CancelCheckoutDialog>

      {/* MODAL: RECEIPT DISPLAY */}
      <ReceiptDialog activeModal={activeModal}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button
            className="modal-close"
            onClick={() => {
              setActiveModal(null);
              setActiveTab("dashboard");
            }}
          >
            ✕
          </button>

          <div id="printArea">
            {currentReceipt && (
              <>
                <div className="invoice-a4">
                <svg
                  className="invoice-ribbon-top"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z"
                    fill="#104080"
                  />
                  <path
                    d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z"
                    fill="#E67E22"
                  />
                  <path
                    d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z"
                    fill="#1B8B3E"
                  />
                </svg>
                <svg
                  className="invoice-ribbon-bottom"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z"
                    fill="#104080"
                  />
                  <path
                    d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z"
                    fill="#E67E22"
                  />
                  <path
                    d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z"
                    fill="#1B8B3E"
                  />
                </svg>

                <div className="inv-header">
                  <div className="inv-logo-col">
                    <img
                      src="/Prince Iyke logo.png"
                      alt="Prince Iyke Logo"
                      className="inv-logo-img"
                    />
                  </div>
                  <div className="inv-title-block">
                    <div className="inv-brand-title">PRINCE IYKE</div>
                    <div className="inv-brand-sub">
                      BUILDING AND TECHNICAL TOOLS MERCHANTS
                    </div>
                    <div className="inv-brand-div">
                      (A Division of Obiezu Holding)
                    </div>
                    <div className="inv-brand-rc">RC: 3620072</div>
                    <div className="inv-brand-deals">
                      Ultimate in Building Material such as Cement, Zinc, Nails,
                      Spade, Wheelbarrow, Paints, Welding/Filling Machine,
                      General Supplies &amp; General Merchants
                    </div>
                    <div className="inv-brand-address">
                      <strong>Head Office:</strong> 57 New Timber Road after
                      Apostolic Church Mbiabong Anyanya, Uyo.{" "}
                      <span className="inv-tel-red">
                        Tel: 08036722968, 08026078120
                      </span>
                    </div>
                    <div className="inv-brand-address">
                      <strong>Branch Office:</strong> 223 Oron Road, Mbiabong
                      Park U-turn, Uyo, Akwa Ibom State
                    </div>
                    <div className="inv-brand-address">
                      Ariria Int’l Market, Aba, Abia State.{" "}
                      <span className="inv-tel-red">Tel: 08035586953</span>
                    </div>
                  </div>
                  <div className="inv-logo-spacer" aria-hidden="true"></div>
                </div>

                {currentReceiptType === "debt" && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "-6px",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: "#104080",
                        border: "2px solid #104080",
                        padding: "3px 12px",
                        borderRadius: "4px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {currentReceipt.balance <= 0
                        ? "Debt Clearance Receipt"
                        : "Debt Payment Receipt"}
                    </span>
                  </div>
                )}

                <div className="inv-details-grid">
                  <div className="inv-details-col">
                    <div className="inv-col-title">Party Details:</div>
                    <div className="inv-field">
                      <span className="inv-label">Customer Name</span>
                      <span className="inv-val">
                        {currentReceipt.customerName}
                      </span>
                    </div>
                    <div className="inv-field">
                      <span className="inv-label">Address</span>
                      <span className="inv-val">
                        {currentReceipt.customerAddress || "Walk-in Customer"}
                      </span>
                    </div>
                    <div className="inv-field">
                      <span className="inv-label">Phone</span>
                      <span className="inv-val">
                        {currentReceipt.customerPhone ||
                          currentReceipt.phone ||
                          "—"}
                      </span>
                    </div>
                  </div>
                  <div className="inv-details-col">
                    <div className="inv-col-title">Invoice/Ledger Details:</div>
                    <div className="inv-field">
                      <span className="inv-label">Invoice No.</span>
                      <span
                        className="inv-val"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                        }}
                      >
                        {currentReceipt.invoiceNo ||
                          currentReceipt.id.slice(-8).toUpperCase()}
                      </span>
                    </div>
                    <div className="inv-field">
                      <span className="inv-label">Dated</span>
                      <span className="inv-val">
                        {new Date(currentReceipt.date).toLocaleDateString(
                          "en-NG",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>
                    <div className="inv-field">
                      <span className="inv-label">Staff/REP</span>
                      <span className="inv-val">
                        {currentReceipt.staffName || "System"}
                      </span>
                    </div>
                    {currentReceiptType === "sale" && (
                      <>
                        <div className="inv-field">
                          <span className="inv-label">Driver</span>
                          <span className="inv-val">
                            {currentReceipt.driver || "—"}
                          </span>
                        </div>
                        <div className="inv-field">
                          <span className="inv-label">Car</span>
                          <span className="inv-val">
                            {currentReceipt.car || "—"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {currentReceiptType === "sale" ? (
                  <>
                    <table className="inv-table">
                      <thead>
                        <tr>
                          <th style={{ width: "6%" }} className="center-col">
                            S/N.
                          </th>
                          <th style={{ width: "12%" }}>Reference</th>
                          <th style={{ width: "44%" }}>Description of Goods</th>
                          <th style={{ width: "8%" }} className="center-col">
                            Qty.
                          </th>
                          <th style={{ width: "8%" }} className="center-col">
                            Unit
                          </th>
                          <th style={{ width: "10%" }} className="num-col">
                            Price
                          </th>
                          <th style={{ width: "12%" }} className="num-col">
                            Amount (NGN)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReceipt.items.map((i, index) => (
                          <tr key={i.productId}>
                            <td className="center-col">{index + 1}</td>
                            <td>
                              {i.productId
                                ? i.productId.slice(-5).toUpperCase()
                                : "GOODS"}
                            </td>
                            <td>{i.name}</td>
                            <td className="center-col">{i.qty}</td>
                            <td className="center-col">{i.unit}</td>
                            <td className="num-col">{naira(i.price)}</td>
                            <td className="num-col">{naira(i.subtotal)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={5} className="inv-summary-label">
                            Add: DELIVERY FEE
                          </td>
                          <td
                            colSpan={2}
                            className="num-col"
                            style={{ fontWeight: 600 }}
                          >
                            {naira(currentReceipt.deliveryFee)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={5} className="inv-summary-label">
                            Less: DISCOUNT
                          </td>
                          <td
                            colSpan={2}
                            className="num-col"
                            style={{ fontWeight: 600, color: "var(--red)" }}
                          >
                            {naira(currentReceipt.discount)}
                          </td>
                        </tr>
                        <tr className="inv-grand-total-row">
                          <td
                            colSpan={5}
                            className="inv-summary-label"
                            style={{ fontSize: "11px", color: "#1B8B3E" }}
                          >
                            Grand Total
                          </td>
                          <td
                            colSpan={2}
                            className="num-col"
                            style={{
                              fontSize: "12px",
                              fontWeight: 800,
                              color: "#1B8B3E",
                            }}
                          >
                            {naira(currentReceipt.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="inv-words-box">
                      <span className="inv-words-title">In Words:</span>
                      <span className="inv-words-text">
                        {formatGrandTotalInWords(currentReceipt.total)} Naira
                        Only
                      </span>
                    </div>

                    <div className="inv-footer-grid">
                      <div className="inv-settle-box">
                        <div className="inv-settle-title">
                          Settlement Details
                        </div>
                        <div className="inv-settle-row">
                          <span className="inv-settle-label">
                            PREVIOUS BAL:
                          </span>
                          <span className="inv-settle-val">{naira(0)}</span>
                        </div>
                        <div className="inv-settle-row">
                          <span className="inv-settle-label">CASH :</span>
                          <span className="inv-settle-val">
                            {naira(currentReceipt.payCash)}
                          </span>
                        </div>
                        <div className="inv-settle-row">
                          <span className="inv-settle-label">TRANSFER 1 :</span>
                          <span className="inv-settle-val">
                            {naira(currentReceipt.payTransfer1)}
                          </span>
                        </div>
                        <div className="inv-settle-row">
                          <span className="inv-settle-label">TRANSFER 2 :</span>
                          <span className="inv-settle-val">
                            {naira(currentReceipt.payTransfer2)}
                          </span>
                        </div>
                        <div
                          className="inv-settle-row"
                          style={{ fontWeight: 700 }}
                        >
                          <span className="inv-settle-label">
                            ACC. BALANCE :
                          </span>
                          <span className="inv-settle-val">
                            {naira(currentReceipt.balance)}
                          </span>
                        </div>
                      </div>

                      <div className="inv-stamp-box">
                        <div className="inv-stamp-brand1">PRINCE IYKE</div>
                        <div className="inv-stamp-brand2">
                          BUILDING &amp; TECHNICAL TOOLS MERCHANTS
                        </div>
                        <div className="inv-stamp-paid">PAID</div>
                        <div className="inv-stamp-date">
                          DATE:{" "}
                          {new Date(currentReceipt.date).toLocaleDateString(
                            "en-NG",
                          )}
                        </div>
                        <div className="inv-stamp-sig-line">
                          Customer Signature
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#104080",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Outstanding Account Summary:
                    </div>
                    <div
                      className="inv-footer-grid"
                      style={{ gridTemplateColumns: "1.2fr 0.8fr" }}
                    >
                      <div className="inv-settle-box">
                        <div className="inv-settle-title">
                          Clearance Statement
                        </div>
                        <div className="inv-settle-row">
                          <span className="inv-settle-label">
                            ORIGINAL DEBT:
                          </span>
                          <span className="inv-settle-val">
                            {naira(currentReceipt.originalAmount)}
                          </span>
                        </div>
                        {currentReceipt.payments.map((p, idx) => (
                          <div className="inv-settle-row" key={idx}>
                            <span className="inv-settle-label">
                              PAYMENT #{idx + 1} (
                              {new Date(p.date).toLocaleDateString("en-NG")}):
                            </span>
                            <span className="inv-settle-val">
                              {naira(p.amount)}
                            </span>
                          </div>
                        ))}
                        <div
                          className="inv-settle-row"
                          style={{
                            fontWeight: 700,
                            borderTop: "1px dashed #ccc",
                            paddingTop: "4px",
                          }}
                        >
                          <span className="inv-settle-label">
                            OUTSTANDING BAL:
                          </span>
                          <span
                            className="inv-settle-val"
                            style={{
                              color:
                                currentReceipt.balance <= 0
                                  ? "#1B8B3E"
                                  : "#D32F2F",
                            }}
                          >
                            {naira(currentReceipt.balance)}
                          </span>
                        </div>
                      </div>

                      <div className="inv-stamp-box">
                        <div className="inv-stamp-brand1">PRINCE IYKE</div>
                        <div className="inv-stamp-brand2">
                          BUILDING &amp; TECHNICAL TOOLS MERCHANTS
                        </div>
                        <div
                          className="inv-stamp-paid"
                          style={{
                            color:
                              currentReceipt.balance <= 0
                                ? "#1B8B3E"
                                : "#E67E22",
                          }}
                        >
                          {currentReceipt.balance <= 0
                            ? "DEBT CLEARED"
                            : "PARTIAL PYMT"}
                        </div>
                        <div className="inv-stamp-date">
                          DATE: {new Date().toLocaleDateString("en-NG")}
                        </div>
                        <div className="inv-stamp-sig-line">
                          Customer Signature
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="inv-bottom-bar">
                  <div className="inv-thanks">
                    {currentReceiptType === "sale" ||
                    currentReceipt.balance <= 0
                      ? "Thank you for your patronage!"
                      : "Thank you for your payment!"}
                  </div>
                  <div className="inv-for-brand">
                    For PRINCE IYKE BUILDING &amp; TECHNICAL TOOLS MERCHANTS
                  </div>
                  <div className="inv-auth-line">Authorised Signatory</div>
                </div>
              </div>

              <div className="ticket small-receipt">
                <div className="ticket-shop">PRINCE IYKE</div>
                <div className="ticket-sub" style={{ textTransform: "uppercase", fontWeight: "bold" }}>
                  Building &amp; Technical Tools Merchants
                </div>
                <div className="ticket-sub">(A Division of Obiezu Holding)</div>
                <div className="ticket-sub">RC: 3620072</div>
                <div className="ticket-sub" style={{ fontSize: "9px", marginTop: "4px" }}>
                  HQ: 57 New Timber Rd, Uyo. Tel: 08036722968
                </div>

                <div className="ticket-hr"></div>

                <div className="ticket-row">
                  <span>Invoice No:</span>
                  <span style={{ fontWeight: "bold" }}>
                    {currentReceipt.invoiceNo || currentReceipt.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="ticket-row">
                  <span>Date:</span>
                  <span>{new Date(currentReceipt.date).toLocaleString("en-NG")}</span>
                </div>
                <div className="ticket-row">
                  <span>Customer:</span>
                  <span>{currentReceipt.customerName || "Walk-in Customer"}</span>
                </div>
                {currentReceipt.customerPhone && (
                  <div className="ticket-row">
                    <span>Phone:</span>
                    <span>{currentReceipt.customerPhone}</span>
                  </div>
                )}
                {currentReceipt.customerAddress && (
                  <div className="ticket-row">
                    <span>Address:</span>
                    <span>{currentReceipt.customerAddress}</span>
                  </div>
                )}
                <div className="ticket-row">
                  <span>Payment:</span>
                  <span style={{ textTransform: "uppercase" }}>{currentReceipt.paymentType}</span>
                </div>
                {currentReceipt.driver && (
                  <div className="ticket-row">
                    <span>Driver:</span>
                    <span>
                      {currentReceipt.driver} {currentReceipt.car ? `(${currentReceipt.car})` : ""}
                    </span>
                  </div>
                )}

                <div className="ticket-hr"></div>

                <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px", textAlign: "center" }}>
                  --- ITEMS ---
                </div>
                {currentReceipt.items.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: "6px" }}>
                    <div className="ticket-item-row" style={{ margin: "0", fontWeight: "500" }}>
                      <span className="ticket-item-name">
                        {idx + 1}. {item.name}
                      </span>
                      <span>{naira(item.subtotal)}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#555", paddingLeft: "12px" }}>
                      {item.qty} {item.unit} x {naira(item.price)}
                    </div>
                  </div>
                ))}

                <div className="ticket-hr"></div>

                <div className="ticket-row">
                  <span>Subtotal:</span>
                  <span>{naira(currentReceipt.cartSubtotal)}</span>
                </div>
                {currentReceipt.deliveryFee > 0 && (
                  <div className="ticket-row">
                    <span>Delivery Fee:</span>
                    <span>{naira(currentReceipt.deliveryFee)}</span>
                  </div>
                )}
                {currentReceipt.discount > 0 && (
                  <div className="ticket-row">
                    <span>Discount:</span>
                    <span>-{naira(currentReceipt.discount)}</span>
                  </div>
                )}

                <div className="ticket-total" style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0" }}>
                  <span>TOTAL:</span>
                  <span>{naira(currentReceipt.total)}</span>
                </div>

                <div className="ticket-hr"></div>

                <div className="ticket-row">
                  <span>Amount Paid:</span>
                  <span>{naira(currentReceipt.amountPaid)}</span>
                </div>
                <div className="ticket-row" style={{ fontWeight: "bold" }}>
                  <span>Balance Due:</span>
                  <span style={{ color: currentReceipt.balance <= 0 ? "#1B8B3E" : "#D32F2F" }}>
                    {naira(currentReceipt.balance)}
                  </span>
                </div>

                {(currentReceipt.payCash > 0 || currentReceipt.payTransfer1 > 0 || currentReceipt.payTransfer2 > 0) && (
                  <div style={{ fontSize: "10px", color: "#555", marginTop: "4px", textAlign: "center" }}>
                    Payments: {[
                      currentReceipt.payCash > 0 && `Cash: ${naira(currentReceipt.payCash)}`,
                      currentReceipt.payTransfer1 > 0 && `Transfer 1: ${naira(currentReceipt.payTransfer1)}`,
                      currentReceipt.payTransfer2 > 0 && `Transfer 2: ${naira(currentReceipt.payTransfer2)}`,
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </div>
                )}

                {currentReceiptType === "debt" && currentReceipt.payments && currentReceipt.payments.length > 0 && (
                  <>
                    <div className="ticket-hr"></div>
                    <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "4px", textAlign: "center" }}>
                      --- DEBT STATEMENT ---
                    </div>
                    <div className="ticket-row">
                      <span>Original Debt:</span>
                      <span>{naira(currentReceipt.originalAmount)}</span>
                    </div>
                    {currentReceipt.payments.map((p, idx) => (
                      <div className="ticket-row" key={idx} style={{ fontSize: "11px", color: "#555" }}>
                        <span>
                          Payment #{idx + 1} ({new Date(p.date).toLocaleDateString("en-NG")}):
                        </span>
                        <span>{naira(p.amount)}</span>
                      </div>
                    ))}
                    <div
                      className="ticket-row"
                      style={{
                        fontWeight: "bold",
                        borderTop: "1px dashed #ccc",
                        paddingTop: "4px",
                        marginTop: "4px",
                      }}
                    >
                      <span>Outstanding Bal:</span>
                      <span>{naira(currentReceipt.balance)}</span>
                    </div>
                  </>
                )}

                <div className="ticket-hr"></div>

                <div className="ticket-foot">
                  {currentReceiptType === "sale" || currentReceipt.balance <= 0
                    ? "Thank you for your patronage!"
                    : "Thank you for your payment!"}
                </div>
                <div className="ticket-foot" style={{ fontSize: "9px", marginTop: "4px", textTransform: "uppercase" }}>
                  PRINCE IYKE MERCHANTS
                </div>
              </div>
            </>
          )}
        </div>

          <div className="btn-row" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
            <button className="btn btn-ghost" onClick={handlePrint}>
              Print
            </button>
            <button className="btn btn-ghost" onClick={handlePrintSmall}>
              Small receipt
            </button>
            <button
              className="btn btn-primary"
              onClick={handleShareReceipt}
              disabled={isSharingReceipt}
              style={{ flex: 1 }}
            >
              {isSharingReceipt ? "Generating Image..." : "Share"}
            </button>
          </div>
        </div>
      </ReceiptDialog>

      {/* MODAL: STAFF MANAGEMENT */}
      <StaffDialog activeModal={activeModal}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            ✕
          </button>
          <div className="modal-title">Staff Management</div>
          <div id="userPicker">
            {users.map((u) => (
              <div
                className="list-row"
                key={u.id}
                style={{ cursor: "default", flexWrap: "wrap", gap: "8px" }}
              >
                <div>
                  <div className="prod-name">
                    {u.name}{" "}
                    {u.id === activeUser ? (
                      <span style={{ color: "var(--steel)", fontSize: "12px" }}>
                        (Active)
                      </span>
                    ) : (
                      ""
                    )}
                  </div>
                  <div className="prod-meta">{u.role}{u.email ? ` · ${u.email}` : ""}</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginLeft: "auto",
                  }}
                >
                  {u.role !== "owner" ? (
                    <>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveStaff(u.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          width: "auto",
                          background: "var(--rust)",
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-soft)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Owner
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="ticket-hr"></div>
          <div className="field" style={{ marginTop: 0 }}>
            <label>Add New Staff</label>
            <div
              className="field-grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <input
                placeholder="Staff Name"
                value={newStaff.name}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, name: e.target.value })
                }
              />
              <input
                placeholder="Staff Email"
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              />
              <input
                placeholder="Temporary Password"
                type="password"
                value={newStaff.pin}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, pin: e.target.value })
                }
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddStaff}>
              Add Staff Member
            </button>
          </div>
        </div>
      </StaffDialog>

      {/* MODAL: SHOP SETTINGS */}
      <SettingsDialog activeModal={activeModal}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            ✕
          </button>
          <div className="modal-title">Shop Settings</div>

          <form onSubmit={handleSaveSettings}>
            <div className="field">
              <label>Shop Name</label>
              <input name="s_shopName" defaultValue={settings.shopName} />
            </div>
            <div className="field">
              <label>Address</label>
              <input name="s_address" defaultValue={settings.address} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input name="s_phone" type="tel" defaultValue={settings.phone} />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "14px" }}
            >
              Save Settings
            </button>
          </form>

          <button
            className="btn btn-ghost"
            style={{ marginTop: "8px" }}
            onClick={handleOpenStaffManagement}
          >
            Manage Staff Accounts
          </button>
          <div className="ticket-hr"></div>

          <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
            Data is cached on this device for offline use and synchronized with the shop database when online.
          </div>
          <div className="btn-row" style={{ marginTop: "10px" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExportBackup}
            >
              Export Backup
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => document.getElementById("importFile")?.click()}
            >
              Import Backup
            </button>
          </div>
          <input
            type="file"
            id="importFile"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportBackup}
          />
        </div>
      </SettingsDialog>

      {/* MODAL: DEBT PAYMENT */}
      <DebtPaymentDialog activeModal={activeModal}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>
            ✕
          </button>
          <div className="modal-title">Record Payment</div>
          {recordingPaymentDebt && (
            <div
              id="pay_customerInfo"
              style={{
                marginBottom: "10px",
                fontSize: "13.5px",
                color: "var(--ink-soft)",
              }}
            >
              {recordingPaymentDebt.customerName} owes{" "}
              {naira(recordingPaymentDebt.balance)}
            </div>
          )}
          <div className="field">
            <label>Payment Amount (₦)</label>
            <input
              type="number"
              min="0"
              value={recordingPaymentAmount}
              onChange={(e) => setRecordingPaymentAmount(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: "14px" }}
            onClick={handleRecordDebtPayment}
          >
            Save Payment
          </button>
        </div>
      </DebtPaymentDialog>

      {/* Toast Notification element */}
      {toast.show && <div className="toast show">{toast.message}</div>}
    </div>
  );
}
