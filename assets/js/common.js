// assets/js/common.js
const SUPABASE_URL = 'https://wfujoffqfgxeuzpealuj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdWpvZmZxZmd4ZXV6cGVhbHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY2OTYsImV4cCI6MjA4MDg2MjY5Nn0.rf0FIRxnBsBrUaHE4b965mRwpFhZrkAKSR3YiOpKHAw';

let _sb = null;
export function getSupabaseClient() {
  if (_sb) return _sb;
  if (!window.supabase?.createClient) {
    throw new Error('Supabase JS not loaded. Make sure you included supabase-js CDN before modules.');
  }
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// ===== UI helpers =====
export function showMessage(targetId, text, type = 'info') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = text || '';
  el.className = `message ${type}`.trim();
}

export function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (!m) return;
  m.classList.add('show');
}

export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (!m) return;
  m.classList.remove('show');
}

export function applyTheme(theme = 'light') {
  document.body.classList.toggle('dark-theme', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch {}
}

export function initThemeFromStorage() {
  try {
    const t = localStorage.getItem('theme');
    if (t) applyTheme(t);
  } catch {}
}

// ===== format helpers =====
export function formatRM(value) {
  const n = Number(value ?? 0);
  return `RM ${n.toFixed(2)}`;
}

export function formatDateMaybe(v) {
  if (!v) return '-';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

export function getStatusLabel(p) {
  const qty = Number(p?.quantity ?? 0);
  const low = Number(p?.low_stock_threshold ?? 10);
  if (qty <= 0) return 'Out of Stock';
  if (qty <= low) return 'Low Stock';
  return 'In Stock';
}

export function badgeClassFromStatus(status) {
  if (status === 'Out of Stock') return 'danger';
  if (status === 'Low Stock') return 'warning';
  return 'success';
}

export function showSigninPage() {
  const s1 = document.getElementById('signinPage');
  const s2 = document.getElementById('signupPage');
  const s3 = document.getElementById('dashboardPage');
  if (!s1 || !s2 || !s3) return;
  s1.style.display = 'flex';
  s2.style.display = 'none';
  s3.style.display = 'none';
}

export function showSignupPage() {
  const s1 = document.getElementById('signinPage');
  const s2 = document.getElementById('signupPage');
  const s3 = document.getElementById('dashboardPage');
  if (!s1 || !s2 || !s3) return;
  s1.style.display = 'none';
  s2.style.display = 'flex';
  s3.style.display = 'none';
}

export function showDashboard() {
  const s1 = document.getElementById('signinPage');
  const s2 = document.getElementById('signupPage');
  const s3 = document.getElementById('dashboardPage');
  if (!s1 || !s2 || !s3) return;
  s1.style.display = 'none';
  s2.style.display = 'none';
  s3.style.display = 'flex';
}

export function wireLogout(supabase) {
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const cancelBtn = document.getElementById('cancelLogout');
  const confirmBtn = document.getElementById('confirmLogout');

  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    if (logoutModal) logoutModal.classList.add('show');
    else doLogout();
  });

  cancelBtn?.addEventListener('click', () => logoutModal?.classList.remove('show'));

  confirmBtn?.addEventListener('click', async () => {
    await doLogout();
  });

  logoutModal?.addEventListener('click', (e) => {
    if (e.target === logoutModal) logoutModal.classList.remove('show');
  });

  async function doLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = './index.html';
    }
  }
}

export function getSavedSettings() {
  try {
    const raw = localStorage.getItem('inventorypro.settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem('inventorypro.settings', JSON.stringify(settings));
}
/*
export function applyTheme(theme, settings) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';

  document.body.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark-mode', theme === 'dark');
}
*/
