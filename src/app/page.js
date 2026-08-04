"use client";

import React, { useState, useEffect, useMemo } from 'react';

// --- HELPER FUNCTIONS ---
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function naira(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// --- NUMBER TO WORDS ENGINE ---
function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertLessThanThousand(n) {
    if (n < 20) return ones[n];
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) {
      res += ones[hundred] + ' Hundred';
      if (remainder > 0) res += ' and ';
    }
    if (remainder < 20) {
      res += ones[remainder];
    } else {
      res += tens[Math.floor(remainder / 10)];
      if (remainder % 10 > 0) {
        res += '-' + ones[remainder % 10];
      }
    }
    return res;
  }
  
  let temp = num;
  let word = '';
  const million = Math.floor(temp / 1000000);
  temp = temp % 1000000;
  if (million > 0) {
    word += convertLessThanThousand(million) + ' Million ';
  }
  const thousand = Math.floor(temp / 1000);
  temp = temp % 1000;
  if (thousand > 0) {
    word += convertLessThanThousand(thousand) + ' Thousand ';
  }
  if (temp > 0) {
    word += convertLessThanThousand(temp);
  }
  return word.trim();
}

function formatGrandTotalInWords(amount) {
  const rounded = Math.floor(amount);
  const words = numberToWords(rounded);
  return words ? words : 'Zero';
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [debts, setDebts] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ shopName: '', address: '', phone: '' });
  const [activeUser, setActiveUser] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null); // 'product', 'checkout', 'confirm-cancel', 'receipt', 'user', 'settings', 'payment'
  const [editingProduct, setEditingProduct] = useState(null);
  const [ownerPinEdit, setOwnerPinEdit] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  // Cart state
  const [cart, setCart] = useState([]);

  // Filters and queries
  const [invSearch, setInvSearch] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  
  const [salesLogSearch, setSalesLogSearch] = useState('');
  const [salesLogPeriod, setSalesLogPeriod] = useState('all');
  const [salesLogType, setSalesLogType] = useState('all');
  const [salesLogStaff, setSalesLogStaff] = useState('all');

  const [reportRange, setReportRange] = useState('today');

  // Checkout modal fields
  const [checkoutForm, setCheckoutForm] = useState({
    paymentType: 'cash',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    amountPaid: '',
    driver: '',
    car: '',
    deliveryFee: '',
    discount: '',
    payCash: '',
    payTransfer1: '',
    payTransfer2: ''
  });

  // Receipts views states
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [currentReceiptType, setCurrentReceiptType] = useState('sale'); // 'sale' or 'debt'
  const [currentDebtPaymentAmount, setCurrentDebtPaymentAmount] = useState(0);

  // New staff modal states
  const [newStaff, setNewStaff] = useState({ name: '', pin: '' });
  
  // Debt record payment states
  const [recordingPaymentDebt, setRecordingPaymentDebt] = useState(null);
  const [recordingPaymentAmount, setRecordingPaymentAmount] = useState('');

  // Login states
  const [loginPin, setLoginPin] = useState('');
  const [loginUserId, setLoginUserId] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    // Seed defaults if empty
    const rawSettings = localStorage.getItem('sp_settings');
    const rawUsers = localStorage.getItem('sp_users');
    const rawActiveUser = localStorage.getItem('sp_activeUser');
    const rawProducts = localStorage.getItem('sp_products');
    const rawSales = localStorage.getItem('sp_sales');
    const rawDebts = localStorage.getItem('sp_debts');
    const rawSession = localStorage.getItem('sp_sessionActive');

    let loadedSettings = rawSettings ? JSON.parse(rawSettings) : null;
    let loadedUsers = rawUsers ? JSON.parse(rawUsers) : null;
    let loadedActiveUser = rawActiveUser ? rawActiveUser : null;
    let loadedProducts = rawProducts ? JSON.parse(rawProducts) : [];
    let loadedSales = rawSales ? JSON.parse(rawSales) : [];
    let loadedDebts = rawDebts ? JSON.parse(rawDebts) : [];
    let loadedSession = rawSession ? JSON.parse(rawSession) : false;

    if (!loadedSettings) {
      loadedSettings = {
        shopName: 'Prince Iyke Building & Technical Tools Merchants',
        address: 'A Division of Obiezu Holding',
        phone: ''
      };
      localStorage.setItem('sp_settings', JSON.stringify(loadedSettings));
    }

    if (!loadedUsers) {
      const ownerId = uid();
      loadedUsers = [
        { id: ownerId, name: 'Owner', role: 'owner', pin: '0000' }
      ];
      localStorage.setItem('sp_users', JSON.stringify(loadedUsers));
      loadedActiveUser = ownerId;
      localStorage.setItem('sp_activeUser', ownerId);
    }

    if (!loadedActiveUser && loadedUsers) {
      loadedActiveUser = loadedUsers[0].id;
      localStorage.setItem('sp_activeUser', loadedActiveUser);
    }

    setSettings(loadedSettings);
    setUsers(loadedUsers);
    setActiveUser(loadedActiveUser);
    setProducts(loadedProducts);
    setSales(loadedSales);
    setDebts(loadedDebts);
    setSessionActive(loadedSession);
    setLoginUserId(loadedActiveUser || (loadedUsers && loadedUsers[0].id) || '');

    setIsMounted(true);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // --- LOCALSTORAGE SYNC CHANGES ---
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_products', JSON.stringify(products));
    }
  }, [products, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_sales', JSON.stringify(sales));
    }
  }, [sales, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_debts', JSON.stringify(debts));
    }
  }, [debts, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_users', JSON.stringify(users));
    }
  }, [users, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_settings', JSON.stringify(settings));
    }
  }, [settings, isMounted]);

  useEffect(() => {
    if (isMounted && activeUser) {
      localStorage.setItem('sp_activeUser', activeUser);
    }
  }, [activeUser, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sp_sessionActive', JSON.stringify(sessionActive));
    }
  }, [sessionActive, isMounted]);

  // --- VIEW ROLES & USER CONTROLS ---
  const activeUserObj = useMemo(() => {
    return users.find(u => u.id === activeUser) || users[0] || null;
  }, [users, activeUser]);

  const isOwner = useMemo(() => {
    return activeUserObj && activeUserObj.role === 'owner';
  }, [activeUserObj]);

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 1800);
  };

  // --- HEADER DETAILS ---
  const shopNameDisplay = settings.shopName === 'Prince Iyke Building & Technical Tools Merchants' ? 'PRINCE IYKE' : settings.shopName;
  const showSubtitle = settings.shopName === 'Prince Iyke Building & Technical Tools Merchants';

  // --- DASHBOARD LOGIC ---
  const todaySales = useMemo(() => {
    const today = todayStr();
    return sales
      .filter(s => s.date.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  const lowStockItems = useMemo(() => {
    return products.filter(p => p.stock <= p.lowStock);
  }, [products]);

  const totalDebtsOwed = useMemo(() => {
    return debts.reduce((sum, d) => sum + d.balance, 0);
  }, [debts]);

  const totalStockValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.stock * (isOwner ? p.cost : p.price), 0);
  }, [products, isOwner]);

  const recentSales = useMemo(() => {
    return sales.slice().reverse().slice(0, 6);
  }, [sales]);

  // --- INVENTORY VIEW ---
  const filteredProducts = useMemo(() => {
    const q = invSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, invSearch]);

  // --- SALE Cart & PICKER LOGIC ---
  const salePickerProducts = useMemo(() => {
    const q = saleSearch.toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [products, saleSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  }, [cart]);

  const addToCart = (productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    if (p.stock <= 0) {
      showToast('Out of stock');
      return;
    }
    const existing = cart.find(c => c.productId === productId);
    if (existing) {
      setCart(cart.map(c => c.productId === productId ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { productId, name: p.name, unit: p.unit, qty: 1, price: p.price }]);
    }
    setSaleSearch('');
  };

  const changeQty = (productId, delta) => {
    const item = cart.find(c => c.productId === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter(c => c.productId !== productId));
    } else {
      setCart(cart.map(c => c.productId === productId ? { ...c, qty: newQty } : c));
    }
  };

  const changePrice = (productId, newPrice) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price) && price >= 0) {
      setCart(cart.map(c => c.productId === productId ? { ...c, price } : c));
    }
  };

  // --- CHECKOUT LOGIC ---
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast('Add items to cart first');
      return;
    }
    setCheckoutForm({
      paymentType: 'cash',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      amountPaid: '',
      driver: '',
      car: '',
      deliveryFee: '',
      discount: '',
      payCash: '',
      payTransfer1: '',
      payTransfer2: ''
    });
    setActiveModal('checkout');
  };

  const checkoutSummary = useMemo(() => {
    const subtotal = cartTotal;
    const deliveryFee = parseFloat(checkoutForm.deliveryFee) || 0;
    const discount = parseFloat(checkoutForm.discount) || 0;
    const grandTotal = subtotal + deliveryFee - discount;
    const type = checkoutForm.paymentType;
    
    let summaryHtml = `Cart Subtotal: ${naira(subtotal)}\n`;
    if (deliveryFee > 0) summaryHtml += `Delivery Fee: +${naira(deliveryFee)}\n`;
    if (discount > 0) summaryHtml += `Discount: -${naira(discount)}\n`;
    summaryHtml += `Grand Total: ${naira(grandTotal)}\n`;
    
    if (type === 'credit') {
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

    if (type === 'credit' && !customerName) {
      showToast('Customer name required for credit sale');
      return;
    }

    const subtotal = cartTotal;
    const grandTotal = subtotal + deliveryFee - discount;
    let amountPaid = grandTotal;
    let balance = 0;
    
    if (type === 'credit') {
      amountPaid = parseFloat(checkoutForm.amountPaid) || 0;
      balance = grandTotal - amountPaid;
    }

    // Deduct stock levels
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(c => c.productId === p.id);
      if (cartItem) {
        return { ...p, stock: Math.max(0, p.stock - cartItem.qty) };
      }
      return p;
    });
    setProducts(updatedProducts);

    const invoiceSeq = sales.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNo = `PI-${currentYear}-${String(invoiceSeq).padStart(4, '0')}`;

    const newSale = {
      id: uid(),
      invoiceNo,
      date: new Date().toISOString(),
      items: cart.map(c => ({ ...c, subtotal: c.price * c.qty })),
      total: grandTotal,
      cartSubtotal: subtotal,
      deliveryFee,
      discount,
      paymentType: type,
      customerName: customerName || 'Walk-in',
      customerPhone,
      customerAddress,
      driver,
      car,
      staffName: activeUserObj ? activeUserObj.name : 'System',
      amountPaid,
      balance,
      payCash,
      payTransfer1,
      payTransfer2
    };

    const newSalesList = [...sales, newSale];
    setSales(newSalesList);

    if (type === 'credit' && balance > 0) {
      const newDebt = {
        id: uid(),
        saleId: newSale.id,
        customerName,
        phone: customerPhone,
        originalAmount: balance,
        balance,
        date: newSale.date,
        payments: []
      };
      setDebts([...debts, newDebt]);
    }

    setCart([]);
    setActiveModal(null);
    setCurrentReceiptType('sale');
    setCurrentReceipt(newSale);
    setActiveModal('receipt');
  };

  // --- SALES LOG FILTERS & DATA ---
  const salesLogSummary = useMemo(() => {
    const q = salesLogSearch.toLowerCase();
    const period = salesLogPeriod;
    const type = salesLogType;
    const staff = salesLogStaff;
    const now = new Date();

    const filtered = sales.filter(s => {
      if (q) {
        const invMatch = (s.invoiceNo || s.id || '').toLowerCase().includes(q);
        const custMatch = (s.customerName || '').toLowerCase().includes(q);
        const staffMatch = (s.staffName || '').toLowerCase().includes(q);
        const itemMatch = s.items.some(i => i.name.toLowerCase().includes(q));
        if (!invMatch && !custMatch && !staffMatch && !itemMatch) return false;
      }

      if (period !== 'all') {
        const sDate = new Date(s.date);
        if (period === 'today') {
          if (sDate.toDateString() !== now.toDateString()) return false;
        } else if (period === 'week') {
          const diffDays = (now - sDate) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) return false;
        } else if (period === 'month') {
          if (sDate.getMonth() !== now.getMonth() || sDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      if (type !== 'all') {
        if (s.paymentType !== type) return false;
      }

      if (staff !== 'all') {
        if (s.staffName !== staff) return false;
      }

      return true;
    });

    const count = filtered.length;
    const totalSalesVal = filtered.reduce((sum, s) => sum + s.total, 0);
    const cashVal = filtered.reduce((sum, s) => sum + (s.paymentType === 'cash' ? s.total : s.amountPaid), 0);
    const creditVal = filtered.reduce((sum, s) => sum + (s.paymentType === 'credit' ? s.balance : 0), 0);

    return { filtered, count, totalSalesVal, cashVal, creditVal };
  }, [sales, salesLogSearch, salesLogPeriod, salesLogType, salesLogStaff]);

  // --- DEBTS LOGIC ---
  const activeDebts = useMemo(() => {
    return debts.filter(d => d.balance > 0);
  }, [debts]);

  const handleOpenDebtPayment = (debt) => {
    setRecordingPaymentDebt(debt);
    setRecordingPaymentAmount('');
    setActiveModal('payment');
  };

  const handleRecordDebtPayment = () => {
    const amount = parseFloat(recordingPaymentAmount) || 0;
    if (amount <= 0) {
      showToast('Enter a valid amount');
      return;
    }
    const updatedDebts = debts.map(d => {
      if (d.id === recordingPaymentDebt.id) {
        const updatedBalance = Math.max(0, d.balance - amount);
        const updatedPayments = [...d.payments, { date: new Date().toISOString(), amount }];
        
        // Build the receipt object
        const targetDebt = { ...d, balance: updatedBalance, payments: updatedPayments };
        setCurrentReceiptType('debt');
        setCurrentDebtPaymentAmount(amount);
        setCurrentReceipt(targetDebt);
        return targetDebt;
      }
      return d;
    });

    setDebts(updatedDebts);
    setActiveModal(null);
    setActiveModal('receipt');
    showToast('Payment recorded');
  };

  // --- REPORTS VIEW ---
  const reportsData = useMemo(() => {
    const range = reportRange;
    const filteredSales = sales.filter(s => {
      if (range === 'all') return true;
      const d = new Date(s.date);
      const now = new Date();
      if (range === 'today') return d.toDateString() === now.toDateString();
      if (range === 'week') {
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      return true;
    });

    const qtyMap = {};
    filteredSales.forEach(s => s.items.forEach(i => {
      qtyMap[i.name] = (qtyMap[i.name] || 0) + i.qty;
    }));
    
    const bestSellers = Object.entries(qtyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let profit = 0;
    let revenue = 0;
    filteredSales.forEach(s => s.items.forEach(i => {
      const p = products.find(x => x.name === i.name);
      revenue += i.subtotal;
      if (p) profit += (i.price - p.cost) * i.qty;
    }));

    return { bestSellers, revenue, profit, lowStockCount: lowStockItems.length };
  }, [sales, products, reportRange, lowStockItems]);

  // --- PRODUCT FORM CONTROLS ---
  const handleOpenAddProduct = () => {
    if (!isOwner) {
      showToast('Only Owner can add/edit products');
      return;
    }
    setEditingProduct(null);
    setActiveModal('product');
  };

  const handleOpenEditProduct = (p) => {
    if (!isOwner) {
      showToast('Only Owner can add/edit products');
      return;
    }
    setEditingProduct(p);
    setActiveModal('product');
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    const form = e.target.elements;
    const name = form.p_name.value.trim();
    if (!name) {
      showToast('Enter a product name');
      return;
    }

    const data = {
      name,
      category: form.p_category.value.trim(),
      unit: form.p_unit.value,
      stock: parseFloat(form.p_stock.value) || 0,
      lowStock: parseFloat(form.p_lowStock.value) || 0,
      cost: parseFloat(form.p_cost.value) || 0,
      price: parseFloat(form.p_price.value) || 0,
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
    } else {
      setProducts([...products, { id: uid(), ...data }]);
    }

    setActiveModal(null);
    showToast('Product saved');
  };

  const handleDeleteProduct = () => {
    if (!editingProduct) return;
    if (!confirm('Delete this product?')) return;
    setProducts(products.filter(p => p.id !== editingProduct.id));
    setActiveModal(null);
    showToast('Product deleted');
  };

  // --- STAFF/USERS LOGIC ---
  const handleOpenStaffManagement = () => {
    setNewStaff({ name: '', pin: '' });
    setActiveModal('user');
  };

  const handleAddStaff = () => {
    const name = newStaff.name.trim();
    const pin = newStaff.pin.trim();
    if (!name) {
      showToast('Enter staff name');
      return;
    }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      showToast('PIN must be exactly 4 digits');
      return;
    }
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      showToast('User name already exists');
      return;
    }

    setUsers([...users, { id: uid(), name, role: 'staff', pin }]);
    setNewStaff({ name: '', pin: '' });
    showToast('Staff member added');
  };

  const handleUpdateStaffPin = (userId, newPin) => {
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits');
      return;
    }
    setUsers(users.map(u => u.id === userId ? { ...u, pin: newPin } : u));
    showToast('PIN updated successfully');
  };

  const handleRemoveStaff = (userId) => {
    if (userId === activeUser) {
      showToast('Cannot remove currently active user');
      return;
    }
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    setUsers(users.filter(u => u.id !== userId));
    showToast('Staff member removed');
  };

  // --- SETTINGS CONTROLS ---
  const handleOpenSettings = () => {
    if (!isOwner) {
      showToast('Only the Owner can access settings');
      return;
    }
    const ownerObj = users.find(u => u.role === 'owner');
    setOwnerPinEdit(ownerObj ? ownerObj.pin : '0000');
    setActiveModal('settings');
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const form = e.target.elements;
    const shopName = form.s_shopName.value.trim() || 'My Shop';
    const address = form.s_address.value.trim();
    const phone = form.s_phone.value.trim();
    const pin = ownerPinEdit.trim();

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      showToast('Owner PIN must be exactly 4 digits');
      return;
    }

    setSettings({ shopName, address, phone });
    setUsers(users.map(u => u.role === 'owner' ? { ...u, pin } : u));
    setActiveModal(null);
    showToast('Settings saved');
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
      sp_sessionActive: sessionActive
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockpoint-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.sp_products) setProducts(backup.sp_products);
        if (backup.sp_sales) setSales(backup.sp_sales);
        if (backup.sp_debts) setDebts(backup.sp_debts);
        if (backup.sp_users) setUsers(backup.sp_users);
        if (backup.sp_settings) setSettings(backup.sp_settings);
        if (backup.sp_activeUser) setActiveUser(backup.sp_activeUser);
        if (backup.sp_sessionActive !== undefined) setSessionActive(backup.sp_sessionActive);
        showToast('Backup restored — reloading state...');
        setActiveModal(null);
      } catch (err) {
        showToast('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };


  // --- LOGIN CONTROLS ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginUserId) {
      showToast('Select a user');
      return;
    }
    const userObj = users.find(u => u.id === loginUserId);
    if (!userObj) {
      showToast('User not found');
      return;
    }

    const correctPin = userObj.pin || '0000';
    if (loginPin === correctPin) {
      setActiveUser(loginUserId);
      setSessionActive(true);
      setLoginPin('');
      setActiveTab('dashboard');
      showToast(`Welcome, ${userObj.name}`);
    } else {
      showToast('Incorrect PIN');
      setLoginPin('');
    }
  };

  const handleLogout = () => {
    setSessionActive(false);
    setLoginPin('');
    showToast('App Locked');
  };

  // --- RECEIPT SHARING ---
  const handleShareReceipt = () => {
    if (!currentReceipt) return;
    const lines = currentReceiptType === 'sale'
      ? currentReceipt.items.map(i => `${i.name} x${i.qty}${i.unit} — ${naira(i.subtotal)}`).join('\n')
      : `Debt Payment towards ${currentReceipt.invoiceNo || 'Invoice'}`;

    let text = `${settings.shopName || 'PRINCE IYKE'}\nRC: 008855\nInvoice No: ${currentReceipt.invoiceNo || currentReceipt.id.slice(-8).toUpperCase()}\nDate: ${new Date(currentReceipt.date).toLocaleString('en-NG')}\nCustomer: ${currentReceipt.customerName}\nPhone: ${currentReceipt.customerPhone || '—'}\n\n${lines}\n\n`;

    if (currentReceiptType === 'sale') {
      if (currentReceipt.deliveryFee > 0) text += `Delivery Fee: ${naira(currentReceipt.deliveryFee)}\n`;
      if (currentReceipt.discount > 0) text += `Discount: -${naira(currentReceipt.discount)}\n`;
      text += `TOTAL: ${naira(currentReceipt.total)}\n`;
      if (currentReceipt.paymentType === 'credit') {
        text += `Paid: ${naira(currentReceipt.amountPaid)}\nBalance: ${naira(currentReceipt.balance)}\n`;
      } else {
        text += `PAID IN FULL (CASH)\n`;
      }
    } else {
      text += `Payment Amount: ${naira(currentDebtPaymentAmount)}\n`;
      text += `Outstanding balance: ${naira(currentReceipt.balance)}\n`;
    }
    text += `\nThank you for your patronage!`;

    if (navigator.share) {
      navigator.share({ title: 'Receipt', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast('Receipt copied — paste into WhatsApp'));
    }
  };

  const handleShowReceiptById = (saleId) => {
    const saleObj = sales.find(s => s.id === saleId);
    if (saleObj) {
      setCurrentReceiptType('sale');
      setCurrentReceipt(saleObj);
      setActiveModal('receipt');
    }
  };

  const handleShowDebtReceipt = (debtObj) => {
    setCurrentReceiptType('debt');
    setCurrentDebtPaymentAmount(0); // View only mode
    setCurrentReceipt(debtObj);
    setActiveModal('receipt');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isMounted) {
    return <div style={{ background: '#EFEDE6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>Loading System...</div>;
  }

  // --- RENDER SECURITY LOGIN OVERLAY ---
  if (!sessionActive) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--paper)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '32px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', borderRadius: '18px', background: 'var(--paper-raised)' }}>
          <img src="/Prince Iyke logo.png" alt="Logo" style={{ width: '120px', height: '120px', margin: '0 auto 16px', display: 'block', borderRadius: '14px', objectFit: 'contain' }} />
          <div className="modal-title" style={{ fontSize: '22px', marginBottom: '8px' }}>Prince Iyke Merchants</div>
          <div style={{ fontSize: '13.5px', color: 'var(--ink-soft)', marginBottom: '24px' }}>Please select your shift and enter PIN</div>
          
          <form onSubmit={handleLogin}>
            <div className="field" style={{ textAlign: 'left', marginBottom: '16px' }}>
              <label>Select User</label>
              <select value={loginUserId} onChange={(e) => setLoginUserId(e.target.value)} style={{ padding: '12px', fontSize: '15px', borderRadius: '10px' }}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            
            <div className="field" style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label>Enter 4-Digit PIN</label>
              <input 
                type="password" 
                pattern="[0-9]*" 
                inputMode="numeric" 
                maxLength={4} 
                placeholder="••••" 
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', padding: '12px', fontFamily: 'var(--font-mono)', borderRadius: '10px' }} 
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ padding: '14px', fontSize: '16px' }}>Access System</button>
          </form>
        </div>
        
        {toast.show && <div className="toast show">{toast.message}</div>}
      </div>
    );
  }

  // --- RENDER MAIN INTERFACE ---
  return (
    <div className="app-container">
      {/* Top Banner Header */}
      <div className="topbar">
        <img 
          src="/Prince Iyke logo.png" 
          alt="Logo" 
          className="brand-logo" 
          onClick={handleOpenSettings}
        />
        <div className="topbar-center">
          <div className="brand-title">{shopNameDisplay}</div>
          {showSubtitle && <div className="brand-subtitle">BUILDING &amp; TECHNICAL TOOLS MERCHANTS</div>}
          <div className="brand-division">
            {settings.address === 'A Division of Obiezu Holding' 
              ? '(A Division of Obiezu Holding)' + (settings.phone ? ' · ' + settings.phone : '')
              : [settings.address, settings.phone].filter(Boolean).join(' · ')
            }
          </div>
          <div className="brand-rc">RC 008855</div>
          <div className="brand-deals">
            Ultimate in Building Material such as Cement, Zinc, Nails, Spade, Wheelbarrow, Paints, Welding/Filling Machine, General Supplies &amp; General Merchants
          </div>
        </div>
        <div className="who">
          <span>{activeUserObj ? `${activeUserObj.name} (${activeUserObj.role})` : '—'}</span>
          <button onClick={handleLogout}>Lock / Switch Shift</button>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      <div className={`view ${activeTab === 'dashboard' ? 'active' : ''}`}>
        <div className="stat-grid">
          <div className="stat stat-sales">
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,6V12H16V14H9V6H11Z"/></svg>
            <div className="num">{naira(todaySales)}</div>
            <div className="label">Today's Sales</div>
          </div>
          <div className="stat stat-lowstock" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('inventory')}>
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z"/></svg>
            <div className="num">{lowStockItems.length}</div>
            <div className="label">Low Stock Items</div>
          </div>
          <div className="stat stat-debt" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('debts')}>
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,2L21,5V11M12,4.8L6,6.8V11C6,15.22 8.76,19.34 12,20.8C15.24,19.34 18,15.22 18,11V6.8L12,4.8M11,10H13V15H11V10M11,7H13V9H11V7Z"/></svg>
            <div className="num">{naira(totalDebtsOwed)}</div>
            <div className="label">Total Owed</div>
          </div>
          <div className="stat stat-stockval">
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,3L2,8L12,13L22,8L12,3M12,5.18L19.63,9L12,12.82L4.37,9L12,5.18M12,15L3,10.5V13.5L12,18L21,13.5V10.5L12,15M12,17.18L19.63,13.36V14.36L12,18.18L4.37,13.36V14.36L12,17.18Z"/></svg>
            <div className="num">{naira(totalStockValue)}</div>
            <div className="label">Stock Value</div>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="card" style={{ borderColor: 'var(--rust)' }}>
            <div className="section-title" style={{ color: 'var(--rust)', margin: '0 0 8px' }}>⚠ Running Low</div>
            <div id="lowStockList">
              {lowStockItems.map(p => (
                <div className="list-row" key={p.id}>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-stock low">{p.stock} {p.unit}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-columns">
          <div className="card">
            <div className="section-title">Quick Actions Panel</div>
            <div className="action-grid">
              <button className="action-btn" onClick={() => setActiveTab('sale')}>
                <span className="action-title">New Sale Checkout</span>
                <span className="action-desc">Sell technical tools &amp; gear</span>
              </button>
              <button className="action-btn" onClick={() => setActiveTab('inventory')}>
                <span className="action-title">Stock Inventory</span>
                <span className="action-desc">View products &amp; check levels</span>
              </button>
              <button className="action-btn" onClick={() => setActiveTab('debts')}>
                <span className="action-title">Debts &amp; Payments</span>
                <span className="action-desc">Track customers owes &amp; histories</span>
              </button>
              {isOwner && (
                <button className="action-btn" onClick={() => setActiveTab('reports')}>
                  <span className="action-title">Business Reports</span>
                  <span className="action-desc">Review sales metrics &amp; profits</span>
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
                recentSales.map(s => (
                  <div className="list-row" key={s.id} onClick={() => handleShowReceiptById(s.id)} style={{ cursor: 'pointer' }}>
                    <div>
                      <div className="prod-name">
                        {naira(s.total)} {s.paymentType === 'credit' ? <span className="badge badge-credit">Credit</span> : ''}
                      </div>
                      <div className="prod-meta">
                        {s.customerName || 'Walk-in'} · {s.staffName} · {new Date(s.date).toLocaleString('en-NG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* INVENTORY VIEW */}
      <div className={`view ${activeTab === 'inventory' ? 'active' : ''}`}>
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Search products…" 
            value={invSearch} 
            onChange={(e) => setInvSearch(e.target.value)} 
          />
        </div>
        <div className="card" style={{ paddingTop: '10px' }}>
          <div className="section-title" style={{ marginBottom: '6px' }}>All Products</div>
          <div id="inventoryList">
            {filteredProducts.length === 0 ? (
              <div className="empty">No products found</div>
            ) : (
              filteredProducts.map(p => {
                const low = p.stock <= p.lowStock;
                return (
                  <div className="list-row" key={p.id} onClick={() => handleOpenEditProduct(p)}>
                    <div>
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-meta">
                        {p.category || '—'} · {naira(p.price)}/{p.unit} {low ? <span className="badge badge-low">Low</span> : ''}
                      </div>
                    </div>
                    <div className={`prod-stock ${low ? 'low' : ''}`}>{p.stock} {p.unit}{p.stock !== 1 ? 's' : ''}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SALE CHECKOUT VIEW */}
      <div className={`view ${activeTab === 'sale' ? 'active' : ''}`}>
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
              {saleSearch.trim() === '' ? (
                <div className="empty">Start typing a product name</div>
              ) : salePickerProducts.length === 0 ? (
                <div className="empty">No matching product</div>
              ) : (
                salePickerProducts.map(p => (
                  <div className="list-row" key={p.id} onClick={() => addToCart(p.id)}>
                    <div>
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-meta">{naira(p.price)}/{p.unit} · {p.stock} in stock</div>
                    </div>
                    <div style={{ fontSize: '20px', color: 'var(--steel)' }}>+</div>
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
                  <div className="empty">Cart is empty — search above to add items</div>
                ) : (
                  cart.map(c => (
                    <div className="cart-item" key={c.productId}>
                      <div style={{ flex: 1 }}>
                        <div className="prod-name">{c.name}</div>
                        <div className="prod-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span>Price: ₦</span>
                          <input 
                            type="number" 
                            className="cart-price-input" 
                            value={c.price} 
                            onChange={(e) => changePrice(c.productId, e.target.value)} 
                            min="0" 
                            step="any" 
                          />
                          <span>× {c.qty} {c.unit} = {naira(c.price * c.qty)}</span>
                        </div>
                      </div>
                      <div className="qty-ctrl">
                        <button onClick={() => changeQty(c.productId, -1)}>−</button>
                        <span style={{ fontFamily: 'var(--font-mono)', minWidth: '20px', textAlign: 'center' }}>{c.qty}</span>
                        <button onClick={() => changeQty(c.productId, 1)}>+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cart-total-row">
                <span>Total</span>
                <span id="cartTotal">{naira(cartTotal)}</span>
              </div>
              <button className="btn btn-amber" style={{ marginTop: '12px' }} onClick={handleOpenCheckout}>Checkout</button>
            </div>
          </div>
        </div>
      </div>

      {/* SALES LOG VIEW */}
      <div className={`view ${activeTab === 'sales-log' ? 'active' : ''}`}>
        <div className="stat-grid">
          <div className="stat stat-sales">
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 16h4v-2h-4v2zm3-11H11v6h2V5zm-1-3C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            <div className="num">{salesLogSummary.count}</div>
            <div className="label">Total Invoices</div>
          </div>
          <div className="stat stat-stockval">
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M5 6h14v2H5V6zm0 4h14v2H5v-2zm0 4h14v2H5v-2zm0 4h14v2H5v-2z"/></svg>
            <div className="num">{naira(salesLogSummary.totalSalesVal)}</div>
            <div className="label">Total Sales</div>
          </div>
          <div className="stat stat-debt" style={{ background: 'linear-gradient(135deg, #104080, #0c3060)' }}>
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            <div className="num">{naira(salesLogSummary.cashVal)}</div>
            <div className="label">Cash Sales</div>
          </div>
          <div className="stat stat-lowstock" style={{ background: 'linear-gradient(135deg, #cc8b2b, #8a5714)' }}>
            <svg className="stat-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>
            <div className="num">{naira(salesLogSummary.creditVal)}</div>
            <div className="label">Credit Sales</div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Filter Transactions Database</div>
          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div className="field" style={{ gridColumn: 'span 2' }}>
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
              <select value={salesLogPeriod} onChange={(e) => setSalesLogPeriod(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select value={salesLogType} onChange={(e) => setSalesLogType(e.target.value)}>
                <option value="all">All Payments</option>
                <option value="cash">Cash / Full</option>
                <option value="credit">Credit (Owed)</option>
              </select>
            </div>
            <div className="field">
              <label>Issued By (Staff)</label>
              <select value={salesLogStaff} onChange={(e) => setSalesLogStaff(e.target.value)}>
                <option value="all">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ paddingTop: '10px' }}>
          <div className="section-title" style={{ marginBottom: '6px' }}>Transaction Ledger</div>
          <div id="saleslog-list">
            {salesLogSummary.filtered.length === 0 ? (
              <div className="empty">No matching transactions found in the database.</div>
            ) : (
              salesLogSummary.filtered.slice().reverse().map(s => {
                const itemsPreview = s.items.map(i => (
                  <span key={i.productId} className="saleslog-item-tag">{i.name} x{i.qty}</span>
                ));
                const badgeClass = s.paymentType === 'credit' ? 'badge-credit' : 'badge-ok';
                const badgeText = s.paymentType === 'credit' ? 'Credit' : 'Cash';
                const dateFormatted = new Date(s.date).toLocaleString('en-NG', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                return (
                  <div className="saleslog-row" key={s.id}>
                    <div className="saleslog-col-main">
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--steel)' }}>
                        {s.invoiceNo || s.id.slice(-8).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', marginTop: '2px' }}>
                        {s.customerName}
                      </div>
                      <div className="prod-meta" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                        {dateFormatted}
                      </div>
                    </div>
                    
                    <div className="saleslog-col-items">
                      {itemsPreview}
                    </div>
                    
                    <div className="saleslog-col-meta">
                      <div className="prod-stock" style={{ fontSize: '16px', color: 'var(--ink)' }}>
                        {naira(s.total)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge ${badgeClass}`}>{badgeText}</span>
                        {s.paymentType === 'credit' && s.balance > 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--rust)', fontWeight: 700 }}>Bal: {naira(s.balance)}</span>
                        )}
                      </div>
                      <div className="prod-meta" style={{ fontSize: '11px', marginTop: '1px' }}>
                        By: {s.staffName}
                      </div>
                      <button className="btn btn-sm btn-ghost" style={{ marginTop: '6px', padding: '4px 8px', fontSize: '11.5px', width: 'auto', height: 'auto', minHeight: 'auto' }} onClick={() => handleShowReceiptById(s.id)}>View Receipt</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* DEBTS VIEW */}
      <div className={`view ${activeTab === 'debts' ? 'active' : ''}`}>
        <div className="card">
          <div className="section-title">Customer Debts (Credit)</div>
          <div id="debtsList">
            {activeDebts.length === 0 ? (
              <div className="empty">No outstanding debts 🎉</div>
            ) : (
              activeDebts.slice().reverse().map(d => (
                <div className="list-row" key={d.id}>
                  <div>
                    <div className="prod-name" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleShowDebtReceipt(d)}>{d.customerName}</div>
                    <div className="prod-meta">{d.phone ? d.phone + ' · ' : ''}since {new Date(d.date).toLocaleDateString('en-NG')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="prod-stock low">{naira(d.balance)}</div>
                    <button className="btn btn-sm btn-ghost" style={{ marginTop: '4px' }} onClick={() => handleOpenDebtPayment(d)}>Add Payment</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* REPORTS VIEW */}
      <div className={`view ${activeTab === 'reports' ? 'active' : ''}`}>
        <div className="card">
          <div className="section-title">Reports</div>
          <select value={reportRange} onChange={(e) => setReportRange(e.target.value)}>
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
              <div className="ticket-row" style={{ fontSize: '14px' }}>
                <span>Revenue</span>
                <span>{naira(reportsData.revenue)}</span>
              </div>
              <div className="ticket-row" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)' }}>
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
              lowStockItems.map(p => (
                <div className="list-row" key={p.id}>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-stock low">{p.stock} {p.unit}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile Tabbar Controls */}
      <div className="tabbar">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          <span>Home</span>
        </button>
        <button className={`inventory ${activeTab === 'inventory' ? 'active' : ''} ${lowStockItems.length > 0 ? 'has-alert' : ''}`} onClick={() => setActiveTab('inventory')}>
          <span>Inventory</span>
          <span className="dot"></span>
        </button>
        <button className={activeTab === 'sale' ? 'active' : ''} onClick={() => setActiveTab('sale')}>
          <span>New Sale</span>
        </button>
        <button className={activeTab === 'sales-log' ? 'active' : ''} onClick={() => setActiveTab('sales-log')}>
          <span>Sales Log</span>
        </button>
        <button className={`debts ${activeTab === 'debts' ? 'active' : ''} ${totalDebtsOwed > 0 ? 'has-alert' : ''}`} onClick={() => setActiveTab('debts')}>
          <span>Debts</span>
          <span className="dot"></span>
        </button>
        {isOwner && (
          <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>
            <span>Reports</span>
          </button>
        )}
      </div>

      {/* Floating Action Button (Only in inventory view for owners) */}
      {activeTab === 'inventory' && isOwner && (
        <button className="fab" id="fabAdd" onClick={handleOpenAddProduct}>+</button>
      )}

      {/* --- MODALS BACKDROPS --- */}

      {/* MODAL: ADD/EDIT PRODUCT */}
      <div className={`modal-backdrop ${activeModal === 'product' ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
          <div className="modal-title">{editingProduct ? 'Edit Product' : 'Add Product'}</div>
          
          <form onSubmit={handleSaveProduct}>
            <div className="field-grid">
              <div className="field">
                <label>Product Name</label>
                <input name="p_name" defaultValue={editingProduct ? editingProduct.name : ''} placeholder="e.g. Cement (Dangote 50kg)" />
              </div>
              <div className="field">
                <label>Category</label>
                <input name="p_category" defaultValue={editingProduct ? editingProduct.category : ''} placeholder="e.g. Cement, Nails, Roofing" />
              </div>
              <div className="field">
                <label>Unit of Sale</label>
                <select name="p_unit" defaultValue={editingProduct ? editingProduct.unit : 'bag'}>
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
                <input name="p_stock" type="number" min="0" step="0.5" defaultValue={editingProduct ? editingProduct.stock : ''} placeholder="0" />
              </div>
              <div className="field">
                <label>Low Stock Alert Below</label>
                <input name="p_lowStock" type="number" min="0" step="0.5" defaultValue={editingProduct ? editingProduct.lowStock : ''} placeholder="e.g. 10" />
              </div>
              {isOwner && (
                <div className="field owner-only">
                  <label>Cost Price (₦ per unit)</label>
                  <input name="p_cost" type="number" min="0" defaultValue={editingProduct ? editingProduct.cost : ''} placeholder="0" />
                </div>
              )}
              <div className="field">
                <label>Selling Price (₦ per unit)</label>
                <input name="p_price" type="number" min="0" defaultValue={editingProduct ? editingProduct.price : ''} placeholder="0" />
              </div>
            </div>
            
            <div className="btn-row" style={{ marginTop: '16px' }}>
              {editingProduct && (
                <button type="button" className="btn btn-ghost" onClick={handleDeleteProduct}>Delete</button>
              )}
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL: CHECKOUT */}
      <div className={`modal-backdrop ${activeModal === 'checkout' ? 'active' : ''}`}>
        <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-handle"></div>
          <button className="modal-back" onClick={() => setActiveModal('confirm-cancel')}>←</button>
          <button className="modal-close" onClick={() => setActiveModal('confirm-cancel')}>✕</button>
          <div className="modal-title" style={{ paddingLeft: '28px' }}>Checkout &amp; Invoice Details</div>
          
          <div className="field-grid">
            <div className="field">
              <label>Payment Type</label>
              <select 
                value={checkoutForm.paymentType} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, paymentType: e.target.value })}
              >
                <option value="cash">Cash / Full Payment</option>
                <option value="credit">Credit (Pay Later)</option>
              </select>
            </div>
            <div className="field">
              <label>Customer Name</label>
              <input 
                value={checkoutForm.customerName} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })}
                placeholder="Customer name" 
              />
            </div>
            <div className="field">
              <label>Customer Phone</label>
              <input 
                value={checkoutForm.customerPhone} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customerPhone: e.target.value })}
                placeholder="080…" 
                type="tel" 
              />
            </div>
            <div className="field">
              <label>Customer Address</label>
              <input 
                value={checkoutForm.customerAddress} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, customerAddress: e.target.value })}
                placeholder="Customer address" 
              />
            </div>
            
            {checkoutForm.paymentType === 'credit' && (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Amount Paid Now (₦)</label>
                <input 
                  type="number" 
                  min="0" 
                  value={checkoutForm.amountPaid}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, amountPaid: e.target.value })}
                  placeholder="0" 
                />
              </div>
            )}
          </div>

          <div className="field-grid" style={{ marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
            <div className="field" style={{ gridColumn: '1 / -1', marginBottom: '2px' }}>
              <label style={{ fontWeight: 700, color: 'var(--steel-dark)' }}>Delivery &amp; Logistics (Optional)</label>
            </div>
            <div className="field">
              <label>Driver Name</label>
              <input 
                value={checkoutForm.driver} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, driver: e.target.value })}
                placeholder="Driver name" 
              />
            </div>
            <div className="field">
              <label>Car / Vehicle Details</label>
              <input 
                value={checkoutForm.car} 
                onChange={(e) => setCheckoutForm({ ...checkoutForm, car: e.target.value })}
                placeholder="e.g. Toyota Hilux (White)" 
              />
            </div>
            <div className="field">
              <label>Delivery Fee (₦)</label>
              <input 
                type="number" 
                min="0" 
                value={checkoutForm.deliveryFee}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, deliveryFee: e.target.value })}
                placeholder="0" 
              />
            </div>
            <div className="field">
              <label>Discount (₦)</label>
              <input 
                type="number" 
                min="0" 
                value={checkoutForm.discount}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, discount: e.target.value })}
                placeholder="0" 
              />
            </div>
          </div>
          
          <div className="field-grid" style={{ marginTop: '10px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
            <div className="field" style={{ gridColumn: '1 / -1', marginBottom: '2px' }}>
              <label style={{ fontWeight: 700, color: 'var(--steel-dark)' }}>Settlement Breakdown (Optional)</label>
            </div>
            <div className="field">
              <label>Cash Paid (₦)</label>
              <input 
                type="number" 
                min="0" 
                value={checkoutForm.payCash}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, payCash: e.target.value })}
                placeholder="0" 
              />
            </div>
            <div className="field">
              <label>Transfer 1 Paid (₦)</label>
              <input 
                type="number" 
                min="0" 
                value={checkoutForm.payTransfer1}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, payTransfer1: e.target.value })}
                placeholder="0" 
              />
            </div>
            <div className="field">
              <label>Transfer 2 Paid (₦)</label>
              <input 
                type="number" 
                min="0" 
                value={checkoutForm.payTransfer2}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, payTransfer2: e.target.value })}
                placeholder="0" 
              />
            </div>
          </div>
          
          <div 
            id="checkoutSummary" 
            style={{ marginTop: '14px', background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}
          >
            {checkoutSummary.summaryHtml}
          </div>

          <button className="btn btn-amber" style={{ marginTop: '14px', width: '100%' }} onClick={handleCompleteSale}>Complete Sale &amp; Generate E-Invoice</button>
        </div>
      </div>

      {/* MODAL: CONFIRM CANCEL CHECKOUT */}
      <div className={`modal-backdrop ${activeModal === 'confirm-cancel' ? 'active' : ''}`}>
        <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div className="modal-title">Cancel Checkout?</div>
          <p style={{ marginBottom: '20px', color: 'var(--ink-soft)', fontSize: '14.5px' }}>Are you sure you want to cancel the checkout? Your cart items will be saved.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setActiveModal('checkout')}>No, Continue</button>
            <button className="btn btn-danger" onClick={() => setActiveModal(null)}>Yes, Cancel</button>
          </div>
        </div>
      </div>

      {/* MODAL: RECEIPT DISPLAY */}
      <div className={`modal-backdrop ${activeModal === 'receipt' ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => { setActiveModal(null); setActiveTab('dashboard'); }}>✕</button>
          
          <div id="printArea">
            {currentReceipt && (
              <div className="invoice-a4">
                <svg className="invoice-ribbon-top" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
                  <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
                  <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
                </svg>
                <svg className="invoice-ribbon-bottom" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
                  <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
                  <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
                </svg>

                <div className="inv-header">
                  <img src="/Prince Iyke logo.png" alt="Logo" className="inv-logo-abs" />
                  <div className="inv-title-block">
                    <div className="inv-brand-title">PRINCE IYKE</div>
                    <div className="inv-brand-sub">BUILDING AND TECHNICAL TOOLS MERCHANTS</div>
                    <div className="inv-brand-div">(A Division of Obieze Holding)</div>
                    <div className="inv-brand-rc">RC 008855</div>
                    <div className="inv-brand-deals">
                      Ultimate in Building Material such as Cement, Zinc, Nails, Spade, Wheelbarrow, Paints, Welding/Filling Machine, General Supplies &amp; General Merchants
                    </div>
                    <div className="inv-brand-address">
                      <strong>Head Office:</strong> 57 New Timber Road after Apostolic Church Mbiabong Anyanya, Uyo. <span className="inv-tel-red">Tel: 08036722968, 08026078120</span>
                    </div>
                    <div className="inv-brand-address">
                      <strong>Branch Office:</strong> 223 Oron Road, Mbiabong Park U-turn, Uyo, Akwa Ibom State
                    </div>
                    <div className="inv-brand-address">
                      Ariria Int’l Market, Aba, Abia State. <span className="inv-tel-red">Tel: 08035586953</span>
                    </div>
                  </div>
                </div>

                {currentReceiptType === 'debt' && (
                  <div style={{ textAlign: 'center', marginTop: '-6px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#104080', border: '2px solid #104080', padding: '3px 12px', borderRadius: '4px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {currentReceipt.balance <= 0 ? 'Debt Clearance Receipt' : 'Debt Payment Receipt'}
                    </span>
                  </div>
                )}

                <div className="inv-details-grid">
                  <div className="inv-details-col">
                    <div className="inv-col-title">Party Details:</div>
                    <div className="inv-field"><span className="inv-label">Customer Name</span><span className="inv-val">{currentReceipt.customerName}</span></div>
                    <div className="inv-field"><span className="inv-label">Address</span><span className="inv-val">{currentReceipt.customerAddress || 'Walk-in Customer'}</span></div>
                    <div className="inv-field"><span className="inv-label">Phone</span><span className="inv-val">{currentReceipt.customerPhone || currentReceipt.phone || '—'}</span></div>
                  </div>
                  <div className="inv-details-col">
                    <div className="inv-col-title">Invoice/Ledger Details:</div>
                    <div className="inv-field"><span className="inv-label">Invoice No.</span><span className="inv-val" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{currentReceipt.invoiceNo || currentReceipt.id.slice(-8).toUpperCase()}</span></div>
                    <div className="inv-field"><span className="inv-label">Dated</span><span className="inv-val">{new Date(currentReceipt.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                    <div className="inv-field"><span className="inv-label">Staff/REP</span><span className="inv-val">{currentReceipt.staffName || 'System'}</span></div>
                    {currentReceiptType === 'sale' && (
                      <>
                        <div className="inv-field"><span className="inv-label">Driver</span><span className="inv-val">{currentReceipt.driver || '—'}</span></div>
                        <div className="inv-field"><span className="inv-label">Car</span><span className="inv-val">{currentReceipt.car || '—'}</span></div>
                      </>
                    )}
                  </div>
                </div>

                {currentReceiptType === 'sale' ? (
                  <>
                    <table className="inv-table">
                      <thead>
                        <tr>
                          <th style={{ width: '6%' }} className="center-col">S/N.</th>
                          <th style={{ width: '12%' }}>Reference</th>
                          <th style={{ width: '44%' }}>Description of Goods</th>
                          <th style={{ width: '8%' }} className="center-col">Qty.</th>
                          <th style={{ width: '8%' }} className="center-col">Unit</th>
                          <th style={{ width: '10%' }} className="num-col">Price</th>
                          <th style={{ width: '12%' }} className="num-col">Amount (NGN)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentReceipt.items.map((i, index) => (
                          <tr key={i.productId}>
                            <td className="center-col">{index + 1}</td>
                            <td>{i.productId ? i.productId.slice(-5).toUpperCase() : 'GOODS'}</td>
                            <td>{i.name}</td>
                            <td className="center-col">{i.qty}</td>
                            <td className="center-col">{i.unit}</td>
                            <td className="num-col">{naira(i.price)}</td>
                            <td className="num-col">{naira(i.subtotal)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan="5" className="inv-summary-label">Add: DELIVERY FEE</td>
                          <td colSpan="2" className="num-col" style={{ fontWeight: 600 }}>{naira(currentReceipt.deliveryFee)}</td>
                        </tr>
                        <tr>
                          <td colSpan="5" className="inv-summary-label">Less: DISCOUNT</td>
                          <td colSpan="2" className="num-col" style={{ fontWeight: 600, color: 'var(--red)' }}>{naira(currentReceipt.discount)}</td>
                        </tr>
                        <tr className="inv-grand-total-row">
                          <td colSpan="5" className="inv-summary-label" style={{ fontSize: '11px', color: '#1B8B3E' }}>Grand Total</td>
                          <td colSpan="2" className="num-col" style={{ fontSize: '12px', fontWeight: 800, color: '#1B8B3E' }}>{naira(currentReceipt.total)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="inv-words-box">
                      <span className="inv-words-title">In Words:</span>
                      <span className="inv-words-text">{formatGrandTotalInWords(currentReceipt.total)} Naira Only</span>
                    </div>

                    <div className="inv-footer-grid">
                      <div className="inv-settle-box">
                        <div className="inv-settle-title">Settlement Details</div>
                        <div className="inv-settle-row"><span className="inv-settle-label">PREVIOUS BAL:</span><span className="inv-settle-val">{naira(0)}</span></div>
                        <div className="inv-settle-row"><span className="inv-settle-label">CASH :</span><span className="inv-settle-val">{naira(currentReceipt.payCash)}</span></div>
                        <div className="inv-settle-row"><span className="inv-settle-label">TRANSFER 1 :</span><span className="inv-settle-val">{naira(currentReceipt.payTransfer1)}</span></div>
                        <div className="inv-settle-row"><span className="inv-settle-label">TRANSFER 2 :</span><span className="inv-settle-val">{naira(currentReceipt.payTransfer2)}</span></div>
                        <div className="inv-settle-row" style={{ fontWeight: 700 }}><span className="inv-settle-label">ACC. BALANCE :</span><span className="inv-settle-val">{naira(currentReceipt.balance)}</span></div>
                      </div>

                      <div className="inv-stamp-box">
                        <div className="inv-stamp-brand1">PRINCE IYKE</div>
                        <div className="inv-stamp-brand2">BUILDING &amp; TECHNICAL TOOLS MERCHANTS</div>
                        <div className="inv-stamp-paid">PAID</div>
                        <div className="inv-stamp-date">DATE: {new Date(currentReceipt.date).toLocaleDateString('en-NG')}</div>
                        <div className="inv-stamp-sig-line">Customer Signature</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#104080', textTransform: 'uppercase', marginBottom: '4px' }}>Outstanding Account Summary:</div>
                    <div className="inv-footer-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
                      <div className="inv-settle-box">
                        <div className="inv-settle-title">Clearance Statement</div>
                        <div className="inv-settle-row"><span className="inv-settle-label">ORIGINAL DEBT:</span><span className="inv-settle-val">{naira(currentReceipt.originalAmount)}</span></div>
                        {currentReceipt.payments.map((p, idx) => (
                          <div className="inv-settle-row" key={idx}>
                            <span className="inv-settle-label">PAYMENT #{idx + 1} ({new Date(p.date).toLocaleDateString('en-NG')}):</span>
                            <span className="inv-settle-val">{naira(p.amount)}</span>
                          </div>
                        ))}
                        <div className="inv-settle-row" style={{ fontWeight: 700, borderTop: '1px dashed #ccc', paddingTop: '4px' }}>
                          <span className="inv-settle-label">OUTSTANDING BAL:</span>
                          <span className="inv-settle-val" style={{ color: currentReceipt.balance <= 0 ? '#1B8B3E' : '#D32F2F' }}>{naira(currentReceipt.balance)}</span>
                        </div>
                      </div>

                      <div className="inv-stamp-box">
                        <div className="inv-stamp-brand1">PRINCE IYKE</div>
                        <div className="inv-stamp-brand2">BUILDING &amp; TECHNICAL TOOLS MERCHANTS</div>
                        <div className="inv-stamp-paid" style={{ color: currentReceipt.balance <= 0 ? '#1B8B3E' : '#E67E22' }}>
                          {currentReceipt.balance <= 0 ? 'DEBT CLEARED' : 'PARTIAL PYMT'}
                        </div>
                        <div className="inv-stamp-date">DATE: {new Date().toLocaleDateString('en-NG')}</div>
                        <div className="inv-stamp-sig-line">Customer Signature</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="inv-bottom-bar">
                  <div className="inv-thanks">
                    {currentReceiptType === 'sale' || currentReceipt.balance <= 0 
                      ? 'Thank you for your patronage!' 
                      : 'Thank you for your payment!'
                    }
                  </div>
                  <div className="inv-for-brand">For PRINCE IYKE BUILDING &amp; TECHNICAL TOOLS MERCHANTS</div>
                  <div className="inv-auth-line">Authorised Signatory</div>
                </div>
              </div>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: '16px' }}>
            <button className="btn btn-ghost" onClick={handlePrint}>Print / Save as PDF</button>
            <button className="btn btn-primary" onClick={handleShareReceipt}>Share</button>
          </div>
        </div>
      </div>

      {/* MODAL: STAFF MANAGEMENT */}
      <div className={`modal-backdrop ${activeModal === 'user' ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
          <div className="modal-title">Staff Management</div>
          <div id="userPicker">
            {users.map(u => (
              <div className="list-row" key={u.id} style={{ cursor: 'default', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div className="prod-name">
                    {u.name} {u.id === activeUser ? <span style={{ color: 'var(--steel)', fontSize: '12px' }}>(Active)</span> : ''}
                  </div>
                  <div className="prod-meta">{u.role}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  {u.role !== 'owner' ? (
                    <>
                      <input 
                        type="password" 
                        defaultValue={u.pin || '0000'}
                        placeholder="PIN" 
                        pattern="[0-9]*" 
                        inputMode="numeric" 
                        maxLength={4} 
                        style={{ width: '70px', padding: '4px 6px', fontSize: '13px', textAlign: 'center', fontFamily: 'var(--font-mono)', height: 'auto', border: '1.5px solid var(--line-strong)', borderRadius: '6px' }}
                        onChange={(e) => handleUpdateStaffPin(u.id, e.target.value)} 
                      />
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveStaff(u.id)} style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', background: 'var(--rust)' }}>Remove</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>PIN in Settings</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="ticket-hr"></div>
          <div className="field" style={{ marginTop: 0 }}>
            <label>Add New Staff</label>
            <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <input 
                placeholder="Staff Name" 
                value={newStaff.name} 
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} 
              />
              <input 
                placeholder="4-Digit PIN" 
                type="password" 
                pattern="[0-9]*" 
                inputMode="numeric" 
                maxLength={4} 
                value={newStaff.pin} 
                onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} 
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddStaff}>Add Staff Member</button>
          </div>
        </div>
      </div>

      {/* MODAL: SHOP SETTINGS */}
      <div className={`modal-backdrop ${activeModal === 'settings' ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
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
            <div className="field">
              <label>Owner PIN (4-Digits)</label>
              <input 
                type="password" 
                pattern="[0-9]*" 
                inputMode="numeric" 
                maxLength={4} 
                placeholder="••••"
                value={ownerPinEdit}
                onChange={(e) => setOwnerPinEdit(e.target.value)} 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '14px' }}>Save Settings</button>
          </form>
          
          <button className="btn btn-ghost" style={{ marginTop: '8px' }} onClick={handleOpenStaffManagement}>Manage Staff &amp; PINs</button>
          <div className="ticket-hr"></div>
          
          <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>All data is stored only on this device. Export a backup regularly.</div>
          <div className="btn-row" style={{ marginTop: '10px' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportBackup}>Export Backup</button>
            <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('importFile').click()}>Import Backup</button>
          </div>
          <input type="file" id="importFile" accept="application/json" style={{ display: 'none' }} onChange={handleImportBackup} />
        </div>
      </div>

      {/* MODAL: DEBT PAYMENT */}
      <div className={`modal-backdrop ${activeModal === 'payment' ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-handle"></div>
          <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
          <div className="modal-title">Record Payment</div>
          {recordingPaymentDebt && (
            <div id="pay_customerInfo" style={{ marginBottom: '10px', fontSize: '13.5px', color: 'var(--ink-soft)' }}>
              {recordingPaymentDebt.customerName} owes {naira(recordingPaymentDebt.balance)}
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
          <button className="btn btn-primary" style={{ marginTop: '14px' }} onClick={handleRecordDebtPayment}>Save Payment</button>
        </div>
      </div>

      {/* Toast Notification element */}
      {toast.show && <div className="toast show">{toast.message}</div>}
    </div>
  );
}
