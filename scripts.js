// Initialize Supabase Client
const SUPABASE_URL = 'https://wfujoffqfgxeuzpealuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdWpvZmZxZmd4ZXV6cGVhbHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY2OTYsImV4cCI6MjA4MDg2MjY5Nn0.rf0FIRxnBsBrUaHE4b965mRwpFhZrkAKSR3YiOpKHAw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOW_STOCK_THRESHOLD = 10;

// Global Variables
let currentUser = null;
let userSettings = {
    notifications: {
        lowStockAlert: true,
        outOfStockAlert: true,
        newProductAlert: false,
        priceChangeAlert: false,
        emailNotifications: true,
        pushNotifications: false
    },
    preferences: {
        language: 'en',
        currency: 'MYR',
        dateFormat: 'MM/DD/YYYY',
        theme: 'light',
        dashboardStockAlerts: true
    }
};

// Page Navigation Functions
function showSigninPage() {
    document.getElementById('signinPage').style.display = 'flex';
    document.getElementById('signupPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'none';
}

function showSignupPage() {
    document.getElementById('signinPage').style.display = 'none';
    document.getElementById('signupPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
}

function showDashboard() {
    document.getElementById('signinPage').style.display = 'none';
    document.getElementById('signupPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'flex';
    showPage('dashboard');
}

// Dashboard Page Navigation
function showPage(pageName) {
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName + 'Content').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
}

// Message Display
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    setTimeout(() => {
        messageEl.className = 'message';
    }, 5000);
}

// Sign Up Handler
document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const businessName = document.getElementById('businessName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    
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
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
    
    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    business_name: businessName
                }
            }
        });
        
        if (authError) throw authError;
        
        if (authData.user) {
            const { error: profileError } = await supabaseClient
                .from('user_profiles')
                .insert([{
                    user_id: authData.user.id,
                    full_name: fullName,
                    business_name: businessName,
                    email: email,
                    settings: userSettings
                }]);
        }
        
        showMessage('signupMessage', 'Account created successfully! Redirecting to sign in...', 'success');
        document.getElementById('signupForm').reset();
        
        setTimeout(() => {
            showSigninPage();
        }, 2000);
        
    } catch (error) {
        showMessage('signupMessage', error.message || 'An error occurred during sign up.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
    }
});

// Sign In Handler
document.getElementById('signinForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value.trim();
    
    if (!email || !password) {
        showMessage('signinMessage', 'Please fill in all fields.', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        const { data: profileData } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .single();
        
        const userData = profileData || data.user.user_metadata;
        
        currentUser = {
            id: data.user.id,
            fullName: profileData?.full_name || userData.full_name || 'User',
            businessName: profileData?.business_name || userData.business_name || 'My Business',
            email: data.user.email
        };
        
        // Load settings from database (just like name and business name)
        if (profileData?.settings) {
            userSettings = {
                notifications: {
                    lowStockAlert: profileData.settings.notifications?.lowStockAlert ?? true,
                    outOfStockAlert: profileData.settings.notifications?.outOfStockAlert ?? true,
                    newProductAlert: profileData.settings.notifications?.newProductAlert ?? false,
                    priceChangeAlert: profileData.settings.notifications?.priceChangeAlert ?? false,
                    emailNotifications: profileData.settings.notifications?.emailNotifications ?? true,
                    pushNotifications: profileData.settings.notifications?.pushNotifications ?? false
                },
                preferences: {
                    language: profileData.settings.preferences?.language ?? 'en',
                    currency: profileData.settings.preferences?.currency ?? 'MYR',
                    dateFormat: profileData.settings.preferences?.dateFormat ?? 'MM/DD/YYYY',
                    theme: profileData.settings.preferences?.theme ?? 'light',
                    dashboardStockAlerts: profileData.settings.preferences?.dashboardStockAlerts ?? true
                }
            };
        }
        
        showMessage('signinMessage', 'Login successful! Loading dashboard...', 'success');
        document.getElementById('signinForm').reset();
        
        setTimeout(() => {
            loadDashboard(currentUser);
            loadAllSettings();
            showDashboard();
        }, 1000);
        
    } catch (error) {
        showMessage('signinMessage', error.message || 'Invalid email or password.', 'error');
        await supabaseClient.auth.signOut();
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// Load Dashboard
function loadDashboard(userProfile) {
    const initials = userProfile.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    document.getElementById('sidebarBusiness').textContent = userProfile.businessName;
    document.getElementById('sidebarName').textContent = userProfile.fullName;
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('profileName').textContent = userProfile.fullName;
    document.getElementById('profileBusiness').textContent = userProfile.businessName;
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('settingName').textContent = userProfile.fullName;
    document.getElementById('settingEmail').textContent = userProfile.email;
    document.getElementById('settingBusiness').textContent = userProfile.businessName;
    document.getElementById('editFullName').value = userProfile.fullName;
    document.getElementById('editEmail').value = userProfile.email;
    document.getElementById('editBusinessName').value = userProfile.businessName;
}

// Load All Settings
function loadAllSettings() {
    document.getElementById('lowStockAlert').checked = userSettings.notifications.lowStockAlert;
    document.getElementById('outOfStockAlert').checked = userSettings.notifications.outOfStockAlert;
    document.getElementById('newProductAlert').checked = userSettings.notifications.newProductAlert;
    document.getElementById('priceChangeAlert').checked = userSettings.notifications.priceChangeAlert;
    document.getElementById('emailNotifications').checked = userSettings.notifications.emailNotifications;
    document.getElementById('pushNotifications').checked = userSettings.notifications.pushNotifications;

    updateNotificationStatus();
    updateSecurityStatus();

    document.getElementById('languageSelect').value = userSettings.preferences.language;
    document.getElementById('currencySelect').value = userSettings.preferences.currency;
    document.getElementById('dateFormatSelect').value = userSettings.preferences.dateFormat;
    document.getElementById('dashboardStockAlerts').checked = userSettings.preferences.dashboardStockAlerts;

    applyTheme(userSettings.preferences.theme);
}

// Update Notification Status
function updateNotificationStatus() {
    const isEnabled = 
        userSettings.notifications.emailNotifications ||
        userSettings.notifications.pushNotifications;
    
    document.getElementById('notificationStatus').textContent = isEnabled ? 'Enabled' : 'Disabled';
}

// Update Security Status
function updateSecurityStatus() {
    const statusBox = document.getElementById('securityStatusBox');
    const statusTitle = document.getElementById('securityStatusTitle');
    const statusDesc = document.getElementById('securityStatusDesc');
    const settingValue = document.getElementById('securityStatus');
    
    statusBox.className = 'security-status medium';
    statusTitle.textContent = 'Security Status: Medium';
    statusDesc.textContent = 'Your account is protected with a password';
    settingValue.textContent = 'Medium';
}

// Apply Theme
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.theme === 'dark') {
                opt.classList.add('active');
            }
        });
    } else {
        document.body.classList.remove('dark-theme');
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.theme === 'light') {
                opt.classList.add('active');
            }
        });
    }
    userSettings.preferences.theme = theme;
}

// Save Settings to Supabase
async function saveSettings() {
    if (!currentUser || !currentUser.id) {
        console.error('No user logged in');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('user_profiles')
            .update({ 
                settings: userSettings
            })
            .eq('user_id', currentUser.id);
        
        if (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
        
        console.log('Settings saved to database successfully');
    } catch (error) {
        console.error('Error in saveSettings:', error);
        throw error;
    }
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        showPage(this.dataset.page);
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', function() {
    openModal('logoutModal');
});

document.getElementById('confirmLogout').addEventListener('click', async function() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        userSettings = {
            notifications: {
                lowStockAlert: true,
                outOfStockAlert: true,
                newProductAlert: false,
                priceChangeAlert: false,
                emailNotifications: true,
                pushNotifications: false
            },
            preferences: {
                language: 'en',
                currency: 'MYR',
                dateFormat: 'MM/DD/YYYY',
                theme: 'light',
                dashboardStockAlerts: true
            }
        };
        
        closeModal('logoutModal');
        document.body.classList.remove('dark-theme');
        showSigninPage();
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
});

document.getElementById('cancelLogout').addEventListener('click', function() {
    closeModal('logoutModal');
});

// Sign In/Up Navigation
document.getElementById('goToSignup').addEventListener('click', function(e) {
    e.preventDefault();
    showSignupPage();
});

document.getElementById('goToSignin').addEventListener('click', function(e) {
    e.preventDefault();
    showSigninPage();
});

// Modal Functions
let modalInitialState = {};

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('show');

    if (modalId === 'editProfileModal' && currentUser) {
        const name = document.getElementById('editFullName');
        const email = document.getElementById('editEmail');
        const business = document.getElementById('editBusinessName');

        if (name) name.value = currentUser.fullName;
        if (email) email.value = currentUser.email;
        if (business) business.value = currentUser.businessName;
    }

    if (modalId === 'preferencesModal') {
        const dateSelect = document.getElementById('dateFormatSelect');
        if (dateSelect) {
            modalInitialState.dateFormat = dateSelect.value;
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Modal Buttons
document.getElementById('editProfileBtn').addEventListener('click', () => openModal('editProfileModal'));
document.getElementById('notificationBtn').addEventListener('click', () => openModal('notificationModal'));
document.getElementById('securityBtn').addEventListener('click', () => openModal('securityModal'));
document.getElementById('preferencesBtn').addEventListener('click', () => openModal('preferencesModal'));
document.getElementById('helpCenterBtn').addEventListener('click', () => openModal('helpCenterModal'));

// Close Modals
document.querySelectorAll('.modal-close, .btn-secondary[data-modal]').forEach(btn => {
    btn.addEventListener('click', function() {
        const modalId = this.dataset.modal;
        const modal = modalId ? document.getElementById(modalId) : this.closest('.modal');
        
        if (modal) {
            if (modal.id === 'notificationModal') {
                loadAllSettings();
            }
            if (modal.id === 'securityModal') {
                document.getElementById('securityForm').reset();
            }
            if (modal.id === 'preferencesModal') {
                if (modalInitialState.theme) {
                    applyTheme(modalInitialState.theme);
                }
                loadAllSettings();
            }
        }
        
        if (modalId) {
            closeModal(modalId);
        } else {
            modal.classList.remove('show');
        }
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            if (this.id === 'notificationModal') {
                loadAllSettings();
            }
            if (this.id === 'securityModal') {
                document.getElementById('securityForm').reset();
            }
            if (this.id === 'preferencesModal') {
                if (modalInitialState.theme) {
                    applyTheme(modalInitialState.theme);
                }
                loadAllSettings();
            }
            this.classList.remove('show');
        }
    });
});

// Edit Profile Form - EMAIL DISABLED, NAME & BUSINESS ONLY
document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('editFullName').value.trim();
    const businessName = document.getElementById('editBusinessName').value.trim();
    
    if (!fullName || !businessName) {
        alert('Please fill in all fields.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    try {
        // Update User Metadata
        const { error: metaError } = await supabaseClient.auth.updateUser({
            data: {
                full_name: fullName,
                business_name: businessName
            }
        });
        
        if (metaError) throw metaError;
        
        // Update Profile Database (email stays the same)
        const { error: profileError } = await supabaseClient
            .from('user_profiles')
            .update({
                full_name: fullName,
                business_name: businessName
            })
            .eq('user_id', currentUser.id);
        
        if (profileError) throw profileError;
        
        // Update Current User (email remains unchanged)
        currentUser.fullName = fullName;
        currentUser.businessName = businessName;
        
        loadDashboard(currentUser);
        closeModal('editProfileModal');
        alert('Profile updated successfully!');
        
    } catch (error) {
        alert('Error updating profile: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
});

// Save Notification Settings
document.getElementById('saveNotificationSettings').addEventListener('click', async function() {
    const saveBtn = this;
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        // Update userSettings object (in memory)
        userSettings.notifications.lowStockAlert = document.getElementById('lowStockAlert').checked;
        userSettings.notifications.outOfStockAlert = document.getElementById('outOfStockAlert').checked;
        userSettings.notifications.newProductAlert = document.getElementById('newProductAlert').checked;
        userSettings.notifications.priceChangeAlert = document.getElementById('priceChangeAlert').checked;
        userSettings.notifications.emailNotifications = document.getElementById('emailNotifications').checked;
        userSettings.notifications.pushNotifications = document.getElementById('pushNotifications').checked;
        
        updateNotificationStatus();
        
        // Save to database (SAME WAY as name/business name)
        const { error } = await supabaseClient
            .from('user_profiles')
            .update({ 
                settings: userSettings
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        closeModal('notificationModal');
        alert('Notification settings saved successfully!');
    } catch (error) {
        console.error('Error saving notification settings:', error);
        alert('Failed to save notification settings: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
});

// Security Form - Password Change
document.getElementById('securityForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        alert('Please fill in all password fields.');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        alert('New passwords do not match!');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    
    try {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            alert('Current password is incorrect!');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
            return;
        }
        
        submitBtn.textContent = 'Updating...';
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        document.getElementById('securityForm').reset();
        alert('Password updated successfully!');
        
    } catch (error) {
        alert('Error updating password: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
    }
});

// Preferences Form
document.getElementById('savePreferences').addEventListener('click', async function() {
    const saveBtn = this;
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        userSettings.preferences.language = document.getElementById('languageSelect').value;
        userSettings.preferences.currency = document.getElementById('currencySelect').value;
        userSettings.preferences.dateFormat = document.getElementById('dateFormatSelect').value;
        userSettings.preferences.dashboardStockAlerts = document.getElementById('dashboardStockAlerts').checked;
        
        // Save to database (SAME WAY as name/business name)
        const { error } = await supabaseClient
            .from('user_profiles')
            .update({ 
                settings: userSettings
            })
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        closeModal('preferencesModal');
        alert('Preferences saved successfully!');
    } catch (error) {
        console.error('Error saving preferences:', error);
        alert('Failed to save preferences: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
});

// Theme Selector
document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', function() {
        const theme = this.dataset.theme;
        applyTheme(theme);
    });
});

// Help Center Actions
document.getElementById('gettingStartedGuide').addEventListener('click', function() {
    closeModal('helpCenterModal');
    
    alert('📚 Getting Started Guide\n\n' +
          '1. Dashboard - View your inventory overview\n' +
          '2. Inventory - Add and manage your products\n' +
          '3. Reports - Generate business analytics\n' +
          '4. Profile - Manage your account settings\n\n' +
          'Need more help? Contact support at:\n' +
          '📧 support@inventorypro.com\n' +
          '📞 1-800-888-888');
});

document.getElementById('contactSupportBtn').addEventListener('click', function() {
    alert('📞 Contact Support\n\n📧 Email: support@inventorypro.com\n📱 Phone: 1-800-888-888\n\nOur support team is available 24/7 to assist you!');
});

document.getElementById('emailUsBtn').addEventListener('click', function() {
    window.location.href = 'mailto:support@inventorypro.com?subject=Inventory Pro Support Request';
});

document.getElementById('contactSupportButton').addEventListener('click', function() {
    alert('📞 Contact Support\n\n📧 Email: support@inventorypro.com\n📱 Phone: 1-800-888-888\n\nOur support team is available 24/7 to assist you!');
});

// Check for existing session on page load
window.addEventListener('DOMContentLoaded', async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        try {
            const { data: profileData } = await supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
            
            const userData = profileData || session.user.user_metadata;
            
            currentUser = {
                id: session.user.id,
                fullName: profileData?.full_name || userData.full_name || 'User',
                businessName: profileData?.business_name || userData.business_name || 'My Business',
                email: session.user.email
            };
            
            // Load settings from database (just like name and business name)
            if (profileData?.settings) {
                userSettings = {
                    notifications: {
                        lowStockAlert: profileData.settings.notifications?.lowStockAlert ?? true,
                        outOfStockAlert: profileData.settings.notifications?.outOfStockAlert ?? true,
                        newProductAlert: profileData.settings.notifications?.newProductAlert ?? false,
                        priceChangeAlert: profileData.settings.notifications?.priceChangeAlert ?? false,
                        emailNotifications: profileData.settings.notifications?.emailNotifications ?? true,
                        pushNotifications: profileData.settings.notifications?.pushNotifications ?? false
                    },
                    preferences: {
                        language: profileData.settings.preferences?.language ?? 'en',
                        currency: profileData.settings.preferences?.currency ?? 'MYR',
                        dateFormat: profileData.settings.preferences?.dateFormat ?? 'MM/DD/YYYY',
                        theme: profileData.settings.preferences?.theme ?? 'light',
                        dashboardStockAlerts: profileData.settings.preferences?.dashboardStockAlerts ?? true
                    }
                };
            }
            
            loadDashboard(currentUser);
            loadAllSettings();
            showDashboard();
        } catch (error) {
            console.error('Error loading user data:', error);
            showSigninPage();
        }
    } else {
        showSigninPage();
    }
});

// --- ADD THIS TO CONNECT SIDEBAR TO NEW PAGES ---

// Select all sidebar links
const menuItems = document.querySelectorAll('.menu-item, .sidebar a'); 
const pages = document.querySelectorAll('.content-page');

menuItems.forEach(item => {
    item.addEventListener('click', function(e) {
        // Prevent default anchor click behavior
        e.preventDefault();

        // 1. Remove 'active' class from all menu items
        menuItems.forEach(link => link.classList.remove('active'));
        
        // 2. Add 'active' class to the clicked item
        this.classList.add('active');

        // 3. Hide all content pages
        pages.forEach(page => page.style.display = 'none');

        // 4. Show the specific page based on the clicked link's text or ID
        const linkText = this.innerText.trim().toLowerCase();
        
        if (linkText.includes('dashboard')) {
            document.getElementById('dashboardContent').style.display = 'block';
            updateDashboardStats(); // Refresh stats when opening dashboard
        } 
        else if (linkText.includes('inventory')) {
            document.getElementById('inventoryContent').style.display = 'block';
            renderInventoryTable(); // Refresh table when opening inventory
        } 
        else if (linkText.includes('report')) {
            document.getElementById('reportsContent').style.display = 'block';
        }
        else if (linkText.includes('profile')) {
            // Assuming your original profile section has this ID
            const profileSection = document.getElementById('profile-section') || document.getElementById('profileContent');
            if(profileSection) profileSection.style.display = 'block';
        }
    });
});

document.getElementById('dashboardContent').style.display = 'block';
document.getElementById('inventoryContent').style.display = 'none';
document.getElementById('reportsContent').style.display = 'none';

async function updateDashboardStats() {
    console.log("Updating Dashboard stats...");
    
    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*');

        if (error) throw error;

        const totalCount = products.length;
        
        const outStockCount = products.filter(p => p.quantity === 0).length;

        const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= 10).length;
        
        const totalValue = products.reduce((sum, item) => {
            return sum + (Number(item.price) * Number(item.quantity));
        }, 0);

        const totalEl = document.getElementById('dashboardTotalProducts');
        const lowStockEl = document.getElementById('dashboardLowStock');
        const outStockEl = document.getElementById('dashboardOutOfStock');
        const valueEl = document.getElementById('dashboardTotalValue');

        if (totalEl) totalEl.textContent = totalCount;
        if (lowStockEl) lowStockEl.textContent = lowStockCount;
        if (outStockEl) outStockEl.textContent = outStockCount; 
        
        if (valueEl) valueEl.textContent = 'RM ' + totalValue.toLocaleString('en-MY', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2  
        });

        renderStockAlerts(products);
        renderRecentActivity();

    } catch (err) {
        console.error('Failed to fetch Dashboard data:', err);
    }
}

/* UPDATED FIX: SAVE SKU, LOW STOCK & PREVENT DOUBLE CLICK */
document.addEventListener('DOMContentLoaded', function() {
    
    // Get Elements
    const dashboardAddBtn = document.getElementById('dashboardAddBtn');
    const modal = document.getElementById('addProductModal');
    const closeBtn = document.getElementById('closeAddModal');
    const cancelBtn = document.getElementById('cancelAddProduct');
    const addForm = document.getElementById('addProductForm');

    // Helpers to switch Add vs Edit
    const editProdIdEl = document.getElementById('editProdId');
    const modalHeaderTitle = modal ? modal.querySelector('.modal-header h3') : null;

    function setAddMode() {
        if (editProdIdEl) editProdIdEl.value = '';
        if (modalHeaderTitle) modalHeaderTitle.textContent = 'Add New Product';
        const submitBtn = addForm ? addForm.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.textContent = 'Add Product';
    }

    function setEditMode() {
        if (modalHeaderTitle) modalHeaderTitle.textContent = 'Edit Product';
        const submitBtn = addForm ? addForm.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.textContent = 'Save Changes';
    }

    // Open Modal Logic
    if (dashboardAddBtn && modal) {
        dashboardAddBtn.addEventListener('click', function() {
            setAddMode();
            modal.style.display = 'block'; 
        });
    }

    // Close Modal Function
    function closeModal() {
        modal.style.display = 'none';
        if (addForm) addForm.reset();
        setAddMode();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    }

    // Save Data
    if (addForm) {
        addForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // 🔒 Lock the button to prevent double-clicking
            const submitBtn = addForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.textContent : 'Save';
            
            if (submitBtn) {
                submitBtn.disabled = true;       
                submitBtn.textContent = 'Saving...'; 
            }

            // Get values from input fields
            const name = document.getElementById('newProdName').value;
            const sku = document.getElementById('newProdSku').value;       
            const category = document.getElementById('newProdCategory').value;
            const qty = Number(document.getElementById('newProdQty').value);
            const lowStock = Number(document.getElementById('newProdLowStock').value); 
            const price = Number(document.getElementById('newProdPrice').value);

            // Calculate Status Logic
            let status = 'In Stock';
            if (qty === 0) status = 'Out of Stock';
            else if (qty <= lowStock) status = 'Low Stock';

            try {
                const editId = (document.getElementById('editProdId')?.value || '').trim();

                if (editId) {
                    const { error } = await supabaseClient
                        .from('products')
                        .update({
                            name: name,
                            sku: sku,
                            category: category,
                            quantity: qty,
                            price: price,
                            low_stock_threshold: lowStock,
                            status: status
                        })
                        .eq('id', editId);
                    if (error) throw error;
                    activityEditProduct({ name, quantity: qty, price });
                    alert('Product updated successfully!');
                } else {
                    const { error } = await supabaseClient
                        .from('products')
                        .insert([
                            {
                                name: name,
                                sku: sku,
                                category: category,
                                quantity: qty,
                                price: price,
                                low_stock_threshold: lowStock,
                                status: status
                            }
                        ]);
                    if (error) throw error;
                    activityAddProduct({name, quantity: qty, price });
                    alert('Product added successfully!');
                }

                closeModal();
                
                if (typeof updateDashboardStats === 'function') updateDashboardStats();

                if (typeof renderInventoryTable === 'function') renderInventoryTable(); 

            } catch (error) {
                console.error('Error:', error);
                alert('Error: ' + error.message);
            } finally {

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        });
    }
});

// ---------- Inventory Product Details Modal (click a card to open) ----------
let inventoryProductsCache = [];
let selectedProductId = null;

function formatDateMaybe(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    // e.g. 11/11/2025
    return d.toLocaleDateString('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function openProductDetailsModal(p) {
    const modal = document.getElementById('productDetailsModal');
    if (!modal || !p) return;

    selectedProductId = String(p.id ?? '');

    const status = getStatusLabel(p);
    const badgeClass = badgeClassFromStatus(status);

    const qty = Number(p.quantity ?? 0);
    const price = Number(p.price ?? 0);
    const total = qty * price;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('pdName', p.name ?? 'Unnamed');
    setText('pdSku', `SKU : ${p.sku ?? '-'}`);
    setText('pdQty', String(qty));
    setText('pdPrice', formatRM(price));
    setText('pdCategory', p.category ?? '-');
    setText('pdLowStock', String(Number(p.low_stock_threshold ?? 10)));
    setText('pdUpdated', formatDateMaybe(p.updated_at || p.created_at));
    setText('pdTotalValue', formatRM(total));

    const statusEl = document.getElementById('pdStatus');
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = `pd-status badge ${badgeClass}`;
    }

    modal.classList.add('show');
}

function closeProductDetailsModal() {
    const modal = document.getElementById('productDetailsModal');
    if (!modal) return;
    modal.classList.remove('show');
    selectedProductId = null;
}

function openAddProductForEdit(p) {
    const modal = document.getElementById('addProductModal');
    const form = document.getElementById('addProductForm');
    const editIdEl = document.getElementById('editProdId');
    const headerTitle = modal ? modal.querySelector('.modal-header h3') : null;
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!modal || !form || !p) return;

    if (editIdEl) editIdEl.value = String(p.id ?? '');
    if (headerTitle) headerTitle.textContent = 'Edit Product';
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    // Prefill
    document.getElementById('newProdName').value = p.name ?? '';
    document.getElementById('newProdSku').value = p.sku ?? '';
    document.getElementById('newProdCategory').value = p.category ?? 'Other';
    document.getElementById('newProdQty').value = Number(p.quantity ?? 0);
    document.getElementById('newProdLowStock').value = Number(p.low_stock_threshold ?? 10);
    document.getElementById('newProdPrice').value = Number(p.price ?? 0);

    modal.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    // Close button + outside click
    const pdClose = document.getElementById('pdCloseBtn');
    const pdModal = document.getElementById('productDetailsModal');
    if (pdClose) pdClose.addEventListener('click', closeProductDetailsModal);
    if (pdModal) {
        pdModal.addEventListener('click', (e) => {
            if (e.target === pdModal) closeProductDetailsModal();
        });
    }

    // Card click delegation (Inventory tab only)
    const grid = document.getElementById('inventoryGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (!card) return;
            const id = card.getAttribute('data-id');
            const p = inventoryProductsCache.find(x => String(x.id) === String(id));
            if (p) openProductDetailsModal(p);
        });
    }

    // Edit + Delete buttons in details modal
    const editBtn = document.getElementById('pdEditBtn');
    const delBtn = document.getElementById('pdDeleteBtn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const p = inventoryProductsCache.find(x => String(x.id) === String(selectedProductId));
            if (!p) return;
            closeProductDetailsModal();
            openAddProductForEdit(p);
        });
    }

    if (delBtn) {
        delBtn.addEventListener('click', async () => {
            const p = inventoryProductsCache.find(x => String(x.id) === String(selectedProductId));
            if (!p) return;

            const ok = confirm(`Delete "${p.name ?? 'this product'}"? This cannot be undone.`);
            if (!ok) return;

            try {
                const { error } = await supabaseClient
                    .from('products')
                    .delete()
                    .eq('id', p.id);
                if (error) throw error;

                closeProductDetailsModal();
                if (typeof updateDashboardStats === 'function') updateDashboardStats();
                if (typeof renderInventoryTable === 'function') renderInventoryTable();
                activityDeleteProduct({ name: p.name});
                alert('Product deleted.');
            } catch (err) {
                console.error('Delete failed:', err);
                alert('Failed to delete product: ' + (err.message || err));
            }
        });
    }
});

const goToInvBtn = document.getElementById('goToInventoryBtn');
if (goToInvBtn) {
    goToInvBtn.addEventListener('click', function() {
        const invLink = document.querySelector('.nav-item[data-page="inventory"]');
        if (invLink) {
            invLink.click();
        }
    });
}

const dashboardLink = document.querySelector('.nav-item[data-page="dashboard"]');
if (dashboardLink) {
    dashboardLink.addEventListener('click', function() {
        if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }
    });
}

/* SAVE PRODUCT */
function saveProduct() {
    const product = {
        name: productName.value,
        sku: productSKU.value,
        category: productCategory.value,
        price: productPrice.value,
        quantity: productQuantity.value
    };

    if (isEditMode) {
        const index = editIndex.value;
        inventory[index] = product;
    } else {
        inventory.push(product);
    }

    closeModal();
    renderInventory();
}

/* RENDER INVENTORY LIST */
function renderInventory() {
    const list = document.getElementById('inventoryList');
    list.innerHTML = "";

    inventory.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${item.name}</strong> (SKU: ${item.sku})
            <span>Qty: ${item.quantity}</span>
        `;
        li.onclick = () => openEditMenu(index);
        list.appendChild(li);
    });
}

/* OPEN EDIT MENU */
function openEditMenu(index) {
    isEditMode = true;

    const item = inventory[index];
    editIndex.value = index;

    modalTitle.innerText = "Edit Product";
    productName.value = item.name;
    productSKU.value = item.sku;
    productCategory.value = item.category;
    productPrice.value = item.price;
    productQuantity.value = item.quantity;

    deleteBtn.classList.remove('hidden');
    openModal();
}

/* DELETE PRODUCT */
function deleteProduct() {
    const index = editIndex.value;
    inventory.splice(index, 1);
    closeModal();
    renderInventory();
}

function openInventoryModal() {
    inventoryModal.classList.remove('hidden');
}

function closeInventoryModal() {
    inventoryModal.classList.add('hidden');
}

function clearForm() {
    productName.value = "";
    productSKU.value = "";
    productCategory.value = "";
    productPrice.value = "";
    productQuantity.value = "";
}

document.addEventListener('DOMContentLoaded', () => {
  const invAddBtn = document.querySelector('#inventoryContent .add-btn');
  const addProductModal = document.getElementById('addProductModal');

  if (invAddBtn && addProductModal) {
    invAddBtn.addEventListener('click', () => {
      // force "add" mode
      const editIdEl = document.getElementById('editProdId');
      if (editIdEl) editIdEl.value = '';
      const headerTitle = addProductModal.querySelector('.modal-header h3');
      if (headerTitle) headerTitle.textContent = 'Add New Product';
      const form = document.getElementById('addProductForm');
      if (form) {
        form.reset();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Product';
      }
      addProductModal.style.display = 'block';
    });
  }
});

function getStatusLabel(p) {
  // Prefer DB status if present, else compute from quantity + threshold
  if (p.status) return p.status;

  const qty = Number(p.quantity ?? 0);
  const low = Number(p.low_stock_threshold ?? 10);

  if (qty === 0) return 'Out of Stock';
  if (qty <= low) return 'Low Stock';
  return 'In Stock';
}

function badgeClassFromStatus(status) {
  const s = String(status).toLowerCase();
  if (s.includes('out')) return 'out-stock';
  if (s.includes('low')) return 'low-stock';
  return 'in-stock';
}

function formatRM(value) {
  const n = Number(value ?? 0);
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildProductCard(p) {
  const status = getStatusLabel(p);
  const badgeClass = badgeClassFromStatus(status);

  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-title">
        <span>${p.name ?? 'Unnamed'}</span>
        <span class="badge ${badgeClass}">${status}</span>
      </div>
      <div class="product-row">SKU : ${p.sku ?? '-'}</div>
      <div class="product-info">
        <div><strong>Quantity</strong><br>${Number(p.quantity ?? 0)}</div>
        <div><strong>Price</strong><br>${formatRM(p.price)}</div>
        <div><strong>Category</strong><br>${p.category ?? '-'}</div>
      </div>
    </div>
  `;
}

async function renderInventoryTable() {
  const grid = document.getElementById('inventoryGrid');
  const countEl = document.getElementById('productCount');
  const searchEl = document.getElementById('inventorySearch');

  if (!grid || !countEl) return;

  grid.innerHTML = '';                // clear
  countEl.textContent = 'Loading...';

  try {
    const { data: products, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const all = products || [];
    // cache for product-details modal (click product card)
    inventoryProductsCache = all;
    countEl.textContent = `${all.length} products`;

    // Render initial
    grid.innerHTML = all.map(buildProductCard).join('');

    // Search filter (client-side)
    if (searchEl) {
      searchEl.oninput = () => {
        const q = searchEl.value.trim().toLowerCase();
        const filtered = all.filter(p =>
          String(p.name ?? '').toLowerCase().includes(q) ||
          String(p.sku ?? '').toLowerCase().includes(q) ||
          String(p.category ?? '').toLowerCase().includes(q)
        );
        countEl.textContent = `${filtered.length} products`;
        grid.innerHTML = filtered.map(buildProductCard).join('');
      };
    }

  } catch (err) {
    console.error('Inventory load failed:', err);
    countEl.textContent = '0 products';
    grid.innerHTML = `<p style="color:#6b7280;">Failed to load products. Check console + Supabase table/permissions.</p>`;
  }
}

// ---------- Recent Activity System ----------


// Save and display recent activities
function logActivity({ action, productName, quantity, price }) {
    const name = productName || 'Unnamed';
    const activity = { action, productName: name, quantity, price, timestamp: Date.now() };

    const activities = JSON.parse(localStorage.getItem('recentActivities')) || [];
    activities.unshift(activity);
    localStorage.setItem('recentActivities', JSON.stringify(activities.slice(0, 10)));

    renderRecentActivity();
}

// Render recent activities in dashboard
function renderRecentActivity() {
    const list = document.getElementById('recentActivityList');
    if (!list) return;

    const activities = JSON.parse(localStorage.getItem('recentActivities')) || [];
    list.innerHTML = '';

    if (activities.length === 0) {
        list.innerHTML = `<li class="empty">No recent activity yet</li>`;
        return;
    }

    activities.forEach(act => {
        const li = document.createElement('li');
        li.className = 'activity-item';

        li.innerHTML = `
            <div class="activity-grid">
                <div class="left top">
                    <span class="activity-title">
                        <strong>${act.productName}</strong> ${act.action}
                    </span>
                </div>

                <div class="right top">
                    ${act.quantity != null ? `${act.quantity} units` : ''}
                </div>

                <div class="left bottom">
                    Updated ${timeAgo(act.timestamp)}
                </div>

                <div class="right bottom">
                    ${act.price != null ? `RM ${Number(act.price).toFixed(2)}` : ''}
                </div>
            </div>
        `;

        list.appendChild(li);
    });
}

// Utility function: format time ago
function timeAgo(ts) {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

// ---------- Hook into product actions ----------

// Call this when adding a product
function activityAddProduct(product) {
    logActivity({ 
        action: 'added', 
        productName: product.name, 
        quantity: product.quantity, 
        price: product.price 
    });
}

// Call this when editing a product
function activityEditProduct(product) {
    logActivity({ 
        action: 'edited', 
        productName: product.name, 
        quantity: product.quantity, 
        price: product.price 
    });
}

// Call this when deleting a product
function activityDeleteProduct(product) {
    logActivity({
        action: 'deleted',
        productName: product.name
    });
}

// ---------- ALERT SYSTEM MODULE ----------
function getStockAlerts(products) {
    return {
        lowStock: products.filter(
            p => Number(p.quantity) > 0 && Number(p.quantity) <= (Number(p.low_stock_threshold) || LOW_STOCK_THRESHOLD)
        ),
        outOfStock: products.filter(p => Number(p.quantity) === 0)
    };
}

function renderStockAlerts(products) {
    const { lowStock, outOfStock } = getStockAlerts(products);

    const lowStockBox = document.getElementById('lowStockAlertBox');
    const outStockBox = document.getElementById('outOfStockAlertBox');


    // LOW STOCK ALERT
    if (lowStock.length > 0) {
        lowStockBox.style.display = 'block';
        lowStockBox.querySelector('.alert-count').textContent = `${lowStock.length} items need attention`;
    lowStockBox.querySelector('.alert-list').innerHTML = lowStock.map(p => `
        <div class="alert-item">
            <div class="alert-grid">
                <div class="name">${p.name}</div>
                <div class="qty">${p.quantity} left</div>

                <div class="sku">SKU: ${p.sku}</div>
                <div class="min">Min: ${p.low_stock_threshold ?? LOW_STOCK_THRESHOLD}</div>
            </div>
        </div>
    `).join('');
    } else {
    lowStockBox.style.display = 'block';
    lowStockBox.querySelector('.alert-count').textContent = '';
    lowStockBox.querySelector('.alert-list').innerHTML =
        `<div class="alert-empty">No items low on stock</div>`;

    }

    // OUT OF STOCK
    if (outOfStock.length > 0) {
        outStockBox.style.display = 'block'; 
        outStockBox.querySelector('.alert-count').textContent =
            `${outOfStock.length} items unavailable`;
        
        outStockBox.querySelector('.alert-list').innerHTML = outOfStock.map(p => `
            <div class="alert-item"> 
                <div>
                    <strong>${p.name}</strong>
                    <div class="sku">SKU: ${p.sku}</div>
                </div>
                <span class="badge out">Out of Stock</span>
            </div>
        `).join('');
    } else {
    outStockBox.style.display = 'block';
    outStockBox.querySelector('.alert-count').textContent = '';
    outStockBox.querySelector('.alert-list').innerHTML =
        `<div class="alert-empty">No items out of stock</div>`;
    }
}



// ---------- INITIAL RENDER ----------
document.addEventListener('DOMContentLoaded', () => {
    renderRecentActivity();
});


lowStockContainer.innerHTML = "";
outStockContainer.innerHTML = "";
// (Inventory add button wiring is handled above; avoid duplicate listeners.)