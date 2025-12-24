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
  return d.toLocaleDateString('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
      .delete()
      .eq('id', selectedProductId);

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
}

function wireInventorySearch() {
const input = document.getElementById('inventorySearch');
if (!input) return;

  const debounce = (fn, delay = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const applySearch = () => {
    const q = (input.value || '').trim().toLowerCase();

    if (!q) {
      inventoryFilteredCache = [...inventoryProductsCache];
      renderInventoryGrid(inventoryProductsCache);
      return;
    }

    const filtered = inventoryProductsCache.filter(p => {
      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      const category = String(p.category || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || category.includes(q);
    });

    inventoryFilteredCache = filtered;
    renderInventoryGrid(filtered);
  };

  input.addEventListener('input', debounce(applySearch, 120));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      inventoryFilteredCache = [...inventoryProductsCache];
      renderInventoryGrid(inventoryProductsCache);
    }
  });
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
  setText('pdUpdated', formatDateMaybe(product.created_at || product.updated_at));

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
