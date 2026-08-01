/* =========================================================
   STOCKPOINT — Inventory, Sales & Debt tracker
   Fully offline, localStorage-backed, single-shop MVP.
   ========================================================= */

const DB_KEYS = {
  products: 'sp_products',
  sales: 'sp_sales',
  debts: 'sp_debts',
  users: 'sp_users',
  settings: 'sp_settings',
  activeUser: 'sp_activeUser',
  sessionActive: 'sp_sessionActive'
};

const DB = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
};

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function naira(n){ return '₦' + Number(n||0).toLocaleString('en-NG', {maximumFractionDigits:2}); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

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


/* ---------------- Seed defaults ---------------- */
function seedIfEmpty(){
  if(!DB.get(DB_KEYS.settings)){
    DB.set(DB_KEYS.settings, { shopName:'Prince Iyke Building & Technical Tools Merchants', address:'A Division of Obiezu Holding', phone:'' });
  }
  if(!DB.get(DB_KEYS.users)){
    DB.set(DB_KEYS.users, [
      { id: uid(), name:'Owner', role:'owner', pin:'0000' },
    ]);
  }
  if(!DB.get(DB_KEYS.activeUser)){
    const users = DB.get(DB_KEYS.users, []);
    DB.set(DB_KEYS.activeUser, users[0].id);
  }
  if(!DB.get(DB_KEYS.products)){
    DB.set(DB_KEYS.products, []);
  }
  if(!DB.get(DB_KEYS.sales)) DB.set(DB_KEYS.sales, []);
  if(!DB.get(DB_KEYS.debts)) DB.set(DB_KEYS.debts, []);
}

function getActiveUser(){
  const users = DB.get(DB_KEYS.users, []);
  const id = DB.get(DB_KEYS.activeUser);
  return users.find(u=>u.id===id) || users[0];
}
function isOwner(){ return getActiveUser() && getActiveUser().role === 'owner'; }

/* ---------------- Modal helper ---------------- */
const Modal = {
  open(id){ document.getElementById(id).classList.add('active'); },
  close(id){ document.getElementById(id).classList.remove('active'); }
};

/* ---------------- Views / Nav ---------------- */
const Views = {
  go(name){
    if(name==='reports' && !isOwner()){ Views.go('dashboard'); return; }
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+name).classList.add('active');
    document.querySelectorAll('.tabbar button').forEach(b=>b.classList.remove('active'));
    document.querySelector(`.tabbar button[data-tab="${name}"]`).classList.add('active');
    document.getElementById('fabAdd').style.display = (name==='inventory') ? 'block' : 'none';

    if(name==='dashboard') Dashboard.render();
    if(name==='inventory') Views.renderInventory();
    if(name==='sale') Sale.renderPicker();
    if(name==='debts') Debts.render();
    if(name==='reports') Reports.render();
    if(name==='sales-log') SalesLog.render();
    applyRoleVisibility();
  },

  renderInventory(){
    const q = (document.getElementById('invSearch').value || '').toLowerCase();
    const products = DB.get(DB_KEYS.products, []).filter(p => p.name.toLowerCase().includes(q));
    const list = document.getElementById('inventoryList');
    if(products.length===0){ list.innerHTML = '<div class="empty">No products found</div>'; return; }
    list.innerHTML = products.map(p=>{
      const low = p.stock <= p.lowStock;
      return `<div class="list-row" onclick="Product.openForm('${p.id}')">
        <div>
          <div class="prod-name">${escapeHtml(p.name)}</div>
          <div class="prod-meta">${escapeHtml(p.category||'—')} · ${naira(p.price)}/${p.unit} ${low?'<span class="badge badge-low">Low</span>':''}</div>
        </div>
        <div class="prod-stock ${low?'low':''}">${p.stock} ${p.unit}${p.stock!==1?'s':''}</div>
      </div>`;
    }).join('');
  },

  showSwitchUser(){ Users.renderPicker(); Modal.open('modal-user'); }
};

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function applyRoleVisibility(){
  const owner = isOwner();
  document.getElementById('activeUserLabel').textContent = getActiveUser() ? `${getActiveUser().name} (${getActiveUser().role})` : '—';
  // hide cost price / profit for staff
  document.querySelectorAll('.owner-only').forEach(el => el.style.display = owner ? '' : 'none');
  document.querySelector('.tabbar button[data-tab="reports"]').style.display = owner ? '' : 'none';

  const activeTab = document.querySelector('.tabbar button.active');
  const name = activeTab ? activeTab.getAttribute('data-tab') : '';
  document.getElementById('fabAdd').style.display = (name==='inventory' && owner) ? 'block' : 'none';
}

/* ---------------- Dashboard ---------------- */
const Dashboard = {
  render(){
    const sales = DB.get(DB_KEYS.sales, []);
    const products = DB.get(DB_KEYS.products, []);
    const debts = DB.get(DB_KEYS.debts, []);
    const today = todayStr();

    const todaySales = sales.filter(s=>s.date.slice(0,10)===today).reduce((sum,s)=>sum+s.total,0);
    document.getElementById('stat-todaySales').textContent = naira(todaySales);

    const lowItems = products.filter(p=>p.stock <= p.lowStock);
    document.getElementById('stat-lowStock').textContent = lowItems.length;

    const totalDebt = debts.reduce((sum,d)=>sum+d.balance,0);
    document.getElementById('stat-debt').textContent = naira(totalDebt);

    const stockValue = products.reduce((sum,p)=>sum + p.stock * (isOwner() ? p.cost : p.price), 0);
    document.getElementById('stat-stockValue').textContent = naira(stockValue);

    const banner = document.getElementById('lowStockBanner');
    if(lowItems.length){
      banner.style.display = 'block';
      document.getElementById('lowStockList').innerHTML = lowItems.map(p=>
        `<div class="list-row"><div class="prod-name">${escapeHtml(p.name)}</div><div class="prod-stock low">${p.stock} ${p.unit}</div></div>`
      ).join('');
    } else banner.style.display = 'none';

    // mark tab dot
    document.querySelector('.tabbar button[data-tab="inventory"]').classList.toggle('has-alert', lowItems.length>0);
    document.querySelector('.tabbar button[data-tab="debts"]').classList.toggle('has-alert', totalDebt>0);

    const recent = sales.slice().reverse().slice(0,6);
    const recentList = document.getElementById('recentSalesList');
    if(recent.length===0){ recentList.innerHTML = '<div class="empty">No sales yet</div>'; }
    else {
      recentList.innerHTML = recent.map(s=>`
        <div class="list-row" onclick="Receipt.showById('${s.id}')" style="cursor:pointer;">
          <div>
            <div class="prod-name">${naira(s.total)} ${s.paymentType==='credit'?'<span class="badge badge-credit">Credit</span>':''}</div>
            <div class="prod-meta">${s.customerName||'Walk-in'} · ${s.staffName} · ${new Date(s.date).toLocaleString('en-NG',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})}</div>
          </div>
        </div>`).join('');
    }
  }
};

/* ---------------- Product CRUD ---------------- */
const Product = {
  openForm(id){
    if(!isOwner()){ showToast('Only Owner can add/edit products'); return; }
    const isEdit = !!id;
    document.getElementById('productModalTitle').textContent = isEdit ? 'Edit Product' : 'Add Product';
    document.getElementById('p_deleteBtn').style.display = isEdit ? 'inline-flex' : 'none';
    if(isEdit){
      const p = DB.get(DB_KEYS.products, []).find(x=>x.id===id);
      document.getElementById('p_id').value = p.id;
      document.getElementById('p_name').value = p.name;
      document.getElementById('p_category').value = p.category||'';
      document.getElementById('p_unit').value = p.unit;
      document.getElementById('p_stock').value = p.stock;
      document.getElementById('p_lowStock').value = p.lowStock;
      document.getElementById('p_cost').value = p.cost;
      document.getElementById('p_price').value = p.price;
    } else {
      ['p_id','p_name','p_category','p_stock','p_lowStock','p_cost','p_price'].forEach(f=>document.getElementById(f).value='');
      document.getElementById('p_unit').value = 'bag';
    }
    Modal.open('modal-product');
  },
  save(){
    const name = document.getElementById('p_name').value.trim();
    if(!name){ showToast('Enter a product name'); return; }
    const id = document.getElementById('p_id').value;
    const products = DB.get(DB_KEYS.products, []);
    const data = {
      name,
      category: document.getElementById('p_category').value.trim(),
      unit: document.getElementById('p_unit').value,
      stock: parseFloat(document.getElementById('p_stock').value) || 0,
      lowStock: parseFloat(document.getElementById('p_lowStock').value) || 0,
      cost: parseFloat(document.getElementById('p_cost').value) || 0,
      price: parseFloat(document.getElementById('p_price').value) || 0,
    };
    if(id){
      const idx = products.findIndex(p=>p.id===id);
      products[idx] = { ...products[idx], ...data };
    } else {
      products.push({ id: uid(), ...data });
    }
    DB.set(DB_KEYS.products, products);
    Modal.close('modal-product');
    Views.renderInventory();
    Dashboard.render();
    showToast('Product saved');
  },
  remove(){
    const id = document.getElementById('p_id').value;
    if(!id) return;
    if(!confirm('Delete this product?')) return;
    let products = DB.get(DB_KEYS.products, []).filter(p=>p.id!==id);
    DB.set(DB_KEYS.products, products);
    Modal.close('modal-product');
    Views.renderInventory();
    Dashboard.render();
    showToast('Product deleted');
  }
};

/* ---------------- Sale flow ---------------- */
let cart = []; // {productId, name, unit, qty, price}

const Sale = {
  renderPicker(){
    const q = (document.getElementById('saleSearch').value || '').toLowerCase();
    const picker = document.getElementById('salePicker');
    if(!q){ picker.innerHTML = '<div class="empty">Start typing a product name</div>'; return; }
    const products = DB.get(DB_KEYS.products, []).filter(p=>p.name.toLowerCase().includes(q));
    if(products.length===0){ picker.innerHTML = '<div class="empty">No matching product</div>'; return; }
    picker.innerHTML = products.slice(0,6).map(p=>`
      <div class="list-row" onclick="Sale.addToCart('${p.id}')">
        <div><div class="prod-name">${escapeHtml(p.name)}</div><div class="prod-meta">${naira(p.price)}/${p.unit} · ${p.stock} in stock</div></div>
        <div style="font-size:20px;color:var(--steel);">+</div>
      </div>`).join('');
  },
  addToCart(productId){
    const p = DB.get(DB_KEYS.products, []).find(x=>x.id===productId);
    if(!p) return;
    if(p.stock <= 0){ showToast('Out of stock'); return; }
    const existing = cart.find(c=>c.productId===productId);
    if(existing) existing.qty += 1;
    else cart.push({ productId, name:p.name, unit:p.unit, qty:1, price:p.price });
    document.getElementById('saleSearch').value='';
    document.getElementById('salePicker').innerHTML='';
    Sale.renderCart();
  },
  changeQty(productId, delta){
    const item = cart.find(c=>c.productId===productId);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0) cart = cart.filter(c=>c.productId!==productId);
    Sale.renderCart();
  },
  changePrice(productId, newPrice){
    const item = cart.find(c=>c.productId===productId);
    if(!item) return;
    const price = parseFloat(newPrice);
    if(!isNaN(price) && price >= 0){
      item.price = price;
    }
    Sale.renderCart();
  },
  renderCart(){
    const list = document.getElementById('cartList');
    if(cart.length===0){ list.innerHTML = '<div class="empty">Cart is empty — search above to add items</div>'; }
    else {
      list.innerHTML = cart.map(c=>`
        <div class="cart-item">
          <div style="flex:1;">
            <div class="prod-name">${escapeHtml(c.name)}</div>
            <div class="prod-meta" style="display:flex;align-items:center;gap:4px;margin-top:4px;flex-wrap:wrap;">
              <span>Price: ₦</span>
              <input type="number" class="cart-price-input" value="${c.price}" onchange="Sale.changePrice('${c.productId}', this.value)" min="0" step="any">
              <span>× ${c.qty} ${c.unit} = ${naira(c.price*c.qty)}</span>
            </div>
          </div>
          <div class="qty-ctrl">
            <button onclick="Sale.changeQty('${c.productId}', -1)">−</button>
            <span style="font-family:var(--font-mono);min-width:20px;text-align:center;">${c.qty}</span>
            <button onclick="Sale.changeQty('${c.productId}', 1)">+</button>
          </div>
        </div>`).join('');
    }
    const total = cart.reduce((s,c)=>s+c.price*c.qty,0);
    document.getElementById('cartTotal').textContent = naira(total);
  },
  openCheckout(){
    if(cart.length===0){ showToast('Add items to cart first'); return; }
    document.getElementById('c_paymentType').value='cash';
    document.getElementById('c_customerName').value='';
    document.getElementById('c_customerPhone').value='';
    document.getElementById('c_customerAddress').value='';
    document.getElementById('c_amountPaid').value='';
    document.getElementById('c_driver').value='';
    document.getElementById('c_car').value='';
    document.getElementById('c_deliveryFee').value='';
    document.getElementById('c_discount').value='';
    document.getElementById('c_payCash').value='';
    document.getElementById('c_payTransfer1').value='';
    document.getElementById('c_payTransfer2').value='';
    Sale.togglePaymentFields();
    Sale.updateCheckoutSummary();
    Modal.open('modal-checkout');
  },
  togglePaymentFields(){
    const type = document.getElementById('c_paymentType').value;
    document.getElementById('c_amountPaidWrap').style.display = type==='credit' ? 'block' : 'none';
    Sale.updateCheckoutSummary();
  },
  updateCheckoutSummary(){
    const subtotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
    const deliveryFee = parseFloat(document.getElementById('c_deliveryFee').value) || 0;
    const discount = parseFloat(document.getElementById('c_discount').value) || 0;
    const grandTotal = subtotal + deliveryFee - discount;
    
    const type = document.getElementById('c_paymentType').value;
    let summaryHtml = `Cart Subtotal: ${naira(subtotal)}<br>`;
    if (deliveryFee > 0) summaryHtml += `Delivery Fee: +${naira(deliveryFee)}<br>`;
    if (discount > 0) summaryHtml += `Discount: -${naira(discount)}<br>`;
    summaryHtml += `<strong>Grand Total: ${naira(grandTotal)}</strong><br>`;
    
    if (type === 'credit') {
      const amountPaid = parseFloat(document.getElementById('c_amountPaid').value) || 0;
      const balance = grandTotal - amountPaid;
      summaryHtml += `Paid Now: ${naira(amountPaid)}<br>`;
      summaryHtml += `<span style="color:var(--red); font-weight:700;">Balance (Credit): ${naira(balance)}</span>`;
    } else {
      summaryHtml += `<span style="color:var(--green); font-weight:700;">Payment Status: PAID IN FULL</span>`;
    }
    document.getElementById('checkoutSummary').innerHTML = summaryHtml;
  },
  requestCancelCheckout(){
    Modal.open('modal-confirm-cancel');
  },
  confirmCancelCheckout(){
    Modal.close('modal-confirm-cancel');
    Modal.close('modal-checkout');
  },
  complete(){
    const type = document.getElementById('c_paymentType').value;
    const customerName = document.getElementById('c_customerName').value.trim();
    const customerPhone = document.getElementById('c_customerPhone').value.trim();
    const customerAddress = document.getElementById('c_customerAddress').value.trim();
    const driver = document.getElementById('c_driver').value.trim();
    const car = document.getElementById('c_car').value.trim();
    const deliveryFee = parseFloat(document.getElementById('c_deliveryFee').value) || 0;
    const discount = parseFloat(document.getElementById('c_discount').value) || 0;
    const payCash = parseFloat(document.getElementById('c_payCash').value) || 0;
    const payTransfer1 = parseFloat(document.getElementById('c_payTransfer1').value) || 0;
    const payTransfer2 = parseFloat(document.getElementById('c_payTransfer2').value) || 0;

    if(type==='credit' && !customerName){ showToast('Customer name required for credit sale'); return; }

    const subtotal = cart.reduce((s,c)=>s+c.price*c.qty,0);
    const grandTotal = subtotal + deliveryFee - discount;
    let amountPaid = grandTotal, balance = 0;
    if(type==='credit'){
      amountPaid = parseFloat(document.getElementById('c_amountPaid').value) || 0;
      balance = grandTotal - amountPaid;
    }

    // deduct stock
    const products = DB.get(DB_KEYS.products, []);
    cart.forEach(c=>{
      const p = products.find(x=>x.id===c.productId);
      if(p) p.stock = Math.max(0, p.stock - c.qty);
    });
    DB.set(DB_KEYS.products, products);

    const sales = DB.get(DB_KEYS.sales, []);
    const invoiceSeq = sales.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNo = `PI-${currentYear}-${String(invoiceSeq).padStart(4, '0')}`;

    const sale = {
      id: uid(),
      invoiceNo,
      date: new Date().toISOString(),
      items: cart.map(c=>({...c, subtotal:c.price*c.qty})),
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
      staffName: getActiveUser().name,
      amountPaid,
      balance,
      payCash,
      payTransfer1,
      payTransfer2
    };
    sales.push(sale);
    DB.set(DB_KEYS.sales, sales);

    if(type==='credit' && balance > 0){
      const debts = DB.get(DB_KEYS.debts, []);
      debts.push({
        id: uid(), saleId: sale.id, customerName, phone: customerPhone,
        originalAmount: balance, balance, date: sale.date, payments: []
      });
      DB.set(DB_KEYS.debts, debts);
    }

    Modal.close('modal-checkout');
    Receipt.show(sale);
    cart = [];
    Sale.renderCart();
    Dashboard.render();
  }
};

/* ---------------- Receipt ---------------- */
const Receipt = {
  show(sale){
    const settings = DB.get(DB_KEYS.settings, {});
    const deliveryFee = sale.deliveryFee || 0;
    const discount = sale.discount || 0;
    const subtotal = sale.cartSubtotal || sale.total;
    const grandTotal = sale.total;
    const payCash = sale.payCash || 0;
    const payTransfer1 = sale.payTransfer1 || 0;
    const payTransfer2 = sale.payTransfer2 || 0;

    const itemsHtml = sale.items.map((i, index)=>`
      <tr>
        <td class="center-col">${index + 1}</td>
        <td>${escapeHtml(i.productId ? i.productId.slice(-5).toUpperCase() : 'GOODS')}</td>
        <td>${escapeHtml(i.name)}</td>
        <td class="center-col">${i.qty}</td>
        <td class="center-col">${escapeHtml(i.unit)}</td>
        <td class="num-col">${naira(i.price)}</td>
        <td class="num-col">${naira(i.subtotal)}</td>
      </tr>`).join('');

    const grandTotalInWords = formatGrandTotalInWords(grandTotal);
    const prevBal = 0;
    const accBalance = sale.balance || 0;

    document.getElementById('ticketContent').innerHTML = `
      <div class="invoice-a4">
        <svg class="invoice-ribbon-top" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
          <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
          <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
        </svg>
        <svg class="invoice-ribbon-bottom" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
          <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
          <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
        </svg>

        <div class="inv-header">
          <img src="Prince Iyke logo.png" alt="Logo" class="inv-logo-abs">
          <div class="inv-title-block">
            <div class="inv-brand-title">PRINCE IYKE</div>
            <div class="inv-brand-sub">BUILDING AND TECHNICAL TOOLS MERCHANTS</div>
            <div class="inv-brand-div">(A Division of Obieze Holding)</div>
            <div class="inv-brand-rc">RC 008855</div>
            <div class="inv-brand-deals">
              Ultimate in Building Material such as Cement, Zinc, Nails, Spade, Wheelbarrow, Paints, Welding/Filling Machine, General Supplies &amp; General Merchants
            </div>
            <div class="inv-brand-address">
              <strong>Head Office:</strong> 57 New Timber Road after Apostolic Church Mbiabong Anyanya, Uyo. <span class="inv-tel-red">Tel: 08036722968, 08026078120</span>
            </div>
            <div class="inv-brand-address">
              <strong>Branch Office:</strong> 223 Oron Road, Mbiabong Park U-turn, Uyo, Akwa Ibom State
            </div>
            <div class="inv-brand-address">
              Ariria Int’l Market, Aba, Abia State. <span class="inv-tel-red">Tel: 08035586953</span>
            </div>
          </div>
        </div>

        <div class="inv-details-grid">
          <div class="inv-details-col">
            <div class="inv-col-title">Party Details:</div>
            <div class="inv-field"><span class="inv-label">Customer Name</span><span class="inv-val">${escapeHtml(sale.customerName)}</span></div>
            <div class="inv-field"><span class="inv-label">Address</span><span class="inv-val">${escapeHtml(sale.customerAddress||'Walk-in Customer')}</span></div>
            <div class="inv-field"><span class="inv-label">Phone</span><span class="inv-val">${escapeHtml(sale.customerPhone||'—')}</span></div>
          </div>
          <div class="inv-details-col">
            <div class="inv-col-title">Invoice Details:</div>
            <div class="inv-field"><span class="inv-label">Invoice No.</span><span class="inv-val" style="font-family:var(--font-mono);font-weight:700;">${escapeHtml(sale.invoiceNo||sale.id.slice(-8).toUpperCase())}</span></div>
            <div class="inv-field"><span class="inv-label">Dated</span><span class="inv-val">${new Date(sale.date).toLocaleDateString('en-NG', {day:'numeric', month:'short', year:'numeric'})}</span></div>
            <div class="inv-field"><span class="inv-label">Staff/Sales Rep</span><span class="inv-val">${escapeHtml(sale.staffName)}</span></div>
            <div class="inv-field"><span class="inv-label">Driver</span><span class="inv-val">${escapeHtml(sale.driver||'—')}</span></div>
            <div class="inv-field"><span class="inv-label">Car</span><span class="inv-val">${escapeHtml(sale.car||'—')}</span></div>
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:6%;" class="center-col">S/N.</th>
              <th style="width:12%;">Reference</th>
              <th style="width:44%;">Description of Goods</th>
              <th style="width:8%;" class="center-col">Qty.</th>
              <th style="width:8%;" class="center-col">Unit</th>
              <th style="width:10%;" class="num-col">Price</th>
              <th style="width:12%;" class="num-col">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr>
              <td colspan="5" class="inv-summary-label">Add: DELIVERY FEE</td>
              <td colspan="2" class="num-col" style="font-weight:600;">${naira(deliveryFee)}</td>
            </tr>
            <tr>
              <td colspan="5" class="inv-summary-label">Less: DISCOUNT</td>
              <td colspan="2" class="num-col" style="font-weight:600;color:var(--red);">${naira(discount)}</td>
            </tr>
            <tr class="inv-grand-total-row">
              <td colspan="5" class="inv-summary-label" style="font-size:11px;color:#1B8B3E;">Grand Total</td>
              <td colspan="2" class="num-col" style="font-size:12px;font-weight:800;color:#1B8B3E;">${naira(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="inv-words-box">
          <span class="inv-words-title">In Words:</span>
          <span class="inv-words-text">${grandTotalInWords} Naira Only</span>
        </div>

        <div class="inv-footer-grid">
          <div class="inv-settle-box">
            <div class="inv-settle-title">Settlement Details</div>
            <div class="inv-settle-row"><span class="inv-settle-label">PREVIOUS BAL:</span><span class="inv-settle-val">${naira(prevBal)}</span></div>
            <div class="inv-settle-row"><span class="inv-settle-label">CASH :</span><span class="inv-settle-val">${naira(payCash)}</span></div>
            <div class="inv-settle-row"><span class="inv-settle-label">TRANSFER 1 :</span><span class="inv-settle-val">${naira(payTransfer1)}</span></div>
            <div class="inv-settle-row"><span class="inv-settle-label">TRANSFER 2 :</span><span class="inv-settle-val">${naira(payTransfer2)}</span></div>
            <div class="inv-settle-row" style="font-weight:700;"><span class="inv-settle-label">ACC. BALANCE :</span><span class="inv-settle-val">${naira(accBalance)}</span></div>
          </div>

          <div class="inv-stamp-box">
            <div class="inv-stamp-brand1">PRINCE IYKE</div>
            <div class="inv-stamp-brand2">BUILDING & TECHNICAL TOOLS MERCHANTS</div>
            <div class="inv-stamp-paid">PAID</div>
            <div class="inv-stamp-date">DATE: ${new Date(sale.date).toLocaleDateString('en-NG')}</div>
            <div class="inv-stamp-sig-line">Customer Signature</div>
          </div>
        </div>

        <div class="inv-bottom-bar">
          <div class="inv-thanks">Thank you for your patronage!</div>
          <div class="inv-for-brand">For PRINCE IYKE BUILDING & TECHNICAL TOOLS MERCHANTS</div>
          <div class="inv-auth-line">Authorised Signatory</div>
        </div>
      </div>
    `;
    Receipt._current = sale;
    Modal.open('modal-receipt');
  },
  print(){ window.print(); },
  share(){
    const s = Receipt._current;
    if(!s) return;
    const settings = DB.get(DB_KEYS.settings, {});
    const lines = s.items.map(i=>`${i.name} x${i.qty}${i.unit} — ${naira(i.subtotal)}`).join('\n');
    let text = `${settings.shopName||'PRINCE IYKE'}\nRC: 008855\nInvoice No: ${s.invoiceNo||s.id.slice(-8).toUpperCase()}\nDate: ${new Date(s.date).toLocaleString('en-NG')}\nCustomer: ${s.customerName}\nPhone: ${s.customerPhone||'—'}\n\n${lines}\n\n`;
    if(s.deliveryFee > 0) text += `Delivery Fee: ${naira(s.deliveryFee)}\n`;
    if(s.discount > 0) text += `Discount: -${naira(s.discount)}\n`;
    text += `TOTAL: ${naira(s.total)}\n`;
    if(s.paymentType==='credit'){
      text += `Paid: ${naira(s.amountPaid)}\nBalance: ${naira(s.balance)}\n`;
    } else {
      text += `PAID IN FULL (CASH)\n`;
    }
    text += `\nThank you for your patronage!`;
    if(navigator.share){
      navigator.share({ title:'Receipt', text }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(text).then(()=>showToast('Receipt copied — paste into WhatsApp'));
    }
  },
  showById(saleId) {
    const sale = DB.get(DB_KEYS.sales, []).find(s => s.id === saleId);
    if (sale) Receipt.show(sale);
  },
  showDebtReceipt(debt, paymentAmount) {
    const settings = DB.get(DB_KEYS.settings, {});
    const sales = DB.get(DB_KEYS.sales, []);
    const originalSale = sales.find(s => s.id === debt.saleId) || {};
    
    const items = originalSale.items || [];
    const itemsHtml = items.map((i, index)=>`
      <tr>
        <td class="center-col">${index + 1}</td>
        <td>${escapeHtml(i.productId ? i.productId.slice(-5).toUpperCase() : 'GOODS')}</td>
        <td>${escapeHtml(i.name)}</td>
        <td class="center-col">${i.qty}</td>
        <td class="center-col">${escapeHtml(i.unit)}</td>
        <td class="num-col">${naira(i.price)}</td>
        <td class="num-col">${naira(i.subtotal)}</td>
      </tr>`).join('');

    const paymentsHtml = debt.payments.map((p, idx)=>`
      <div class="inv-settle-row">
        <span class="inv-settle-label">PAYMENT #${idx+1} (${new Date(p.date).toLocaleDateString('en-NG')}):</span>
        <span class="inv-settle-val">${naira(p.amount)}</span>
      </div>
    `).join('');

    const isCleared = debt.balance <= 0;
    const stampText = isCleared ? 'DEBT CLEARED' : 'PARTIAL PYMT';
    const stampColor = isCleared ? '#1B8B3E' : '#E67E22';

    document.getElementById('ticketContent').innerHTML = `
      <div class="invoice-a4">
        <svg class="invoice-ribbon-top" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
          <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
          <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
        </svg>
        <svg class="invoice-ribbon-bottom" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 C 40 20, 80 60, 100 100 L 100 0 Z" fill="#104080"/>
          <path d="M 0 0 C 35 15, 70 45, 90 80 L 100 80 C 90 35, 50 10, 0 0 Z" fill="#E67E22"/>
          <path d="M 0 0 C 30 10, 60 30, 80 60 L 90 60 C 70 20, 40 5, 0 0 Z" fill="#1B8B3E"/>
        </svg>

        <div class="inv-header">
          <img src="Prince Iyke logo.png" alt="Logo" class="inv-logo-abs">
          <div class="inv-title-block">
            <div class="inv-brand-title">PRINCE IYKE</div>
            <div class="inv-brand-sub">BUILDING AND TECHNICAL TOOLS MERCHANTS</div>
            <div class="inv-brand-div">(A Division of Obieze Holding)</div>
            <div class="inv-brand-rc">RC 008855</div>
            <div class="inv-brand-deals">
              Ultimate in Building Material such as Cement, Zinc, Nails, Spade, Wheelbarrow, Paints, Welding/Filling Machine, General Supplies &amp; General Merchants
            </div>
            <div class="inv-brand-address">
              <strong>Head Office:</strong> 57 New Timber Road after Apostolic Church Mbiabong Anyanya, Uyo. <span class="inv-tel-red">Tel: 08036722968, 08026078120</span>
            </div>
            <div class="inv-brand-address">
              <strong>Branch Office:</strong> 223 Oron Road, Mbiabong Park U-turn, Uyo, Akwa Ibom State
            </div>
            <div class="inv-brand-address">
              Ariria Int’l Market, Aba, Abia State. <span class="inv-tel-red">Tel: 08035586953</span>
            </div>
          </div>
        </div>

        <div style="text-align:center; margin-top:-6px; margin-bottom:10px;">
          <span style="font-size:12px; font-weight:800; color:#104080; border: 2px solid #104080; padding:3px 12px; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase;">
            ${isCleared ? 'Debt Clearance Receipt' : 'Debt Payment Receipt'}
          </span>
        </div>

        <div class="inv-details-grid">
          <div class="inv-details-col">
            <div class="inv-col-title">Customer details:</div>
            <div class="inv-field"><span class="inv-label">Customer Name</span><span class="inv-val">${escapeHtml(debt.customerName)}</span></div>
            <div class="inv-field"><span class="inv-label">Phone</span><span class="inv-val">${escapeHtml(debt.phone||'—')}</span></div>
          </div>
          <div class="inv-details-col">
            <div class="inv-col-title">Reference details:</div>
            <div class="inv-field"><span class="inv-label">Invoice No.</span><span class="inv-val" style="font-family:var(--font-mono);font-weight:700;">${escapeHtml(originalSale.invoiceNo||'—')}</span></div>
            <div class="inv-field"><span class="inv-label">Dated</span><span class="inv-val">${originalSale.date ? new Date(originalSale.date).toLocaleDateString('en-NG') : '—'}</span></div>
            <div class="inv-field"><span class="inv-label">Payment Date</span><span class="inv-val">${new Date().toLocaleDateString('en-NG')}</span></div>
          </div>
        </div>

        <div style="font-size:9px; font-weight:700; color:#104080; text-transform:uppercase; margin-bottom:4px;">Original Transaction Items:</div>
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:6%;" class="center-col">S/N.</th>
              <th style="width:12%;">Reference</th>
              <th style="width:44%;">Description of Goods</th>
              <th style="width:8%;" class="center-col">Qty.</th>
              <th style="width:8%;" class="center-col">Unit</th>
              <th style="width:10%;" class="num-col">Price</th>
              <th style="width:12%;" class="num-col">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="7" style="text-align:center;">Items list unavailable</td></tr>'}
            <tr class="inv-grand-total-row">
              <td colspan="5" class="inv-summary-label" style="font-size:10px;color:#104080;">Original Invoice Total</td>
              <td colspan="2" class="num-col" style="font-size:10.5px;font-weight:800;color:#104080;">${naira(originalSale.total || debt.originalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="inv-footer-grid">
          <div class="inv-settle-box">
            <div class="inv-settle-title">Clearance Statement</div>
            <div class="inv-settle-row"><span class="inv-settle-label">ORIGINAL DEBT:</span><span class="inv-settle-val">${naira(debt.originalAmount)}</span></div>
            ${paymentsHtml}
            <div class="inv-settle-row" style="font-weight:700; border-top:1px dashed #ccc; padding-top:4px;"><span class="inv-settle-label">OUTSTANDING BAL:</span><span class="inv-settle-val" style="color:${isCleared ? '#1B8B3E' : '#D32F2F'}">${naira(debt.balance)}</span></div>
          </div>

          <div class="inv-stamp-box">
            <div class="inv-stamp-brand1">PRINCE IYKE</div>
            <div class="inv-stamp-brand2">BUILDING & TECHNICAL TOOLS MERCHANTS</div>
            <div class="inv-stamp-paid" style="color:${stampColor};">${stampText}</div>
            <div class="inv-stamp-date">DATE: ${new Date().toLocaleDateString('en-NG')}</div>
            <div class="inv-stamp-sig-line">Customer Signature</div>
          </div>
        </div>

        <div class="inv-bottom-bar">
          <div class="inv-thanks">${isCleared ? 'Thank you for clearing your account!' : 'Thank you for your payment!'}</div>
          <div class="inv-for-brand">For PRINCE IYKE BUILDING & TECHNICAL TOOLS MERCHANTS</div>
          <div class="inv-auth-line">Authorised Signatory</div>
        </div>
      </div>
    `;
    
    Receipt._current = {
      ...originalSale,
      customerName: debt.customerName,
      customerPhone: debt.phone,
      total: paymentAmount,
      invoiceNo: `${originalSale.invoiceNo || 'INV'}-PAY`,
      items: [{ name: `Debt Payment towards ${originalSale.invoiceNo||'Invoice'}`, price: paymentAmount, qty: 1, unit: 'pcs', subtotal: paymentAmount }]
    };
    
    Modal.open('modal-receipt');
  }
};

/* ---------------- Debts ---------------- */
const Debts = {
  render(){
    const debts = DB.get(DB_KEYS.debts, []).filter(d=>d.balance > 0);
    const list = document.getElementById('debtsList');
    if(debts.length===0){ list.innerHTML = '<div class="empty">No outstanding debts 🎉</div>'; return; }
    list.innerHTML = debts.slice().reverse().map(d=>`
      <div class="list-row">
        <div>
          <div class="prod-name">${escapeHtml(d.customerName)}</div>
          <div class="prod-meta">${d.phone ? escapeHtml(d.phone)+' · ' : ''}since ${new Date(d.date).toLocaleDateString('en-NG')}</div>
        </div>
        <div style="text-align:right;">
          <div class="prod-stock low">${naira(d.balance)}</div>
          <button class="btn btn-sm btn-ghost" style="margin-top:4px;" onclick="Debts.openPayment('${d.id}')">Add Payment</button>
        </div>
      </div>`).join('');
  },
  openPayment(debtId){
    const debt = DB.get(DB_KEYS.debts, []).find(d=>d.id===debtId);
    if(!debt) return;
    document.getElementById('pay_debtId').value = debtId;
    document.getElementById('pay_customerInfo').textContent = `${debt.customerName} owes ${naira(debt.balance)}`;
    document.getElementById('pay_amount').value = '';
    Modal.open('modal-payment');
  },
  recordPayment(){
    const debtId = document.getElementById('pay_debtId').value;
    const amount = parseFloat(document.getElementById('pay_amount').value) || 0;
    if(amount<=0){ showToast('Enter a valid amount'); return; }
    const debts = DB.get(DB_KEYS.debts, []);
    const debt = debts.find(d=>d.id===debtId);
    debt.payments.push({ date: new Date().toISOString(), amount });
    debt.balance = Math.max(0, debt.balance - amount);
    DB.set(DB_KEYS.debts, debts);
    Modal.close('modal-payment');
    Debts.render();
    Dashboard.render();
    showToast('Payment recorded');
    Receipt.showDebtReceipt(debt, amount);
  }
};

/* ---------------- Reports ---------------- */
const Reports = {
  render(){
    if(!isOwner()){
      document.getElementById('profitCard').style.display='none';
    } else {
      document.getElementById('profitCard').style.display='block';
    }
    const range = document.getElementById('reportRange').value;
    const sales = DB.get(DB_KEYS.sales, []).filter(s=>{
      if(range==='all') return true;
      const d = new Date(s.date);
      const now = new Date();
      if(range==='today') return d.toDateString()===now.toDateString();
      if(range==='week'){ const diff=(now-d)/(1000*60*60*24); return diff<=7; }
      return true;
    });

    // best sellers
    const qtyMap = {};
    sales.forEach(s=>s.items.forEach(i=>{
      qtyMap[i.name] = (qtyMap[i.name]||0) + i.qty;
    }));
    const best = Object.entries(qtyMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById('bestSellers').innerHTML = best.length ? best.map(([name,qty])=>
      `<div class="list-row"><div class="prod-name">${escapeHtml(name)}</div><div class="prod-stock">${qty} sold</div></div>`
    ).join('') : '<div class="empty">No sales in this range</div>';

    // profit (owner only)
    if(isOwner()){
      const products = DB.get(DB_KEYS.products, []);
      let profit = 0, revenue = 0;
      sales.forEach(s=>s.items.forEach(i=>{
        const p = products.find(x=>x.name===i.name);
        revenue += i.subtotal;
        if(p) profit += (i.price - p.cost) * i.qty;
      }));
      document.getElementById('profitReport').innerHTML = `
        <div class="ticket-row" style="font-size:14px;"><span>Revenue</span><span>${naira(revenue)}</span></div>
        <div class="ticket-row" style="font-size:14px;font-weight:700;color:var(--green);"><span>Profit</span><span>${naira(profit)}</span></div>`;
    }

    const low = DB.get(DB_KEYS.products, []).filter(p=>p.stock<=p.lowStock);
    document.getElementById('reportLowStock').innerHTML = low.length ? low.map(p=>
      `<div class="list-row"><div class="prod-name">${escapeHtml(p.name)}</div><div class="prod-stock low">${p.stock} ${p.unit}</div></div>`
    ).join('') : '<div class="empty">All stock levels healthy</div>';
  }
};

/* ---------------- Sales Log Database ---------------- */
const SalesLog = {
  init() {
    const staffSelect = document.getElementById('saleslog-filter-staff');
    if (!staffSelect) return;
    
    const users = DB.get(DB_KEYS.users, []);
    staffSelect.innerHTML = '<option value="all" selected>All Users</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = `${u.name} (${u.role})`;
      staffSelect.appendChild(opt);
    });
  },

  render() {
    const staffSelect = document.getElementById('saleslog-filter-staff');
    if (staffSelect && staffSelect.options.length <= 1) {
      this.init();
    }

    const q = (document.getElementById('saleslog-search').value || '').toLowerCase();
    const period = document.getElementById('saleslog-filter-date').value;
    const type = document.getElementById('saleslog-filter-type').value;
    const staff = document.getElementById('saleslog-filter-staff').value;

    const sales = DB.get(DB_KEYS.sales, []);
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

    document.getElementById('saleslog-stat-count').textContent = count;
    document.getElementById('saleslog-stat-total').textContent = naira(totalSalesVal);
    document.getElementById('saleslog-stat-cash').textContent = naira(cashVal);
    document.getElementById('saleslog-stat-credit').textContent = naira(creditVal);

    const listContainer = document.getElementById('saleslog-list');
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="empty">No matching transactions found in the database.</div>';
      return;
    }

    const listHtml = filtered.slice().reverse().map(s => {
      const itemsPreview = s.items.map(i => `<span class="saleslog-item-tag">${escapeHtml(i.name)} x${i.qty}</span>`).join(' ');
      const badgeClass = s.paymentType === 'credit' ? 'badge-credit' : 'badge-ok';
      const badgeText = s.paymentType === 'credit' ? 'Credit' : 'Cash';
      const dateFormatted = new Date(s.date).toLocaleString('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="saleslog-row">
          <div class="saleslog-col-main">
            <div style="font-family:var(--font-mono); font-weight:700; font-size:14px; color:var(--steel);">
              ${escapeHtml(s.invoiceNo || s.id.slice(-8).toUpperCase())}
            </div>
            <div style="font-weight:600; font-size:13.5px; margin-top:2px;">
              ${escapeHtml(s.customerName)}
            </div>
            <div class="prod-meta" style="font-size:11.5px; margin-top:2px;">
              ${dateFormatted}
            </div>
          </div>
          
          <div class="saleslog-col-items">
            ${itemsPreview}
          </div>
          
          <div class="saleslog-col-meta">
            <div class="prod-stock" style="font-size:16px; color:var(--ink);">
              ${naira(s.total)}
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="badge ${badgeClass}">${badgeText}</span>
              ${s.paymentType === 'credit' && s.balance > 0 ? `<span style="font-size:10px; color:var(--rust); font-weight:700;">Bal: ${naira(s.balance)}</span>` : ''}
            </div>
            <div class="prod-meta" style="font-size:11px; margin-top:1px;">
              By: ${escapeHtml(s.staffName)}
            </div>
            <button class="btn btn-sm btn-ghost" style="margin-top:6px; padding:4px 8px; font-size:11.5px; width:auto; height:auto; min-height:auto;" onclick="Receipt.showById('${s.id}')">View Receipt</button>
          </div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = listHtml;
  }
};

/* ---------------- Users / staff ---------------- */
const Users = {
  renderPicker(){
    const users = DB.get(DB_KEYS.users, []);
    const activeId = DB.get(DB_KEYS.activeUser);
    document.getElementById('userPicker').innerHTML = users.map(u=>`
      <div class="list-row" style="cursor: default; flex-wrap: wrap; gap: 8px;">
        <div>
          <div class="prod-name">${escapeHtml(u.name)} ${u.id === activeId ? '<span style="color:var(--steel); font-size:12px;">(Active)</span>' : ''}</div>
          <div class="prod-meta">${escapeHtml(u.role)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
          ${u.role !== 'owner' ? `
            <input type="password" value="${escapeHtml(u.pin || '0000')}" 
                   placeholder="PIN" 
                   pattern="[0-9]*" inputmode="numeric" maxlength="4" 
                   style="width: 70px; padding: 4px 6px; font-size: 13px; text-align: center; font-family: var(--font-mono); height: auto; border: 1.5px solid var(--line-strong); border-radius: 6px;" 
                   onchange="Users.updatePin('${u.id}', this.value)">
            <button class="btn btn-danger btn-sm" onclick="Users.remove('${u.id}')" style="padding: 4px 8px; font-size: 11px; width: auto; background: var(--rust);">Remove</button>
          ` : '<span style="font-size: 12px; color: var(--ink-soft); font-family: var(--font-mono);">PIN in Settings</span>'}
        </div>
      </div>`).join('');
  },
  updatePin(id, pin){
    if(pin.length !== 4 || !/^\d+$/.test(pin)){
      showToast('PIN must be exactly 4 digits');
      Users.renderPicker();
      return;
    }
    const users = DB.get(DB_KEYS.users, []);
    const u = users.find(x => x.id === id);
    if(u){
      u.pin = pin;
      DB.set(DB_KEYS.users, users);
      showToast(`PIN updated for ${u.name}`);
    }
    Users.renderPicker();
  },
  add(){
    const name = document.getElementById('newStaffName').value.trim();
    const pin = document.getElementById('newStaffPin').value.trim();
    if(!name){ showToast('Enter staff name'); return; }
    if(pin.length !== 4 || !/^\d+$/.test(pin)){ showToast('PIN must be exactly 4 digits'); return; }

    const users = DB.get(DB_KEYS.users, []);
    if(users.some(u => u.name.toLowerCase() === name.toLowerCase())){
      showToast('User name already exists');
      return;
    }
    users.push({ id: uid(), name, role:'staff', pin });
    DB.set(DB_KEYS.users, users);

    document.getElementById('newStaffName').value='';
    document.getElementById('newStaffPin').value='';
    Users.renderPicker();
    Auth.populateUserDropdown();
    showToast('Staff added');
  },
  remove(id){
    const activeId = DB.get(DB_KEYS.activeUser);
    if(id === activeId){
      showToast('Cannot remove currently active user');
      return;
    }
    if(!confirm('Are you sure you want to remove this staff member?')) return;
    let users = DB.get(DB_KEYS.users, []);
    users = users.filter(u=>u.id!==id);
    DB.set(DB_KEYS.users, users);
    Users.renderPicker();
    Auth.populateUserDropdown();
    showToast('Staff member removed');
  }
};

/* ---------------- Settings / Backup ---------------- */
const Settings = {
  open(){
    if(!isOwner()){ showToast('Only the Owner can access settings'); return; }
    const s = DB.get(DB_KEYS.settings, {});
    document.getElementById('s_shopName').value = s.shopName || '';
    document.getElementById('s_address').value = s.address || '';
    document.getElementById('s_phone').value = s.phone || '';

    // Load owner pin
    const users = DB.get(DB_KEYS.users, []);
    const owner = users.find(u => u.role === 'owner');
    document.getElementById('s_ownerPin').value = owner ? (owner.pin || '0000') : '0000';

    Modal.open('modal-settings');
  },
  save(){
    const settings = {
      shopName: document.getElementById('s_shopName').value.trim() || 'My Shop',
      address: document.getElementById('s_address').value.trim(),
      phone: document.getElementById('s_phone').value.trim(),
    };

    // Save owner pin
    const pin = document.getElementById('s_ownerPin').value.trim();
    if(pin.length === 4 && /^\d+$/.test(pin)){
      const users = DB.get(DB_KEYS.users, []);
      const ownerIdx = users.findIndex(u => u.role === 'owner');
      if(ownerIdx !== -1){
        users[ownerIdx].pin = pin;
        DB.set(DB_KEYS.users, users);
      }
    } else {
      showToast('Owner PIN must be exactly 4 digits');
      return;
    }

    DB.set(DB_KEYS.settings, settings);
    renderShopHeader();
    Modal.close('modal-settings');
    showToast('Settings saved');
  },
  exportData(){
    const backup = {};
    Object.values(DB_KEYS).forEach(k => backup[k] = DB.get(k));
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockpoint-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importData(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const backup = JSON.parse(reader.result);
        Object.entries(backup).forEach(([k,v]) => localStorage.setItem(k, JSON.stringify(v)));
        showToast('Backup restored — reloading…');
        setTimeout(()=>location.reload(), 1000);
      }catch(e){ showToast('Invalid backup file'); }
    };
    reader.readAsText(file);
  }
};

/* ---------------- Auth / Security ---------------- */
const Auth = {
  checkSession(){
    const active = DB.get(DB_KEYS.sessionActive, false);
    const screen = document.getElementById('login-screen');
    if(!active){
      screen.style.display = 'flex';
      Auth.populateUserDropdown();
    } else {
      screen.style.display = 'none';
    }
  },
  populateUserDropdown(){
    const users = DB.get(DB_KEYS.users, []);
    const select = document.getElementById('login-user-select');
    if(select){
      select.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`).join('');
    }
  },
  login(){
    const userId = document.getElementById('login-user-select').value;
    const pin = document.getElementById('login-pin').value;
    if(!userId){ showToast('Select a user'); return; }
    
    const users = DB.get(DB_KEYS.users, []);
    const user = users.find(u => u.id === userId);
    if(!user){ showToast('User not found'); return; }
    
    const correctPin = user.pin || '0000';
    if(pin === correctPin){
      DB.set(DB_KEYS.activeUser, userId);
      DB.set(DB_KEYS.sessionActive, true);
      document.getElementById('login-pin').value = ''; // clear input
      Auth.checkSession();
      applyRoleVisibility();
      Views.go('dashboard');
      showToast(`Welcome, ${user.name}`);
    } else {
      showToast('Incorrect PIN');
      document.getElementById('login-pin').value = '';
    }
  },
  logout(){
    DB.set(DB_KEYS.sessionActive, false);
    Auth.checkSession();
    showToast('App Locked');
  }
};

function renderShopHeader() {
  const settings = DB.get(DB_KEYS.settings, {});
  const shopName = settings.shopName || 'Prince Iyke Building & Technical Tools Merchants';
  const subtitleEl = document.querySelector('.brand-subtitle');
  const shopLineEl = document.getElementById('shopLine');
  
  if (shopName === 'Prince Iyke Building & Technical Tools Merchants') {
    document.getElementById('shopNameDisplay').textContent = 'PRINCE IYKE';
    if (subtitleEl) subtitleEl.style.display = 'block';
  } else {
    document.getElementById('shopNameDisplay').textContent = shopName;
    if (subtitleEl) subtitleEl.style.display = 'none';
  }
  
  const lineParts = [settings.address, settings.phone].filter(Boolean);
  if (settings.address === 'A Division of Obiezu Holding') {
    if (shopLineEl) {
      shopLineEl.textContent = '(A Division of Obiezu Holding)' + (settings.phone ? ' · ' + settings.phone : '');
    }
  } else {
    if (shopLineEl) {
      shopLineEl.textContent = lineParts.join(' · ');
    }
  }
}

/* ---------------- Init ---------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  seedIfEmpty();
  renderShopHeader();
  applyRoleVisibility();
  Views.go('dashboard');
  Auth.checkSession();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
