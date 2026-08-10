"use client";

import { useEffect, useState } from "react";
import type {
  CartItem,
  Debt,
  ModalName,
  Product,
  Receipt,
  ReceiptType,
  TabName,
} from "../lib/types";
import { usePersistentInventory } from "./use-persistent-inventory";

export function useInventorySystem() {
  const persistent = usePersistentInventory();
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [activeModal, setActiveModal] = useState<ModalName | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [ownerPinEdit, setOwnerPinEdit] = useState("");
  const [toast, setToast] = useState({ show: false, message: "" });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invSearch, setInvSearch] = useState("");
  const [saleSearch, setSaleSearch] = useState("");
  const [salesLogSearch, setSalesLogSearch] = useState("");
  const [salesLogPeriod, setSalesLogPeriod] = useState("all");
  const [salesLogType, setSalesLogType] = useState("all");
  const [salesLogStaff, setSalesLogStaff] = useState("all");
  const [reportRange, setReportRange] = useState("today");
  const [checkoutForm, setCheckoutForm] = useState({
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
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null);
  const [currentReceiptType, setCurrentReceiptType] =
    useState<ReceiptType>("sale");
  const [currentDebtPaymentAmount, setCurrentDebtPaymentAmount] = useState(0);
  const [newStaff, setNewStaff] = useState({ name: "", email: "", pin: "" });
  const [recordingPaymentDebt, setRecordingPaymentDebt] = useState<Debt | null>(
    null,
  );
  const [recordingPaymentAmount, setRecordingPaymentAmount] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginUserId, setLoginUserId] = useState("");

  useEffect(() => {
    if (persistent.initialLoginUserId) {
      setLoginUserId(persistent.initialLoginUserId);
    }
  }, [persistent.initialLoginUserId]);

  return {
    ...persistent,
    activeTab,
    setActiveTab,
    activeModal,
    setActiveModal,
    editingProduct,
    setEditingProduct,
    ownerPinEdit,
    setOwnerPinEdit,
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
  };
}
