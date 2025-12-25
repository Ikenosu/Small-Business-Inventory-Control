// assets/js/reports.js
import {
  formatRM,
  getSupabaseClient,
  openModal,
  closeModal,
  initThemeFromStorage
} from './common.js';

const supabase = getSupabaseClient();

let currentUserId = null;
let productsCache = [];
let currentRangeKey = 'today';
let currentRange = null; // { startISO, endISO, label }

window.addEventListener('DOMContentLoaded', async () => {
  initThemeFromStorage();
  wirePageButtons();
  wireRangeUI();
  wireGenerateReportUI();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user?.id) {
    window.location.href = './index.html';
    return;
  }

  currentUserId = user.id;
  await fillSidebar(user);

  // load baseline products once
  productsCache = await loadProducts(currentUserId);

  // default range: today
  currentRange = buildRange('today');
  updateRangeLabelUI();
  await refreshReports();
});

/* =========================
   Logout + Modals
========================= */
function wirePageButtons() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => openModal('logoutModal'));
  document.getElementById('cancelLogout')?.addEventListener('click', () => closeModal('logoutModal'));
  document.getElementById('confirmLogout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './index.html';
  });

  document.querySelectorAll('.modal')?.forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
  });
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

  setText('sidebarName', fullName);
  setText('sidebarBusiness', businessName);
  setText('sidebarAvatar', initials);
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? '';
}

/* =========================
   Data loaders
========================= */
async function loadProducts(userId) {
  const { data, error } = await supabase
    .from('products')
    .select('id,name,sku,category,quantity,price,low_stock_threshold,created_at,user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function loadImports(userId, range) {
  const { data, error } = await supabase
    .from('import_records')
    .select('id,product_id,product_name,quantity,unit_price,total_amount,imported_at,created_at,user_id')
    .eq('user_id', userId)
    .gte('imported_at', range.startISO)
    .lte('imported_at', range.endISO)
    .order('imported_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function loadExports(userId, range) {
  const { data, error } = await supabase
    .from('export_records')
    .select('id,product_id,product_name,quantity,unit_price,total_amount,exported_at,created_at,user_id')
    .eq('user_id', userId)
    .gte('exported_at', range.startISO)
    .lte('exported_at', range.endISO)
    .order('exported_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

/* =========================
   Range UI
========================= */
function wireRangeUI() {
  document.querySelectorAll('.range-chip')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.range-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentRangeKey = btn.dataset.range;
      const customBox = document.getElementById('customRangeBox');
      if (customBox) customBox.style.display = (currentRangeKey === 'custom') ? 'flex' : 'none';

      if (currentRangeKey !== 'custom') {
        currentRange = buildRange(currentRangeKey);
        updateRangeLabelUI();
        await refreshReports();
      }
    });
  });

  document.getElementById('applyCustomRangeBtn')?.addEventListener('click', async () => {
    const s = document.getElementById('rangeStart')?.value;
    const e = document.getElementById('rangeEnd')?.value;
    if (!s || !e) return alert('Please select start & end date.');

    currentRange = buildCustomRange(s, e);
    updateRangeLabelUI();
    await refreshReports();
  });
}

function updateRangeLabelUI() {
  const label = document.getElementById('reportRangeLabel');
  if (label) label.textContent = currentRange?.label || '—';
}

function buildRange(key) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);

  if (key === 'today') {
    start.setHours(0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: 'Today' };
  }

  if (key === 'week') {
    // week starts Monday
    const day = (now.getDay() + 6) % 7; // Mon=0
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: 'This Week' };
  }

  if (key === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: 'This Month' };
  }

  // year
  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString(), label: 'This Year' };
}

function buildCustomRange(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(23, 59, 59, 999);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label: `Custom (${startDateStr} → ${endDateStr})`
  };
}

/* =========================
   Render
========================= */
async function refreshReports() {
  if (!currentUserId || !currentRange) return;

  const [imports, exports] = await Promise.all([
    loadImports(currentUserId, currentRange),
    loadExports(currentUserId, currentRange),
  ]);

  // KPI
  const totalProducts = productsCache.length;

  const importUnits = imports.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const exportUnits = exports.reduce((s, r) => s + Number(r.quantity || 0), 0);

  const importValue = imports.reduce((s, r) => s + Number(r.total_amount || (Number(r.unit_price || 0) * Number(r.quantity || 0))), 0);
  const exportValue = exports.reduce((s, r) => s + Number(r.total_amount || (Number(r.unit_price || 0) * Number(r.quantity || 0))), 0);

  const netUnits = importUnits - exportUnits;
  const netValue = importValue - exportValue;

  setText('kpiTotalProducts', String(totalProducts));
  setText('kpiImportUnits', String(importUnits));
  setText('kpiExportUnits', String(exportUnits));
  setText('kpiNetUnits', String(netUnits));

  setText('kpiImportValue', formatRM(importValue));
  setText('kpiExportValue', formatRM(exportValue));
  setText('kpiNetValue', formatRM(netValue));

  // Movement bars
  renderMovementBars(importUnits, exportUnits, netUnits);

  // Category breakdown (by value)
  renderCategory(productsCache);

  // Low stock
  renderLowStock(productsCache);

  // Activity
  renderActivity(imports, exports);
}

function renderMovementBars(importUnits, exportUnits, netUnits) {
  const root = document.getElementById('movementBars');
  if (!root) return;

  const max = Math.max(1, importUnits, exportUnits, Math.abs(netUnits));

  const rows = [
    { label: 'Import', val: importUnits, cls: 'import' },
    { label: 'Export', val: exportUnits, cls: 'export' },
    { label: 'Net', val: Math.abs(netUnits), cls: 'net', show: `${netUnits}` },
  ];

  root.innerHTML = rows.map(r => {
    const pct = Math.min(100, Math.round((r.val / max) * 100));
    const valText = (r.label === 'Net') ? r.show : String(r.val);

    return `
      <div class="bar-row">
        <div><b>${r.label}</b></div>
        <div class="bar-track"><div class="bar-fill ${r.cls}" style="width:${pct}%"></div></div>
        <div style="text-align:right; opacity:.8">${valText}</div>
      </div>
    `;
  }).join('');

  const note = document.getElementById('movementNote');
  if (note) {
    note.textContent = `Range: ${currentRange?.label || '-'}`;
  }
}

function renderCategory(products) {
  const root = document.getElementById('categoryList');
  if (!root) return;

  // sum value by category
  const map = new Map();
  for (const p of products) {
    const cat = p.category || 'Other';
    const value = Number(p.quantity || 0) * Number(p.price || 0);
    map.set(cat, (map.get(cat) || 0) + value);
  }

  const rows = [...map.entries()].sort((a,b) => b[1] - a[1]);
  const total = rows.reduce((s, x) => s + x[1], 0) || 1;

  root.innerHTML = rows.slice(0, 8).map(([cat, val]) => {
    const pct = Math.round((val / total) * 100);
    return `
      <div class="cat-row">
        <div><b>${escapeHtml(cat)}</b></div>
        <div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div>
        <div style="text-align:right; opacity:.8">${pct}%</div>
      </div>
    `;
  }).join('');
}

function renderLowStock(products) {
  const root = document.getElementById('lowStockList');
  if (!root) return;

  const lows = products
    .filter(p => Number(p.quantity || 0) <= Number(p.low_stock_threshold ?? 10))
    .sort((a,b) => Number(a.quantity || 0) - Number(b.quantity || 0))
    .slice(0, 8);

  if (!lows.length) {
    root.innerHTML = `<div class="muted">No low stock items 🎉</div>`;
    return;
  }

  root.innerHTML = lows.map(p => {
    const qty = Number(p.quantity || 0);
    const low = Number(p.low_stock_threshold ?? 10);
    const badge = qty === 0
      ? `<span class="badge-pill badge-out">Out</span>`
      : `<span class="badge-pill badge-low">Low</span>`;

    return `
      <div class="lowstock-item">
        <div>
          <div><b>${escapeHtml(p.name || '-')}</b></div>
          <div class="muted">SKU: ${escapeHtml(p.sku || '-')}</div>
        </div>
        <div style="text-align:right;">
          ${badge}
          <div><b>${low}</b> / ${qty}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderActivity(imports, exports) {
  const root = document.getElementById('activityList');
  if (!root) return;

  const items = [];

  for (const r of imports) {
    items.push({
      type: 'IMPORT',
      at: r.imported_at || r.created_at,
      name: r.product_name || '-',
      qty: Number(r.quantity || 0),
    });
  }
  for (const r of exports) {
    items.push({
      type: 'EXPORT',
      at: r.exported_at || r.created_at,
      name: r.product_name || '-',
      qty: Number(r.quantity || 0),
    });
  }

  items.sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const top = items.slice(0, 10);
  if (!top.length) {
    root.innerHTML = `<div class="muted">No activity in this range.</div>`;
    return;
  }

  root.innerHTML = top.map(it => {
    const badge = it.type === 'IMPORT'
      ? `<span class="badge-pill badge-import">Import</span>`
      : `<span class="badge-pill badge-export">Export</span>`;

    const sign = it.type === 'IMPORT' ? '+' : '-';
    return `
      <div class="activity-item">
        <div>
          <div><b>${escapeHtml(it.name)}</b></div>
          <div class="muted">${formatDateTime(it.at)}</div>
        </div>
        <div style="text-align:right;">
          ${badge}
          <div><b>${sign}${it.qty}</b></div>
        </div>
      </div>
    `;
  }).join('');
}

function formatDateTime(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s || '-');
  return d.toLocaleString();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* =========================
   PDF / Generate Report
========================= */
function wireGenerateReportUI() {
  document.getElementById('openGenerateReportBtn')?.addEventListener('click', () => {
    updateRangeLabelUI();
    openModal('generateReportModal');
  });

  document.getElementById('closeGenerateReportModal')?.addEventListener('click', () => closeModal('generateReportModal'));
  document.getElementById('cancelGenerateReportBtn')?.addEventListener('click', () => closeModal('generateReportModal'));

  document.getElementById('generateReportForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.querySelector('input[name="reportType"]:checked')?.value || 'full';
    if (!currentUserId || !currentRange) return;

    // fetch fresh range data for the PDF
    const [imports, exports] = await Promise.all([
      loadImports(currentUserId, currentRange),
      loadExports(currentUserId, currentRange),
    ]);

    const pdfRoot = document.getElementById('pdfRoot');
    if (!pdfRoot) return;

    pdfRoot.innerHTML = buildPdfHtml(type, productsCache, imports, exports, currentRange);
    pdfRoot.classList.add('pdf-light');
    pdfRoot.classList.remove('dark-theme');
    pdfRoot.style.background = '#ffffff';
    pdfRoot.style.color = '#0f172a';

    // html2pdf
    const opt = {
      margin: 10,
      filename: `inventory_report_${type}_${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    closeModal('generateReportModal');

    // show it temporarily for rendering
    pdfRoot.style.display = 'block';
    await window.html2pdf().set(opt).from(pdfRoot).save();
    pdfRoot.style.display = 'none';

    // ✅ Track generated report count per user (localStorage)
    try {
      const key = `inventorypro.reports_count.${currentUserId}`;
      const next = Number(localStorage.getItem(key) || 0) + 1;
      localStorage.setItem(key, String(next));
    } catch {}
      });
}

function buildPdfHtml(type, products, imports, exports, range) {
  const totalProducts = products.length;

  const importUnits = imports.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const exportUnits = exports.reduce((s, r) => s + Number(r.quantity || 0), 0);

  const importValue = imports.reduce((s, r) => s + Number(r.total_amount || (Number(r.unit_price || 0) * Number(r.quantity || 0))), 0);
  const exportValue = exports.reduce((s, r) => s + Number(r.total_amount || (Number(r.unit_price || 0) * Number(r.quantity || 0))), 0);

  const netUnits = importUnits - exportUnits;
  const netValue = importValue - exportValue;

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:20px;font-weight:800;">Inventory Report</div>
        <div style="opacity:.75;">Type: <b>${type}</b></div>
        <div style="opacity:.75;">Range: <b>${escapeHtml(range.label)}</b></div>
      </div>
      <div style="text-align:right;opacity:.75;">
        Generated: ${new Date().toLocaleString()}
      </div>
    </div>
    <hr style="margin:14px 0; border:none; border-top:1px solid rgba(15,23,42,0.15);" />
  `;

  const summary = `
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
      ${pdfStat('Total Products', totalProducts)}
      ${pdfStat('Import Units', importUnits)}
      ${pdfStat('Export Units', exportUnits)}
      ${pdfStat('Net Units', netUnits)}
    </div>
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
      ${pdfStat('Import Value', formatRM(importValue))}
      ${pdfStat('Export Value', formatRM(exportValue))}
      ${pdfStat('Net Value', formatRM(netValue))}
    </div>
  `;

  const fullTable = () => `
    <h3 style="margin-top:16px;">Product Details</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:#e8f0ff;">
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">Name</th>
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">SKU</th>
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">Category</th>
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Qty</th>
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Price</th>
          <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Total Value</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => {
          const qty = Number(p.quantity || 0);
          const price = Number(p.price || 0);
          const value = qty * price;
          return `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.name || '')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.sku || '')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.category || 'Other')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${qty}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatRM(price)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatRM(value)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const lowStockTable = () => {
    const lows = products.filter(p => Number(p.quantity || 0) <= Number(p.low_stock_threshold ?? 10));
    return `
      <h3 style="margin-top:16px;">Low Stock Items</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#fff7ed;">
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">Name</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">SKU</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Qty</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Threshold</th>
          </tr>
        </thead>
        <tbody>
          ${lows.map(p => `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.name || '')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.sku || '')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${Number(p.quantity || 0)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${Number(p.low_stock_threshold ?? 10)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const movementTable = () => `
    <h3 style="margin-top:16px;">Movement Summary</h3>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      ${pdfStat('Import Units', importUnits)}
      ${pdfStat('Export Units', exportUnits)}
      ${pdfStat('Net Units', netUnits)}
      ${pdfStat('Net Value', formatRM(netValue))}
    </div>
  `;

  const valuationByCategory = () => {
    const map = new Map();
    for (const p of products) {
      const cat = p.category || 'Other';
      const value = Number(p.quantity || 0) * Number(p.price || 0);
      map.set(cat, (map.get(cat) || 0) + value);
    }
    const rows = [...map.entries()].sort((a,b)=>b[1]-a[1]);
    return `
      <h3 style="margin-top:16px;">Valuation by Category</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#ecfeff;">
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:left;">Category</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([cat,val]) => `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(cat)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatRM(val)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  let body = '';
  if (type === 'full') body = fullTable();
  if (type === 'low_stock') body = lowStockTable();
  if (type === 'movement') body = movementTable();
  if (type === 'valuation') body = valuationByCategory();

  return `${header}${summary}${body}`;
}

function pdfStat(title, value) {
  return `
    <div style="border:1px solid rgba(15,23,42,0.15); border-radius:10px; padding:10px;">
      <div style="font-size:12px;opacity:.7;font-weight:600;">${escapeHtml(title)}</div>
      <div style="font-size:16px;font-weight:800;margin-top:6px;">${escapeHtml(String(value))}</div>
    </div>
  `;
}
