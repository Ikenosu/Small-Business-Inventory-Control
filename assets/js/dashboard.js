// assets/js/dashboard.js
import { getSupabaseClient, formatRM, openModal, closeModal, initThemeFromStorage } from './common.js';

const supabase = getSupabaseClient();

/* =========================
   Page Init
========================= */
window.addEventListener('DOMContentLoaded', async () => {
  initThemeFromStorage();
  wirePageButtons();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user?.id) {
    window.location.href = './index.html';
    return;
  }

  await fillSidebar(user);
  await updateDashboardStats(user.id);
});

/* =========================
   UI wiring
========================= */
function wirePageButtons() {
  document.getElementById('goToInventoryBtn')?.addEventListener('click', () => {
    window.location.href = './inventory.html';
  });

  document.getElementById('dashboardAddBtn')?.addEventListener('click', () => {
    window.location.href = './inventory.html#add';
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => openModal('logoutModal'));
  document.getElementById('cancelLogout')?.addEventListener('click', () => closeModal('logoutModal'));

  document.getElementById('confirmLogout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = './index.html';
  });

  document.querySelectorAll('.modal')?.forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('show');
    });
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
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  setText('sidebarName', fullName);
  setText('sidebarBusiness', businessName);
  setText('sidebarAvatar', initials);
}

/* =========================
   Dashboard Loader
========================= */
export async function updateDashboardStats(userId) {

  setText('dashboardTotalProducts', '...');
  setText('dashboardLowStock', '...');
  setText('dashboardOutOfStock', '...');
  setText('dashboardTotalValue', '...');

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    renderStats(products);
    renderLowStockAndOutStock(products);
    renderRecentActivity(products);

  } catch (err) {
    console.error(err);
    setText('dashboardTotalProducts', '0');
    setText('dashboardLowStock', '0');
    setText('dashboardOutOfStock', '0');
    setText('dashboardTotalValue', formatRM(0));
  }
}

/* =========================
   Render helpers
========================= */
function renderStats(products) {
  const total = products.length;

  const outStock = products.filter(p => Number(p.quantity) === 0).length;
  const lowStock = products.filter(p => {
    const q = Number(p.quantity);
    const low = Number(p.low_stock_threshold ?? 10);
    return q > 0 && q <= low;
  }).length;

  const totalValue = products.reduce((s, p) => {
    return s + Number(p.quantity) * Number(p.price);
  }, 0);

  setText('dashboardTotalProducts', total);
  setText('dashboardLowStock', lowStock);
  setText('dashboardOutOfStock', outStock);
  setText('dashboardTotalValue', formatRM(totalValue));
}

function renderLowStockAndOutStock(products) {
  const lowBox = document.getElementById('lowStockAlertBox');
  const outBox = document.getElementById('outOfStockAlertBox');
  if (!lowBox || !outBox) return;

  const low = products.filter(p => p.quantity > 0 && p.quantity <= (p.low_stock_threshold ?? 10));
  const out = products.filter(p => p.quantity === 0);

  lowBox.querySelector('.alert-count').textContent = low.length;
  outBox.querySelector('.alert-count').textContent = out.length;

  lowBox.querySelector('.alert-list').innerHTML =
    low.length ? low.map(p => `<div>${p.name} (${p.quantity})</div>`).join('') :
    '<div class="empty">No low stock items</div>';

  outBox.querySelector('.alert-list').innerHTML =
    out.length ? out.map(p => `<div>${p.name}</div>`).join('') :
    '<div class="empty">No out of stock items</div>';
}

function renderRecentActivity(products) {
  const list = document.getElementById('recentActivityList');
  if (!list) return;

  if (!products.length) {
    list.innerHTML = '<li class="empty">No recent activity yet</li>';
    return;
  }

  list.innerHTML = products
    .slice(-5)
    .reverse()
    .map(p => `<li>Updated product <b>${p.name}</b></li>`)
    .join('');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
