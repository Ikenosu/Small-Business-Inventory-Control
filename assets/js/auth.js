// assets/js/auth.js

const SUPABASE_URL = 'https://wfujoffqfgxeuzpealuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdWpvZmZxZmd4ZXV6cGVhbHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY2OTYsImV4cCI6MjA4MDg2MjY5Nn0.rf0FIRxnBsBrUaHE4b965mRwpFhZrkAKSR3YiOpKHAw';

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let userSettings = {
  notifications: {
    lowStockAlert: true,
    outOfStockAlert: true,
    newProductAlert: false,
    priceChangeAlert: false,
    emailNotifications: true,
    pushNotifications: false,
  },
  preferences: {
    language: 'en',
    currency: 'MYR',
    dateFormat: 'MM/DD/YYYY',
    theme: 'light',
    dashboardStockAlerts: true,
  },
};

function showMessage(targetId, text, type = 'info') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = text || '';
  el.className = `message ${type}`.trim();
}

function showSigninPage() {
  const s1 = document.getElementById('signinPage');
  const s2 = document.getElementById('signupPage');
  if (!s1 || !s2) return;
  s1.style.display = 'flex';
  s2.style.display = 'none';
}
function showSignupPage() {
  const s1 = document.getElementById('signinPage');
  const s2 = document.getElementById('signupPage');
  if (!s1 || !s2) return;
  s1.style.display = 'none';
  s2.style.display = 'flex';
}

async function handleSignup(e) {
  e.preventDefault();

  const fullName = document.getElementById('fullName')?.value.trim();
  const businessName = document.getElementById('businessName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const password = document.getElementById('signupPassword')?.value.trim();
  const confirmPassword = document.getElementById('confirmPassword')?.value.trim();

  if (!fullName || !businessName || !email || !password || !confirmPassword) {
    showMessage('signupMessage', 'Please fill in all fields.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showMessage('signupMessage', 'Passwords do not match!', 'error');
    return;
  }
  if (password.length < 6) {
    showMessage('signupMessage', 'Password must be at least 6 characters long.', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
  }

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, business_name: businessName } },
    });
    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await supabaseClient.from('user_profiles').insert([{
        user_id: authData.user.id,
        full_name: fullName,
        business_name: businessName,
        email,
        settings: userSettings,
      }]);
      if (profileError) console.warn('Profile insert failed:', profileError.message);
    }

    showMessage('signupMessage', 'Account created! Please sign in.', 'success');
    document.getElementById('signupForm')?.reset();
    setTimeout(showSigninPage, 800);
  } catch (err) {
    showMessage('signupMessage', err.message || 'Sign up failed.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign Up';
    }
  }
}

async function handleSignin(e) {
  e.preventDefault();

  const email = document.getElementById('signinEmail')?.value.trim();
  const password = document.getElementById('signinPassword')?.value.trim();

  if (!email || !password) {
    showMessage('signinMessage', 'Please fill in all fields.', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showMessage('signinMessage', 'Login successful! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 250);
  } catch (err) {
    showMessage('signinMessage', err.message || 'Invalid email or password.', 'error');
    await supabaseClient.auth.signOut();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }
}

function wireLoginPageUI() {
  document.getElementById('goToSignup')?.addEventListener('click', (e) => { e.preventDefault(); showSignupPage(); });
  document.getElementById('goToSignin')?.addEventListener('click', (e) => { e.preventDefault(); showSigninPage(); });

  document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
  document.getElementById('signinForm')?.addEventListener('submit', handleSignin);
}

window.addEventListener('DOMContentLoaded', async () => {
  wireLoginPageUI();
  showSigninPage();
});
