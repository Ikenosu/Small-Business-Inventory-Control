// Initialize Supabase Client
const SUPABASE_URL = 'https://wfujoffqfgxeuzpealuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdWpvZmZxZmd4ZXV6cGVhbHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY2OTYsImV4cCI6MjA4MDg2MjY5Nn0.rf0FIRxnBsBrUaHE4b965mRwpFhZrkAKSR3YiOpKHAw';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    modal.classList.add('show');
    
    if (modalId === 'editProfileModal' && currentUser) {
        document.getElementById('editFullName').value = currentUser.fullName;
        document.getElementById('editEmail').value = currentUser.email;
        document.getElementById('editBusinessName').value = currentUser.businessName;
    }
    
    if (modalId === 'preferencesModal') {
        modalInitialState.theme = userSettings.preferences.theme;
        modalInitialState.dateFormat = document.getElementById('dateFormatSelect').value;
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