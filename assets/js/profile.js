// assets/js/profile.js (dashboard-style, stable)
import {
  getSupabaseClient,
  openModal,
  closeModal,
  initThemeFromStorage,
  applyTheme,
  formatRM
} from './common.js';

const supabase = getSupabaseClient();

let currentUserProfile = null; // { id, email, fullName, businessName, settings }

/* =========================
   Page Init
========================= */
window.addEventListener('DOMContentLoaded', async () => {
  initThemeFromStorage();

  wirePageButtons();     // ✅ logout + modal close
  wireProfileUI();       // ✅ edit + settings

  // ✅ same as dashboard
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const authUser = userRes?.user;

  if (userErr || !authUser?.id) {
    window.location.href = './index.html';
    return;
  }

  // ✅ load profile from DB + metadata fallback
  currentUserProfile = await fetchUserProfile(authUser);

  // ✅ render sidebar + profile page
  fillSidebar(currentUserProfile);
  fillProfilePage(currentUserProfile);

  await loadAccountStats(currentUserProfile.id);

  // ✅ apply theme from settings (if any)
  if (currentUserProfile.settings?.preferences?.theme) {
    applyTheme(currentUserProfile.settings.preferences.theme, currentUserProfile.settings);
  }
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

  // Click outside modal to close
  document.querySelectorAll('.modal')?.forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
  });

  // Optional: if you have a dedicated button
  document.getElementById('openEditProfileBtn')?.addEventListener('click', () => openModal('editProfileModal'));
  document.getElementById('closeEditProfile')?.addEventListener('click', () => closeModal('editProfileModal'));

  // =========================
  // Profile cards click → open modal (your current HTML uses IDs)
  // =========================
  document.getElementById('editProfileBtn')?.addEventListener('click', () => openModal('editProfileModal'));
  document.getElementById('notificationBtn')?.addEventListener('click', () => openModal('notificationModal'));
  document.getElementById('securityBtn')?.addEventListener('click', () => openModal('securityModal'));
  document.getElementById('preferencesBtn')
  ?.addEventListener('click', () => {
    openModal('preferencesModal');
    syncThemeButtonsFromSettings();
  });
    // =========================
    // Help Center (open modal + actions)
    // =========================
    document.getElementById('helpCenterBtn')
    ?.addEventListener('click', () => openModal('helpCenterModal'));

    // modal X close (data-modal="...")
    document.querySelectorAll('.modal-close[data-modal]')
    .forEach(btn => {
        btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-modal');
        if (id) closeModal(id);
        });
    });

    // quick links inside help modal
    document.getElementById('gettingStartedGuide')
    ?.addEventListener('click', () => {
        alert('📚 Getting Started Guide\n\n' +
          '1. Dashboard - View your inventory overview\n' +
          '2. Inventory - Add and manage your products\n' +
          '3. Reports - Generate business analytics\n' +
          '4. Profile - Manage your account settings\n\n' +
          'Need more help? Contact support at:\n' +
          '📧 support@inventorypro.com\n' +
          '📞 1-800-888-888');
    });

    document.getElementById('contactSupportBtn')
    ?.addEventListener('click', () => {
        alert('📞 Contact Support\n\n📧 Email: support@inventorypro.com\n📱 Phone: 1-800-888-888\n\nOur support team is available 24/7 to assist you!');
    });

    document.getElementById('contactSupportButton')
    ?.addEventListener('click', () => {
        alert('📞 Contact Support\n\n📧 Email: support@inventorypro.com\n📱 Phone: 1-800-888-888\n\nOur support team is available 24/7 to assist you!');
    });

    document.getElementById('emailUsBtn')
    ?.addEventListener('click', () => {
        window.location.href = 'mailto:support@inventorypro.com?subject=Inventory%20Pro%20Support';
    });
    

  // =========================
  // Optional support: if later you add data-open on elements
  // =========================
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open]');
    if (!trigger) return;
    e.preventDefault();
    const modalId = trigger.getAttribute('data-open');
    if (modalId) openModal(modalId);
  });

  document.querySelectorAll('.modal-close, .pd-close, [data-close], button[aria-label="Close"]')
  ?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = btn.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });
}


/* =========================
   Fetch profile from DB
========================= */
async function fetchUserProfile(authUser) {
  const fallbackFullName = authUser.user_metadata?.full_name || 'User';
  const fallbackBusiness = authUser.user_metadata?.business_name || 'My Business';
  const email = authUser.email || '';

  let fullName = fallbackFullName;
  let businessName = fallbackBusiness;
  let settings = null;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name,business_name,settings')
      .eq('user_id', authUser.id)
      .single();

    if (!error && data) {
      fullName = data.full_name || fullName;
      businessName = data.business_name || businessName;
      settings = data.settings || null;
    }
  } catch {}

  const safeSettings = normalizeSettings(settings);

  return {
    id: authUser.id,
    email,
    fullName,
    businessName,
    settings: safeSettings,
  };
}

function normalizeSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  s.notifications = s.notifications && typeof s.notifications === 'object' ? s.notifications : {};
  s.preferences = s.preferences && typeof s.preferences === 'object' ? s.preferences : {};

  // notifications defaults
  if (typeof s.notifications.lowStockAlert !== 'boolean') s.notifications.lowStockAlert = true;
  if (typeof s.notifications.outOfStockAlert !== 'boolean') s.notifications.outOfStockAlert = true;
  if (typeof s.notifications.newProductAlert !== 'boolean') s.notifications.newProductAlert = true;
  if (typeof s.notifications.priceChangeAlert !== 'boolean') s.notifications.priceChangeAlert = false;
  if (typeof s.notifications.emailNotifications !== 'boolean') s.notifications.emailNotifications = true;
  if (typeof s.notifications.pushNotifications !== 'boolean') s.notifications.pushNotifications = false;

  // preferences defaults
  if (!s.preferences.language) s.preferences.language = 'en-MY';
  if (!s.preferences.currency) s.preferences.currency = 'MYR';
  if (!s.preferences.dateFormat) s.preferences.dateFormat = 'DD/MM/YYYY';
  if (typeof s.preferences.dashboardStockAlerts !== 'boolean') s.preferences.dashboardStockAlerts = true;
  if (!s.preferences.theme) s.preferences.theme = 'light';

  return s;
}

/* =========================
   Sidebar + Profile Render
========================= */
function fillSidebar(p) {
  const initials = getInitials(p.fullName);

  setText('sidebarBusiness', p.businessName);
  setText('sidebarName', p.fullName);
  setText('sidebarAvatar', initials);
}

function fillProfilePage(p) {
  const initials = getInitials(p.fullName);

  // profile card
  setText('profileName', p.fullName);
  setText('profileBusiness', p.businessName);
  setText('profileAvatar', initials);

  // settings summary
  setText('settingName', p.fullName);
  setText('settingEmail', p.email);
  setText('settingBusiness', p.businessName);

  // edit form default values
  setValue('editFullName', p.fullName);
  setValue('editEmail', p.email);
  setValue('editBusinessName', p.businessName);

  // load toggles/selects
  loadSettingsUI(p.settings);
}

function loadSettingsUI(settings) {
  const byId = (id) => document.getElementById(id);

  // notifications
  if (byId('lowStockAlert')) byId('lowStockAlert').checked = !!settings.notifications.lowStockAlert;
  if (byId('outOfStockAlert')) byId('outOfStockAlert').checked = !!settings.notifications.outOfStockAlert;
  if (byId('newProductAlert')) byId('newProductAlert').checked = !!settings.notifications.newProductAlert;
  if (byId('priceChangeAlert')) byId('priceChangeAlert').checked = !!settings.notifications.priceChangeAlert;
  if (byId('emailNotifications')) byId('emailNotifications').checked = !!settings.notifications.emailNotifications;
  if (byId('pushNotifications')) byId('pushNotifications').checked = !!settings.notifications.pushNotifications;

  // preferences
  if (byId('languageSelect')) byId('languageSelect').value = settings.preferences.language;
  if (byId('currencySelect')) byId('currencySelect').value = settings.preferences.currency;
  if (byId('dateFormatSelect')) byId('dateFormatSelect').value = settings.preferences.dateFormat;
  if (byId('dashboardStockAlerts')) byId('dashboardStockAlerts').checked = !!settings.preferences.dashboardStockAlerts;
}

/* =========================
   Profile Actions
========================= */
function wireProfileUI() {
  // Edit Profile submit
  document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserProfile?.id) return;

    const fullName = (document.getElementById('editFullName')?.value || '').trim();
    const businessName = (document.getElementById('editBusinessName')?.value || '').trim();

    if (!fullName || !businessName) {
      alert('Please fill in all fields.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const oldText = submitBtn?.textContent || 'Save Changes';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
      // update auth metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: fullName, business_name: businessName },
      });
      if (metaError) throw metaError;

      // update user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName, business_name: businessName })
        .eq('user_id', currentUserProfile.id);

      if (profileError) throw profileError;

      // update local + UI
      currentUserProfile.fullName = fullName;
      currentUserProfile.businessName = businessName;

      fillSidebar(currentUserProfile);
      fillProfilePage(currentUserProfile);
      closeModal('editProfileModal');
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Error updating profile: ' + (err?.message || String(err)));
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText; }
    }

    // ✅ Preferences theme click: any element inside preferencesModal with [data-theme]
    document.addEventListener('click', (e) => {
    const el = e.target.closest('#preferencesModal [data-theme]');
    if (!el) return;

    const theme = el.getAttribute('data-theme');
    if (!theme) return;

    // update memory + apply immediately
    if (!currentUserProfile?.settings) return;
    currentUserProfile.settings.preferences.theme = theme;

    applyTheme(theme, currentUserProfile.settings);

    // optional: visual active state
    document.querySelectorAll('#preferencesModal [data-theme]')
        .forEach(x => x.classList.toggle('active', x.getAttribute('data-theme') === theme));
    });
  });

  // Save notification settings
  document.getElementById('saveNotificationSettings')?.addEventListener('click', async function () {
    if (!currentUserProfile?.id) return;

    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const s = currentUserProfile.settings;

      s.notifications.lowStockAlert = !!document.getElementById('lowStockAlert')?.checked;
      s.notifications.outOfStockAlert = !!document.getElementById('outOfStockAlert')?.checked;
      s.notifications.newProductAlert = !!document.getElementById('newProductAlert')?.checked;
      s.notifications.priceChangeAlert = !!document.getElementById('priceChangeAlert')?.checked;
      s.notifications.emailNotifications = !!document.getElementById('emailNotifications')?.checked;
      s.notifications.pushNotifications = !!document.getElementById('pushNotifications')?.checked;

      const { error } = await supabase
        .from('user_profiles')
        .update({ settings: s })
        .eq('user_id', currentUserProfile.id);

      if (error) throw error;

      // keep a local copy so other pages (e.g., dashboard) can react immediately
      try { localStorage.setItem('inventorypro.settings', JSON.stringify(s)); } catch (e) {}

      closeModal('notificationModal');
      alert('Notification settings saved successfully!');
    } catch (err) {
      alert('Failed to save notification settings: ' + (err?.message || String(err)));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
    // =========================
    // Security: Change Password (with current password validation)
    // =========================
    document.getElementById('securityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentEl = document.getElementById('currentPassword');
    const newEl = document.getElementById('newPassword');
    const confirmEl = document.getElementById('confirmNewPassword');

    const currentPw = (currentEl?.value || '').trim();
    const newPw = (newEl?.value || '').trim();
    const confirmPw = (confirmEl?.value || '').trim();

    let msgEl = document.getElementById('securityMsg');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'securityMsg';
        msgEl.style.marginTop = '12px';
        msgEl.style.fontSize = '14px';
        msgEl.style.display = 'none';
        const form = document.getElementById('securityForm');
        const submitBtnTmp = form?.querySelector('button[type="submit"]');
        if (submitBtnTmp?.parentNode) submitBtnTmp.parentNode.insertBefore(msgEl, submitBtnTmp);
    }

    const showMsg = (text, type = 'error') => {
        msgEl.textContent = text;
        msgEl.style.display = 'block';
        msgEl.style.color = type === 'ok' ? '#22c55e' : '#ef4444';
    };

    msgEl.style.display = 'none';
    msgEl.textContent = '';

    // ✅ validations
    if (!currentPw || !newPw || !confirmPw) {
        showMsg('Please fill in all password fields.');
        return;
    }
    if (newPw.length < 6) {
        showMsg('New password must be at least 6 characters.');
        return;
    }
    if (newPw !== confirmPw) {
        showMsg('New Password and Confirm New Password do not match.');
        return;
    }
    if (currentPw === newPw) {
        showMsg('New password must be different from current password.');
        return;
    }

    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const oldText = btn?.textContent || 'Update Password';
    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

    try {
        // 1) get current email
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user?.email) throw (userErr || new Error('No user session.'));

        const email = userRes.user.email;

        // 2) Re-auth with current password (validate current password)
        const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
        });
        if (signInErr) {
        showMsg('Current password is incorrect.');
        return;
        }

        // 3) Update password
        const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
        if (updateErr) throw updateErr;

        showMsg('Password updated successfully!', 'ok');

        // clear fields
        currentEl.value = '';
        newEl.value = '';
        confirmEl.value = '';

        // close modal
        closeModal('securityModal');
    } catch (err) {
        showMsg('Failed to update password: ' + (err?.message || String(err)));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = oldText; }
    }
    });

  // Save preferences
  document.getElementById('savePreferences')?.addEventListener('click', async function () {
    if (!currentUserProfile?.id) return;

    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const s = currentUserProfile.settings;

      const df = document.getElementById('dateFormatSelect')?.value;
      if (df) s.preferences.dateFormat = df;

      s.preferences.dashboardStockAlerts = !!document.getElementById('dashboardStockAlerts')?.checked;

      const lang = document.getElementById('languageSelect')?.value;
      if (lang) s.preferences.language = lang;

      const cur = document.getElementById('currencySelect')?.value;
      if (cur) s.preferences.currency = cur;

      const { error } = await supabase
        .from('user_profiles')
        .update({ settings: s })
        .eq('user_id', currentUserProfile.id);

      if (error) throw error;

      // keep a local copy so other pages (e.g., dashboard) can react immediately
      try { localStorage.setItem('inventorypro.settings', JSON.stringify(s)); } catch (e) {}

      // apply theme immediately if you have a theme selector (optional)
      applyTheme(s.preferences.theme, s);

      closeModal('preferencesModal');
      alert('Preferences saved successfully!');
    } catch (err) {
      alert('Failed to save preferences: ' + (err?.message || String(err)));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
  /* =========================
   Preferences: Theme switch (Light / Dark)
    ========================= */
    document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        if (!theme || !currentUserProfile?.settings) return;

        currentUserProfile.settings.preferences.theme = theme;

        applyTheme(theme, currentUserProfile.settings);

        document.querySelectorAll('.theme-option')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
    });
}

/* =========================
   Helpers
========================= */
function getInitials(name) {
  return String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? '';
}

function setValue(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

async function loadAccountStats(userId) {
  let productsCount = 0;
  let totalValue = 0;

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('quantity,price')
      .eq('user_id', userId);

    if (error) throw error;

    const list = products || [];
    productsCount = list.length;

    totalValue = list.reduce((sum, p) => {
      const qty = Number(p.quantity ?? 0);
      const price = Number(p.price ?? 0);
      return sum + qty * price;
    }, 0);
  } catch (e) {
    console.warn('[Profile] loadAccountStats products failed:', e?.message || e);
  }

  /* 2) Reports：
  let reportsCount = 0;
  try {
    const { count, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!error && typeof count === 'number') reportsCount = count;
  } catch (e) {
   //
  } */

  // 3) UI
  setText('accountStatProducts', String(productsCount));
  let reportsCount = 0;
  try {
    reportsCount = Number(localStorage.getItem(`inventorypro.reports_count.${userId}`) || 0);
  } catch {}
  setText('accountStatReports', String(reportsCount));
  

  // Fallback: localStorage counter (works without any DB table)
  if (!reportsCount) {
    try {
      reportsCount = Number(localStorage.getItem(`inventorypro.reports_count.${userId}`) || 0);
    } catch {}
  }

  setText('accountStatReports', String(reportsCount));

  if (typeof formatRM === 'function') {
    setText('accountStatValue', formatRM(totalValue));
  } else {
    setText('accountStatValue', 'RM ' + totalValue.toFixed(2));
  }
}

function syncThemeButtonsFromSettings() {
  const theme = currentUserProfile?.settings?.preferences?.theme || 'light';

  document.querySelectorAll('.theme-option').forEach(btn => {
    const t = btn.getAttribute('data-theme');
    btn.classList.toggle('active', t === theme);
  });
}

document.addEventListener('click', (e) => {
    const modalTarget = e.target.closest('[data-modal]');
    if (!modalTarget) return;

    const modalId = modalTarget.dataset.modal;
    if (modalId) {
        closeModal(modalId);
    }
});