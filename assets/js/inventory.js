// assets/js/inventory.js
import {
  formatRM,
  getSupabaseClient,
  openModal,
  closeModal,
  initThemeFromStorage
} from './common.js';

const supabase = getSupabaseClient();

let inventoryProductsCache = [];
let selectedProductId = null;
let currentUserId = null;
let inventoryFilteredCache = [];

function getUserDateFormat() {
    const settings = JSON.parse(localStorage.getItem('inventorypro.settings'));
    return settings?.preferences?.dateFormat || 'DD/MM/YYYY';
}

function formatDateByPreference(dateInput) {
    if (!dateInput) return 'N/A';

    const date = new Date(dateInput);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    switch (getUserDateFormat()) {
        case 'MM/DD/YYYY':
            return `${month}/${day}/${year}`;
        case 'YYYY/MM/DD':
            return `${year}/${month}/${day}`;
        case 'DD/MM/YYYY':
        default:
            return `${day}/${month}/${year}`;
    }
}

/* =========================
   Page Init (same pattern as dashboard)
========================= */
window.addEventListener('DOMContentLoaded', async () => {
  initThemeFromStorage();

  wirePageButtons();     // ✅ logout modal + modal close
  wireInventoryUI();     // ✅ inventory clicks + form submit + sku check
  wireInventorySearch();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user?.id) {
    window.location.href = './index.html';
    return;
  }

  currentUserId = user.id;

  await fillSidebar(user);
  await loadInventory(currentUserId);
});

/* =========================
   Logout + Modals (same as dashboard)
========================= */
function wirePageButtons() {
  // Logout modal
  document.getElementById('logoutBtn')?.addEventListener('click', () => openModal('logoutModal'));
  document.getElementById('cancelLogout')?.addEventListener('click', () => closeModal('logoutModal'));

  document.getElementById('confirmLogout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './index.html';
  });

  // click outside modal close
  document.querySelectorAll('.modal')?.forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
  });

  // Add modal open/close (inventory page)
  document.getElementById('openAddProductBtn')?.addEventListener('click', () => openModal('addProductModal'));
  document.getElementById('closeAddModal')?.addEventListener('click', () => closeModal('addProductModal'));
  document.getElementById('cancelAddProduct')?.addEventListener('click', () => closeModal('addProductModal'));
}

/* =========================
   Utils
========================= */
function formatDateMaybe(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return formatDateByPreference(d);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? '';
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

/* =========================
   Load Inventory
========================= */
async function loadInventory(userId) {
  if (!userId) return;

  const { data, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (prodErr) {
    console.error('[Inventory] loadInventory error:', prodErr);
    return;
  }

  inventoryProductsCache = data || [];
  const q = document.getElementById('inventorySearch')?.value?.trim();
  if (q) {
    // trigger filtering again using the current query
    const input = document.getElementById('inventorySearch');
    input.dispatchEvent(new Event('input'));
  } else {
    renderInventoryGrid(inventoryProductsCache);
  }
}

/* =========================
   SKU validation helpers
========================= */
function setSkuHint(type, msg) {
  const skuHint = document.getElementById('skuHint');
  if (!skuHint) return;
  skuHint.classList.remove('ok', 'bad');
  if (type) skuHint.classList.add(type);
  skuHint.textContent = msg || '';
}

function findSkuInCache(sku, editId) {
  const needle = String(sku || '').trim().toLowerCase();
  if (!needle) return null;

  return inventoryProductsCache.find(p =>
    String(p.sku || '').trim().toLowerCase() === needle &&
    String(p.id) !== String(editId || '')
  ) || null;
}

async function skuExistsInDb(userId, sku, editId) {
  const needle = String(sku || '').trim();
  if (!needle) return { exists: false };

  const { data, error } = await supabase
    .from('products')
    .select('id,name,sku')
    .eq('user_id', userId)
    .ilike('sku', needle) // ignore case
    .limit(1);

  if (error) {
    console.warn('[SKU] DB check error:', error);
    return { exists: false };
  }

  const hit = data?.[0] || null;
  if (!hit) return { exists: false };
  if (String(hit.id) === String(editId || '')) return { exists: false };

  return { exists: true, product: hit };
}

/* =========================
   UI Wiring
========================= */
export function wireInventoryUI() {
  // ✅ prevent double-binding
  if (window.__inventoryUIWired) return;
  window.__inventoryUIWired = true;

  let skuCheckTimer = null;

  // ===== SKU live validation (bind AFTER DOM loaded) =====
  const skuInput = document.getElementById('newProdSku');
  skuInput?.addEventListener('input', async () => {
    const editId = document.getElementById('editProdId')?.value?.trim() || '';
    const sku = skuInput.value;

    setSkuHint('', '');

    // quick cache check
    const cacheHit = findSkuInCache(sku, editId);
    if (cacheHit) {
      setSkuHint('bad', `✖ SKU already exists!：${cacheHit.sku}（Product: ${cacheHit.name || '-'}）`);
      return;
    }

    if (!sku.trim()) return;

    if (skuCheckTimer) clearTimeout(skuCheckTimer);
    skuCheckTimer = setTimeout(async () => {
      if (!currentUserId) return;
      const res = await skuExistsInDb(currentUserId, sku, editId);
      if (res.exists) {
        setSkuHint('bad', `✖ SKU already exists!：${res.product.sku}（Product: ${res.product.name || '-'}）`);
      } else {
        setSkuHint('ok', '✔ SKU available!');
      }
    }, 250);
  });

  // ===== Add Product Modal wiring =====
  const addModal = document.getElementById('addProductModal');

  function openAddModal() {
    if (!addModal) return;
    addModal.classList.add('show');
  }

  function closeAddModal() {
    if (!addModal) return;
    addModal.classList.remove('show');
  }

  // Click outside to close
  addModal?.addEventListener('click', (e) => {
    if (e.target === addModal) closeAddModal();
  });

  // If URL is inventory.html#add then auto-open modal
  if (location.hash === '#add') {
    openAddModal();
    history.replaceState(null, '', location.pathname);
  }

  // ===== Save (Insert/Update) Product =====
  document.getElementById('addProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (userErr || !user?.id) {
      alert('Not logged in. Please login again.');
      window.location.href = './index.html';
      return;
    }

    currentUserId = user.id;

    const editId = document.getElementById('editProdId')?.value?.trim() || '';

    const name = document.getElementById('newProdName')?.value?.trim() || '';
    const sku = document.getElementById('newProdSku')?.value?.trim() || '';
    const category = document.getElementById('newProdCategory')?.value || 'Other';
    const quantity = Number(document.getElementById('newProdQty')?.value ?? 0);
    const low_stock_threshold = Number(document.getElementById('newProdLowStock')?.value ?? 10);
    const price = Number(document.getElementById('newProdPrice')?.value ?? 0);

    if (!name || !sku) {
      alert('Please fill in Product Name and SKU.');
      return;
    }

    // ✅ final SKU check before save
    const cacheHit2 = findSkuInCache(sku, editId);
    if (cacheHit2) {
      setSkuHint('bad', `✖ SKU already exists!：${cacheHit2.sku}（Product: ${cacheHit2.name || '-'}）`);
      alert('SKU already exists. Please use a unique SKU.');
      return;
    }

    const dbCheck = await skuExistsInDb(user.id, sku, editId);
    if (dbCheck.exists) {
      setSkuHint('bad', `✖ SKU already exists!：${dbCheck.product.sku}（Product: ${dbCheck.product.name || '-'}）`);
      alert('SKU already exists. Please use a unique SKU.');
      return;
    }

    const status =
      quantity === 0 ? 'OUT_OF_STOCK'
      : quantity <= low_stock_threshold ? 'LOW_STOCK'
      : 'IN_STOCK';

    const payload = { name, sku, category, quantity, low_stock_threshold, price, status };

    let err = null;
    let insertedRow = null;

    if (editId) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editId)
        .eq('user_id', user.id);
      err = error;

      if (!err) {
        // ✅ update local cache immediately
        inventoryProductsCache = inventoryProductsCache.map(p =>
          String(p.id) === String(editId) ? { ...p, ...payload } : p
        );
        renderInventoryGrid(inventoryProductsCache);
      }
    } else {
      // ✅ insert and return row so we can refresh UI without reload
      const { data, error } = await supabase
        .from('products')
        .insert([{ user_id: user.id, ...payload }])
        .select('*')
        .single();

      err = error;
      insertedRow = data || null;

      if (!err && insertedRow) {
        inventoryProductsCache = [insertedRow, ...inventoryProductsCache];
        renderInventoryGrid(inventoryProductsCache);
      }
    }

    if (err) {
      console.error(err);
      alert(`Save failed: ${err.message}`);
      return;
    }

    // reset + close
    document.getElementById('addProductForm')?.reset();
    setSkuHint('', '');
    const idEl = document.getElementById('editProdId');
    if (idEl) idEl.value = '';

    // reset modal texts back to Add
    const title = document.querySelector('#addProductModal .modal-header h3');
    if (title) title.textContent = 'Add New Product';
    const submitBtn = document.querySelector('#addProductForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add Product';

    closeAddModal();

    console.log('SUBMIT ONCE');
  });

  // close product details
  document.getElementById('pdCloseBtn')?.addEventListener('click', closeProductDetailsModal);
  document.getElementById('productDetailsModal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'productDetailsModal') closeProductDetailsModal();
  });

  // click card open details (event delegation)
  document.getElementById('inventoryGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;

    const id = card.dataset.id;
    const p = inventoryProductsCache.find(x => String(x.id) === String(id));
    if (p) openProductDetailsModal(p);
  });

  // edit
  document.getElementById('pdEditBtn')?.addEventListener('click', () => {
    const p = inventoryProductsCache.find(x => String(x.id) === String(selectedProductId));
    if (!p) return;

    setVal('editProdId', p.id);
    setVal('newProdName', p.name || '');
    setVal('newProdSku', p.sku || '');
    setVal('newProdCategory', p.category || 'Other');
    setVal('newProdQty', String(Number(p.quantity ?? 0)));
    setVal('newProdLowStock', String(Number(p.low_stock_threshold ?? 10)));
    setVal('newProdPrice', String(Number(p.price ?? 0)));

    setSkuHint('', '');

    const title = document.querySelector('#addProductModal .modal-header h3');
    if (title) title.textContent = 'Edit Product';

    const submitBtn = document.querySelector('#addProductForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    closeProductDetailsModal();
    openAddModal();
  });

  // delete
  document.getElementById('pdDeleteBtn')?.addEventListener('click', async () => {
    if (!selectedProductId) return;
    if (!confirm('Delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .update({ is_active: false ,quantity: 0})
      .eq('id', selectedProductId)
      .eq('user_id', currentUserId);

    if (error) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
      return;
    }

    // ✅ update cache immediately
    inventoryProductsCache = inventoryProductsCache.filter(p => String(p.id) !== String(selectedProductId));
    renderInventoryGrid(inventoryProductsCache);

    closeProductDetailsModal();
  });
      if (window.__exportUIWired) {
        return;
      }
      window.__exportUIWired = true;
    // ===== Export Modal wiring + logic =====
    const exportModal = document.getElementById('exportModal');
    const openExportBtn = document.getElementById('openExportBtn');
    const closeExportModalBtn = document.getElementById('closeExportModal');
    const cancelExportBtn = document.getElementById('cancelExportBtn');

    const exportForm = document.getElementById('exportForm');

    const expVendorName = document.getElementById('expVendorName');
    const expVendorPhone = document.getElementById('expVendorPhone');
    const expVendorEmail = document.getElementById('expVendorEmail');

    const expSku = document.getElementById('expSku');
    const expQty = document.getElementById('expQty');

    const expProductName = document.getElementById('expProductName');
    const expUnitPrice = document.getElementById('expUnitPrice');
    const expTotalPrice = document.getElementById('expTotalPrice');

    const expSkuHint = document.getElementById('expSkuHint');
    const expQtyHint = document.getElementById('expQtyHint');

    let expSelectedProduct = null;
    let skuLookupTimer = null;

    function openExportModal() {
      if (!exportModal) return;
      exportModal.classList.add('show');

      // reset fields
      exportForm?.reset();
      expProductName.value = '';
      expUnitPrice.value = '';
      expTotalPrice.value = '';
      expSkuHint.textContent = '';
      expQtyHint.textContent = '';
      expSelectedProduct = null;
    }

    function closeExportModal() {
      if (!exportModal) return;
      exportModal.classList.remove('show');
    }

    openExportBtn?.addEventListener('click', openExportModal);
    closeExportModalBtn?.addEventListener('click', closeExportModal);
    cancelExportBtn?.addEventListener('click', closeExportModal);

    // click outside to close
    exportModal?.addEventListener('click', (e) => {
      if (e.target === exportModal) closeExportModal();
    });

    function setSkuStatus(type, msg) {
      if (!expSkuHint) return;
      expSkuHint.textContent = msg || '';
      expSkuHint.style.color = (type === 'bad') ? '#c0392b' : (type === 'ok' ? '#2e7d32' : '');
    }

    function setQtyStatus(type, msg) {
      if (!expQtyHint) return;
      expQtyHint.textContent = msg || '';
      expQtyHint.style.color = (type === 'bad') ? '#c0392b' : (type === 'ok' ? '#2e7d32' : '');
    }

    function toNumber(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    function recalcExportTotal() {
      const qty = toNumber(expQty.value);
      const unit = expSelectedProduct ? toNumber(expSelectedProduct.price) : 0;
      const total = qty * unit;

      expTotalPrice.value = formatRM(total);

      // validate qty vs stock
      if (!expSelectedProduct) {
        setQtyStatus('', '');
        return;
      }

      if (qty <= 0) {
        setQtyStatus('bad', 'Quantity must be at least 1.');
        return;
      }

      if (qty > toNumber(expSelectedProduct.quantity)) {
        setQtyStatus('bad', `Insufficient stock. Available: ${expSelectedProduct.quantity}`);
      } else {
        setQtyStatus('ok', `Available stock: ${expSelectedProduct.quantity}`);
      }
    }

  // SKU lookup (auto fill) - FINAL: never show "not found" while typing
  let skuReqSeq = 0;
  const MIN_SKU_LEN = 3;
  function clearSkuAutofill() {
    expSelectedProduct = null;
    expProductName.value = '';
    expUnitPrice.value = '';
    expTotalPrice.value = '';
    setQtyStatus('', '');
  }

  function normalizeSku(s) {
    return String(s || '').trim();
  }

  async function lookupSkuExact(userId, skuRaw) {
    const sku = normalizeSku(skuRaw);

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, quantity, price, user_id')
      .eq('user_id', userId)
      .ilike('sku', sku)
      .limit(1);

    return { data, error };
  }

  expSku?.addEventListener('input', () => {
    const sku = normalizeSku(expSku.value);

    skuReqSeq += 1;
    const mySeq = skuReqSeq;

    clearSkuAutofill();

    if (!sku) {
      setSkuStatus('', '');
      if (skuLookupTimer) clearTimeout(skuLookupTimer);
      return;
    }

    if (sku.length < MIN_SKU_LEN) {
      setSkuStatus('', '');
      if (skuLookupTimer) clearTimeout(skuLookupTimer);
      return;
    }

    const cacheHit = inventoryProductsCache.find(
      p => normalizeSku(p.sku).toLowerCase() === sku.toLowerCase()
    );

    if (cacheHit) {
      expSelectedProduct = cacheHit;
      expProductName.value = cacheHit.name || '';
      expUnitPrice.value = formatRM(toNumber(cacheHit.price));
      setSkuStatus('ok', '✔ Product found');
      recalcExportTotal();
      return;
    }

    // debounce DB lookup
    if (skuLookupTimer) clearTimeout(skuLookupTimer);
    setSkuStatus('', 'Searching...');

    skuLookupTimer = setTimeout(async () => {
      if (mySeq !== skuReqSeq) return;
      if (!currentUserId) return;

      const { data, error } = await lookupSkuExact(currentUserId, sku);

      if (mySeq !== skuReqSeq) return;

      if (error) {
        console.error(error);
        setSkuStatus('bad', 'Lookup error. Please try again.');
        return;
      }

      const product = data?.[0];
      if (!product) {
        setSkuStatus('', '');
        return;
      }

      expSelectedProduct = product;
      expProductName.value = product.name || '';
      expUnitPrice.value = formatRM(toNumber(product.price));
      setSkuStatus('ok', '✔ Product found');
      recalcExportTotal();
    }, 450);
  });

  expSku?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const sku = normalizeSku(expSku.value);
    if (!sku || sku.length < MIN_SKU_LEN) return;

    if (expSelectedProduct) return;

    if (!currentUserId) return;

    setSkuStatus('', 'Searching...');
    const { data, error } = await lookupSkuExact(currentUserId, sku);

    if (error) {
      console.error(error);
      setSkuStatus('bad', 'Lookup error. Please try again.');
      return;
    }

    const product = data?.[0];
    if (!product) {
      setSkuStatus('bad', '✖ No product found for this SKU.');
      return;
    }

    expSelectedProduct = product;
    expProductName.value = product.name || '';
    expUnitPrice.value = formatRM(toNumber(product.price));
    setSkuStatus('ok', '✔ Product found');
    recalcExportTotal();
  });

  expSku?.addEventListener('blur', async () => {
    const sku = normalizeSku(expSku.value);
    if (!sku || sku.length < MIN_SKU_LEN) return;

    if (expSelectedProduct) return;
    if (!currentUserId) return;

    const { data } = await lookupSkuExact(currentUserId, sku);
    const product = data?.[0];
    if (!product) {
      setSkuStatus('bad', '✖ No product found for this SKU.');
    }
  });

// qty change recalculation
expQty?.addEventListener('input', recalcExportTotal);

    // qty change recalculation
    expQty?.addEventListener('input', recalcExportTotal);

  if (exportForm && exportForm.dataset.bound !== '1') {
    exportForm.dataset.bound = '1';

    let exporting = false;

    exportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (exporting) return;
      exporting = true;

      try {
        if (!currentUserId) {
          alert('Not signed in.');
          return;
        }

        const vendor_name = expVendorName.value.trim();
        const vendor_phone = expVendorPhone.value.trim();
        const vendor_email = expVendorEmail.value.trim();
        const sku = expSku.value.trim();
        const quantity = toNumber(expQty.value);

        if (!vendor_name) {
          alert('Please enter Vendor Name.');
          return;
        }
        if (!sku) {
          alert('Please enter SKU.');
          return;
        }
        if (!expSelectedProduct) {
          alert('No product found for this SKU.');
          return;
        }
        if (quantity <= 0) {
          alert('Quantity must be at least 1.');
          return;
        }
        if (quantity > toNumber(expSelectedProduct.quantity)) {
          alert(`Insufficient stock. Available: ${expSelectedProduct.quantity}`);
          return;
        }

        const unit_price = toNumber(expSelectedProduct.price);
        const total_amount = unit_price * quantity;

        const { error: insErr } = await supabase
          .from('export_records')
          .insert([{
            user_id: currentUserId,
            product_id: expSelectedProduct.id,
            product_name: expSelectedProduct.name || '',
            quantity,
            vendor_name,
            vendor_email: vendor_email || null,
            vendor_phone: vendor_phone || null,
            unit_price,
            total_amount,
            exported_at: new Date().toISOString()
          }]);

        if (insErr) {
          console.error(insErr);
          alert('Failed to save export record.');
          return;
        }

        const newQty = toNumber(expSelectedProduct.quantity) - quantity;

        const { error: updErr } = await supabase
          .from('products')
          .update({ quantity: newQty })
          .eq('id', expSelectedProduct.id)
          .eq('user_id', currentUserId);

        if (updErr) {
          console.error(updErr);
          alert('Export record saved, but failed to deduct stock. Please refresh and check.');
          return;
        }

        alert('Export successful!');
        closeExportModal();

        // refresh inventory list
        await loadInventory(currentUserId);

      } finally {
        exporting = false;
      }
    });
  }

  // ===============================
  // Import Modal wiring + logic
  // ===============================
  const importModal = document.getElementById('importModal');
  const openImportBtn = document.getElementById('openImportBtn');
  const closeImportModalBtn = document.getElementById('closeImportModal');
  const cancelImportBtn = document.getElementById('cancelImportBtn');

  const importForm = document.getElementById('importForm');

  const impSku = document.getElementById('impSku');
  const impQty = document.getElementById('impQty');

  const impProductName = document.getElementById('impProductName');
  const impUnitPrice = document.getElementById('impUnitPrice');
  const impCurrentStock = document.getElementById('impCurrentStock');
  const impTotalAmount = document.getElementById('impTotalAmount');

  const impSkuHint = document.getElementById('impSkuHint');
  const impQtyHint = document.getElementById('impQtyHint');

  let impSelectedProduct = null;

  // UI helpers
  function setImpSkuStatus(type, msg) {
    if (!impSkuHint) return;
    impSkuHint.textContent = msg || '';
    impSkuHint.style.color = (type === 'bad') ? '#c0392b' : (type === 'ok' ? '#2e7d32' : '');
  }
  function setImpQtyStatus(type, msg) {
    if (!impQtyHint) return;
    impQtyHint.textContent = msg || '';
    impQtyHint.style.color = (type === 'bad') ? '#c0392b' : (type === 'ok' ? '#2e7d32' : '');
  }
  function clearImpAutofill() {
    impSelectedProduct = null;
    if (impProductName) impProductName.value = '';
    if (impUnitPrice) impUnitPrice.value = '';
    if (impCurrentStock) impCurrentStock.value = '';
    if (impTotalAmount) impTotalAmount.value = '';
    setImpQtyStatus('', '');
  }
  function recalcImportTotal() {
    const qty = Number(impQty?.value || 0);
    const unit = impSelectedProduct ? Number(impSelectedProduct.price || 0) : 0;
    const total = qty * unit;
    if (impTotalAmount) impTotalAmount.value = formatRM(total);

    if (!impSelectedProduct) return;
    if (qty <= 0) {
      setImpQtyStatus('bad', 'Quantity must be at least 1.');
    } else {
      setImpQtyStatus('ok', 'Ready to import.');
    }
  }

  // open/close
  function openImportModal() {
    if (!importModal) return;
    importModal.classList.add('show');
    importForm?.reset();
    clearImpAutofill();
    setImpSkuStatus('', '');
  }
  function closeImportModal() {
    if (!importModal) return;
    importModal.classList.remove('show');
  }

  openImportBtn?.addEventListener('click', openImportModal);
  closeImportModalBtn?.addEventListener('click', closeImportModal);
  cancelImportBtn?.addEventListener('click', closeImportModal);
  importModal?.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });

  // SKU lookup (same UX rule as export: don't show not found while typing)
  let impSkuLookupTimer = null;
  let impSkuReqSeq = 0;
  const IMP_MIN_SKU_LEN = 3;

  function normalizeSku(s) { return String(s || '').trim(); }

  async function lookupProductBySku(userId, skuRaw) {
    const sku = normalizeSku(skuRaw);
    return await supabase
      .from('products')
      .select('id, name, sku, quantity, price, user_id')
      .eq('user_id', userId)
      .ilike('sku', sku)
      .limit(1);
  }

  impSku?.addEventListener('input', () => {
    const sku = normalizeSku(impSku.value);

    impSkuReqSeq += 1;
    const mySeq = impSkuReqSeq;

    clearImpAutofill();

    if (!sku) {
      setImpSkuStatus('', '');
      if (impSkuLookupTimer) clearTimeout(impSkuLookupTimer);
      return;
    }

    if (sku.length < IMP_MIN_SKU_LEN) {
      setImpSkuStatus('', '');
      if (impSkuLookupTimer) clearTimeout(impSkuLookupTimer);
      return;
    }

    // cache first
    const cacheHit = inventoryProductsCache.find(
      p => normalizeSku(p.sku).toLowerCase() === sku.toLowerCase()
    );

    if (cacheHit) {
      impSelectedProduct = cacheHit;
      if (impProductName) impProductName.value = cacheHit.name || '';
      if (impUnitPrice) impUnitPrice.value = formatRM(Number(cacheHit.price || 0));
      if (impCurrentStock) impCurrentStock.value = String(Number(cacheHit.quantity || 0));
      setImpSkuStatus('ok', '✔ Product found');
      recalcImportTotal();
      return;
    }

    if (impSkuLookupTimer) clearTimeout(impSkuLookupTimer);
    setImpSkuStatus('', 'Searching...');

    impSkuLookupTimer = setTimeout(async () => {
      if (mySeq !== impSkuReqSeq) return;
      if (!currentUserId) return;

      const { data, error } = await lookupProductBySku(currentUserId, sku);

      if (mySeq !== impSkuReqSeq) return;

      if (error) {
        console.error(error);
        setImpSkuStatus('bad', 'Lookup error. Please try again.');
        return;
      }

      const product = data?.[0];
      if (!product) {
        setImpSkuStatus('', '');
        return;
      }

      impSelectedProduct = product;
      if (impProductName) impProductName.value = product.name || '';
      if (impUnitPrice) impUnitPrice.value = formatRM(Number(product.price || 0));
      if (impCurrentStock) impCurrentStock.value = String(Number(product.quantity || 0));
      setImpSkuStatus('ok', '✔ Product found');
      recalcImportTotal();
    }, 450);
  });

  // Enter / Blur show final not found
  impSku?.addEventListener('blur', async () => {
    const sku = normalizeSku(impSku.value);
    if (!sku || sku.length < IMP_MIN_SKU_LEN) return;
    if (impSelectedProduct) return;
    if (!currentUserId) return;

    const { data } = await lookupProductBySku(currentUserId, sku);
    if (!data?.[0]) setImpSkuStatus('bad', '✖ No product found for this SKU.');
  });

  impQty?.addEventListener('input', recalcImportTotal);

  // submit import
  if (importForm && importForm.dataset.bound !== '1') {
    importForm.dataset.bound = '1';

    let importing = false;

    importForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (importing) return;
      importing = true;

      try {
        if (!currentUserId) return alert('Not signed in.');

        const sku = normalizeSku(impSku?.value);
        const qty = Number(impQty?.value || 0);

        if (!sku) return alert('Please enter SKU.');
        if (!impSelectedProduct) return alert('No product found for this SKU.');
        if (!Number.isFinite(qty) || qty <= 0) return alert('Quantity must be at least 1.');

        const unit_price = Number(impSelectedProduct.price || 0);
        const total_amount = unit_price * qty;

        // 1) log import
        const { error: insErr } = await supabase
          .from('import_records')
          .insert([{
            user_id: currentUserId,
            product_id: impSelectedProduct.id,
            product_name: impSelectedProduct.name || '',
            quantity: qty,
            unit_price,
            total_amount,
            imported_at: new Date().toISOString()
          }]);

        if (insErr) {
          console.error(insErr);
          alert('Failed to save import record.');
          return;
        }

        // 2) add stock
        const newQty = Number(impSelectedProduct.quantity || 0) + qty;

        const { error: updErr } = await supabase
          .from('products')
          .update({ quantity: newQty, is_active: true })
          .eq('id', impSelectedProduct.id)
          .eq('user_id', currentUserId);

        if (updErr) {
          console.error(updErr);
          alert('Import record saved, but failed to add stock. Please refresh and check.');
          return;
        }

        alert('Import successful!');
        closeImportModal();
        await loadInventory(currentUserId);

      } finally {
        importing = false;
      }
    });
  }
}

function wireInventorySearch() {
  const input = document.getElementById('inventorySearch');
  const sortSelect = document.getElementById('inventorySortCategory');
  if (!input) return;

  const debounce = (fn, delay = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const normalizeCat = (v) => String(v || '').trim().toLowerCase();

  const applyFilters = () => {
    const q = (input.value || '').trim().toLowerCase();
    const selected = sortSelect ? sortSelect.value : 'ALL'; // ALL / Electronics / Office / Furniture / Other

    const filtered = inventoryProductsCache.filter(p => {
      // Category filter
      if (selected !== 'ALL') {
        const pc = normalizeCat(p.category);
        const want = normalizeCat(selected);

        // match exact category values (Office is stored as "Office" in your options)
        if (pc !== want) return false;
      }

      // Search filter
      if (!q) return true;

      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      const category = String(p.category || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || category.includes(q);
    });

    inventoryFilteredCache = filtered;
    renderInventoryGrid(filtered);
  };

  // Search typing
  input.addEventListener('input', debounce(applyFilters, 120));

  // Category dropdown change
  sortSelect?.addEventListener('change', applyFilters);

  // Escape clears only the search text (keeps selected category)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      applyFilters();
    }
  });

  // Run once on page load so dropdown default applies immediately
  applyFilters();
}

/* =========================
   Render Inventory
========================= */
function renderInventoryGrid(list) {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;

  const countEl = document.getElementById('productCount');
  if (countEl) countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty">No products yet</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const statusClass = getStockClass(p);
    const statusLabel = getStockLabel(p);

    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-title">
          <span>${escapeHtml(p.name || '')}</span>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>

        <div class="product-row">
          SKU: ${escapeHtml(p.sku || '-')}
          ${p.category ? ` • ${escapeHtml(p.category)}` : ''}
        </div>

        <div class="product-info">
          <div>Qty: <b>${Number(p.quantity ?? 0)}</b></div>
          <div><b>${formatRM(Number(p.price ?? 0))}</b></div>
        </div>
      </div>
    `;
  }).join('');
}

function getStockClass(p) {
  const qty = Number(p.quantity ?? 0);
  const low = Number(p.low_stock_threshold ?? 10);
  if (qty === 0) return 'out-stock';
  if (qty > 0 && qty <= low) return 'low-stock';
  return 'in-stock';
}

function getStockLabel(p) {
  const cls = getStockClass(p);
  if (cls === 'out-stock') return 'Out of Stock';
  if (cls === 'low-stock') return 'Low Stock';
  return 'In Stock';
}

/* =========================
   Product Details
========================= */
function openProductDetailsModal(product) {
  selectedProductId = product.id;

  setText('pdName', product.name || '-');
  setText('pdSku', `SKU : ${product.sku || '-'}`);
  setText('pdQty', String(Number(product.quantity ?? 0)));
  setText('pdPrice', formatRM(Number(product.price ?? 0)));
  setText('pdCategory', product.category || '-');
  setText('pdLowStock', String(Number(product.low_stock_threshold ?? 10)));
  setText('pdUpdated', formatDateMaybe(product.updated_at || product.created_at));

  const qty = Number(product.quantity ?? 0);
  const low = Number(product.low_stock_threshold ?? 10);
  const totalValue = qty * Number(product.price ?? 0);
  setText('pdTotalValue', formatRM(totalValue));

  const statusEl = document.getElementById('pdStatus');
  if (statusEl) {
    const cls = qty === 0 ? 'out-stock' : (qty <= low ? 'low-stock' : 'in-stock');
    const label = qty === 0 ? 'Out of Stock' : (qty <= low ? 'Low Stock' : 'In Stock');

    statusEl.className = `pd-status badge ${cls}`;
    statusEl.textContent = label;
  }

  document.getElementById('productDetailsModal')?.classList.add('show');
}

function closeProductDetailsModal() {
  selectedProductId = null;
  document.getElementById('productDetailsModal')?.classList.remove('show');
}

/* =========================
   Sidebar
========================= */
async function fillSidebar(user) {
  let fullName = user.user_metadata?.full_name || 'User';
  let businessName = user.user_metadata?.business_name || 'My Business';

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name,business_name')
      .eq('user_id', user.id)
      .single();

    if (data) {
      fullName = data.full_name || fullName;
      businessName = data.business_name || businessName;
    }
  } catch {}

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  set('sidebarName', fullName);
  set('sidebarBusiness', businessName);
  set('sidebarAvatar', initials);
}
