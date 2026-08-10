import type { Debt, Receipt, Sale } from "./types";

export function saleToReceipt(sale: Sale): Receipt {
  return {
    ...sale,
    saleId: sale.id,
    phone: sale.customerPhone,
    originalAmount: sale.balance,
    payments: [],
  };
}

export function debtToReceipt(debt: Debt): Receipt {
  return {
    ...debt,
    invoiceNo: "",
    items: [],
    total: debt.originalAmount,
    cartSubtotal: debt.originalAmount,
    deliveryFee: 0,
    discount: 0,
    paymentType: "credit",
    customerPhone: debt.phone,
    customerAddress: "",
    driver: "",
    car: "",
    staffName: "System",
    amountPaid: 0,
    payCash: 0,
    payTransfer1: 0,
    payTransfer2: 0,
  };
}

export function uid() {
  return crypto.randomUUID();
}

export function naira(n: number | string) {
  return (
    "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })
  );
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function numberToWords(num: number) {
  if (num === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertLessThanThousand(n: number) {
    if (n < 20) return ones[n];
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let result = "";
    if (hundred > 0) {
      result += ones[hundred] + " Hundred";
      if (remainder > 0) result += " and ";
    }
    if (remainder < 20) result += ones[remainder];
    else {
      result += tens[Math.floor(remainder / 10)];
      if (remainder % 10 > 0) result += "-" + ones[remainder % 10];
    }
    return result;
  }

  let remaining = num;
  let words = "";
  const million = Math.floor(remaining / 1_000_000);
  remaining %= 1_000_000;
  if (million > 0) words += convertLessThanThousand(million) + " Million ";
  const thousand = Math.floor(remaining / 1_000);
  remaining %= 1_000;
  if (thousand > 0) words += convertLessThanThousand(thousand) + " Thousand ";
  if (remaining > 0) words += convertLessThanThousand(remaining);
  return words.trim();
}

export function formatGrandTotalInWords(amount: number) {
  return numberToWords(Math.floor(amount)) || "Zero";
}
