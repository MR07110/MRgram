// assets/js/settings.js

import { openVault, getSecretContacts, addSecretContact, deleteSecretContact } from "./vault.js";

let currentUser = null;
let settingsLoaded = false;

export async function initSettings(user) {
    console.log("initSettings called", user);
    currentUser = user;

    // ========== SETTINGS VIEW ELEMENTINI TOPISH YOKI YARATISH ==========
    let settingsView = document.getElementById('settingsView');
    
    if (!settingsView) {
        settingsView = document.createElement('div');
        settingsView.id = 'settingsView';
        settingsView.className = 'settings-container';
        document.body.appendChild(settingsView);
        console.log("✅ settingsView elementi yaratildi");
    }

    // ========== HTML NI YUKLASH ==========
    if (!settingsLoaded) {
        try {
           const response = await fetch('./html/settings.html');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            settingsView.innerHTML = html;
            settingsLoaded = true;
            console.log("✅ Settings HTML yuklandi");
        } catch (err) {
            console.error("❌ Settings HTML yuklanmadi:", err);
            return;
        }
    }

    // ========== FUNKSIYALARNI ULASH ==========
    attachSettingsEvents();
    loadUserData();
    setupTheme();
    setupNotifications();
    setupChatSettings();
    setupVoiceSettings();
    setupDataHandlers();
    setupAbout();
    setupVaultPanel();

    // ========== SETTINGSNI KO'RSATISH ==========
    settingsView.style.display = 'flex';
    switchSettingsTab('profile');
    console.log("✅ Settings ochildi");
}

function attachSettingsEvents() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.dataset.tab;
            if (tabName) switchSettingsTab(tabName);
        };
    });

    const closeBtn = document.getElementById('closeSettingsBtn');
    if (closeBtn) closeBtn.onclick = () => {
        document.getElementById('settingsView').style.display = 'none';
    };

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) saveProfileBtn.onclick = saveProfile;

    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                if (e.target.files[0]) await updateAvatar(e.target.files[0]);
            };
            input.click();
        };
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.onclick = changePassword;

    const enableNotificationsBtn = document.getElementById('enableNotifications');
    if (enableNotificationsBtn) enableNotificationsBtn.onclick = requestNotificationPermission;

    const notificationSound = document.getElementById('notificationSound');
    if (notificationSound) {
        notificationSound.checked = localStorage.getItem('notif_sound') !== 'false';
        notificationSound.onchange = (e) => {
            localStorage.setItem('notif_sound', e.target.checked);
        };
    }

    const enableMicBtn = document.getElementById('enableMicBtn');
    if (enableMicBtn) enableMicBtn.onclick = requestMicrophonePermission;

    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) clearCacheBtn.onclick = () => clearCache();

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.onclick = exportData;

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) deleteAccountBtn.onclick = deleteAccount;
}

function loadUserData() {
    const nameInput = document.getElementById('settingsName');
    const usernameInput = document.getElementById('settingsUsername');
    const bioInput = document.getElementById('settingsBio');
    
    if (nameInput) nameInput.value = currentUser.name || '';
    if (usernameInput) usernameInput.value = currentUser.username || '';
    if (bioInput) bioInput.value = currentUser.bio || '';
}

async function saveProfile() {
    const name = document.getElementById('settingsName').value.trim();
    const bio = document.getElementById('settingsBio').value.trim();
    if (!name) return alert("Ismni kiriting!");

    const updateData = {};
    if (name !== currentUser.name) updateData.name = name;
    if (bio !== currentUser.bio) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) return;

    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(db, "users", currentUser.uid), updateData);
        currentUser = { ...currentUser, ...updateData };
        localStorage.setItem('mrgram_user', JSON.stringify(currentUser));
        alert("✅ Profil yangilandi!");
        
        const sidebarName = document.getElementById('sidebarName');
        const meName = document.getElementById('meName');
        if (sidebarName) sidebarName.innerText = currentUser.name;
        if (meName) meName.innerText = currentUser.name;
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

async function updateAvatar(file) {
    try {
        const { uploadAvatar } = await import("./upload-file.js");
        const url = await uploadAvatar(file);
        const { db } = await import("./config/firebase-config.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
        currentUser.photoURL = url;
        localStorage.setItem('mrgram_user', JSON.stringify(currentUser));
        
        const profileImg = document.getElementById('profileAvatarImg');
        const sidebarImg = document.getElementById('sidebarAvatarImg');
        if (profileImg) profileImg.src = url;
        if (sidebarImg) sidebarImg.src = url;
        
        alert("✅ Rasm yangilandi!");
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

async function changePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    
    if (!oldPass || !newPass || !confirmPass) return alert("Barcha maydonlarni to'ldiring!");
    if (newPass !== confirmPass) return alert("Yangi parol va tasdiqlash mos emas!");
    if (newPass.length < 6) return alert("Parol kamida 6 belgi!");
    if (oldPass !== currentUser.password) return alert("Eski parol xato!");

    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(db, "users", currentUser.uid), { password: newPass });
        currentUser.password = newPass;
        localStorage.setItem('mrgram_user', JSON.stringify(currentUser));
        alert("✅ Parol o'zgartirildi!");
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

async function requestNotificationPermission() {
    const { requestNotificationPermission } = await import("./notifications.js");
    const granted = await requestNotificationPermission(currentUser);
    const statusSpan = document.getElementById('notificationStatus');
    if (statusSpan) {
        if (granted) {
            statusSpan.innerHTML = '✅ Yoqilgan';
            statusSpan.style.color = '#28a745';
        } else {
            statusSpan.innerHTML = '❌ Ruxsat berilmagan';
            statusSpan.style.color = '#ff3b30';
        }
    }
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const micSpan = document.getElementById('micStatus');
        if (micSpan) {
            micSpan.innerHTML = '✅ Ruxsat berilgan';
            micSpan.style.color = '#28a745';
        }
    } catch (err) {
        const micSpan = document.getElementById('micStatus');
        if (micSpan) {
            micSpan.innerHTML = '❌ Ruxsat berilmagan';
            micSpan.style.color = '#ff3b30';
        }
    }
}

// ========== YANGI FUNKSIYALAR ==========
function clearCache() {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
    alert('Kesh tozalandi!');
}

function exportData() {
    const data = {
        user: currentUser,
        settings: {
            theme: localStorage.getItem('mrgram_theme'),
            notif_sound: localStorage.getItem('notif_sound'),
            chat_bg: localStorage.getItem('chat_bg'),
            chat_font_size: localStorage.getItem('chat_font_size'),
            ringtone: localStorage.getItem('ringtone')
        },
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrgram_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function deleteAccount() {
    if (!confirm("Hisobingiz butunlay o'chiriladi. Davom etasizmi?")) return;
    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await deleteDoc(doc(db, "users", currentUser.uid));
        localStorage.clear();
        alert("Hisob o'chirildi. Sahifa yangilanadi.");
        location.reload();
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

function setupTheme() {
    const savedTheme = localStorage.getItem('mrgram_theme') || 'dark';
    const radios = document.querySelectorAll('input[name="theme"]');
    radios.forEach(radio => {
        if (radio.value === savedTheme) radio.checked = true;
        radio.onchange = () => {
            if (radio.checked) {
                localStorage.setItem('mrgram_theme', radio.value);
                applyTheme(radio.value);
            }
        };
    });
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.style.setProperty('--bg', isDark ? '#0a0a0a' : '#f5f5f5');
        document.documentElement.style.setProperty('--text', isDark ? '#fff' : '#000');
    } else if (theme === 'dark') {
        document.documentElement.style.setProperty('--bg', '#0a0a0a');
        document.documentElement.style.setProperty('--text', '#fff');
    } else {
        document.documentElement.style.setProperty('--bg', '#f5f5f5');
        document.documentElement.style.setProperty('--text', '#000');
    }
}

function setupNotifications() {
    const statusSpan = document.getElementById('notificationStatus');
    if (!statusSpan) return;
    if (Notification.permission === 'granted') {
        statusSpan.innerHTML = '✅ Yoqilgan';
        statusSpan.style.color = '#28a745';
    } else if (Notification.permission === 'denied') {
        statusSpan.innerHTML = '❌ Bloklangan';
        statusSpan.style.color = '#ff3b30';
    } else {
        statusSpan.innerHTML = '⏳ Ruxsat so\'ralmagan';
        statusSpan.style.color = '#ffc107';
    }
}

function setupChatSettings() {
    const bgSelect = document.getElementById('chatBgColor');
    const fontSizeSelect = document.getElementById('chatFontSize');
    if (bgSelect) {
        bgSelect.value = localStorage.getItem('chat_bg') || 'dark';
        bgSelect.onchange = (e) => {
            localStorage.setItem('chat_bg', e.target.value);
            applyChatBg(e.target.value);
        };
    }
    if (fontSizeSelect) {
        fontSizeSelect.value = localStorage.getItem('chat_font_size') || 'medium';
        fontSizeSelect.onchange = (e) => {
            localStorage.setItem('chat_font_size', e.target.value);
            applyChatFontSize(e.target.value);
        };
    }
    applyChatBg(localStorage.getItem('chat_bg') || 'dark');
    applyChatFontSize(localStorage.getItem('chat_font_size') || 'medium');
}

function applyChatBg(value) {
    const chatMsgs = document.getElementById('chatMsgs');
    if (!chatMsgs) return;
    if (value === 'dark') chatMsgs.style.background = '#000';
    else if (value === 'light') chatMsgs.style.background = '#e5e5e5';
    else chatMsgs.style.background = 'linear-gradient(135deg, #1a1a2e, #16213e)';
}

function applyChatFontSize(value) {
    const chatMsgs = document.getElementById('chatMsgs');
    if (!chatMsgs) return;
    if (value === 'small') chatMsgs.style.fontSize = '12px';
    else if (value === 'medium') chatMsgs.style.fontSize = '14px';
    else chatMsgs.style.fontSize = '16px';
}

function setupVoiceSettings() {
    const ringtoneSelect = document.getElementById('ringtoneSelect');
    if (ringtoneSelect) {
        ringtoneSelect.value = localStorage.getItem('ringtone') || 'default';
        ringtoneSelect.onchange = (e) => {
            localStorage.setItem('ringtone', e.target.value);
        };
    }
}

function setupDataHandlers() {
    // Functions already defined above
}

function setupAbout() {
    const versionDiv = document.getElementById('appVersion');
    const authorDiv = document.getElementById('appAuthor');
    const techDiv = document.getElementById('appTech');
    const extraDiv = document.getElementById('appExtra');
    
    if (versionDiv) versionDiv.innerHTML = `<strong>MR GRAM</strong><br>Versiya: 2.0.0<br>Build: 2026.04.10<br>Litsenziya: MIT`;
    if (authorDiv) authorDiv.innerHTML = `<strong>👨‍💻 Muallif</strong><br>GitHub: <a href="https://github.com/MR07110" target="_blank">@MR07110</a>`;
    if (techDiv) techDiv.innerHTML = `<strong>🛠 Texnologiyalar</strong><br>🔥 Firebase Firestore<br>⚡ WebRTC<br>🎨 HTML5 / CSS3 / JS (ES6)`;
    if (extraDiv) extraDiv.innerHTML = `<strong>📱 Qo'llab-quvvatlanadi</strong><br>✅ Desktop brauzerlar<br>✅ Mobile brauzerlar`;
}

function setupVaultPanel() {
    const settingsContent = document.querySelector('.settings-content');
    if (!settingsContent || document.getElementById('settings-vault')) return;
    
    const vaultSection = document.createElement('div');
    vaultSection.id = 'settings-vault';
    vaultSection.className = 'settings-panel';
    vaultSection.innerHTML = `
        <div class="vault-panel">
            <div class="vault-panel-header">
                <span class="vault-panel-title">🔐 Maxfiy kontaktlar (Vault)</span>
            </div>
            <div id="vaultContactsList" class="vault-contacts-list"></div>
            <button id="vaultAddContactBtn" class="vault-add-btn">+ Yangi maxfiy kontakt</button>
            <button id="vaultChangePinBtn" class="vault-add-btn" style="margin-top: 8px;">🔑 PIN-kod o'zgartirish</button>
        </div>
    `;
    settingsContent.appendChild(vaultSection);
    
    const sidebar = document.querySelector('.settings-sidebar');
    if (sidebar) {
        const vaultTab = document.createElement('button');
        vaultTab.className = 'settings-tab';
        vaultTab.dataset.tab = 'vault';
        vaultTab.innerHTML = '🔐 Maxfiy (Vault)';
        sidebar.insertBefore(vaultTab, sidebar.querySelector('#closeSettingsBtn'));
        vaultTab.onclick = () => switchSettingsTab('vault');
    }
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    const targetPanel = document.getElementById(`settings-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');
    
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active');
}

// Force settings visibility - FAQAT settings ochilganda ishlaydi
let settingsForceApplied = false;

function forceSettingsVisibility() {
    const sv = document.getElementById('settingsView');
    if (sv && sv.style.display === 'flex' && !settingsForceApplied) {
        sv.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 999999 !important;
            background: var(--bg) !important;
            display: flex !important;
        `;
        settingsForceApplied = true;
        console.log('✅ Settings visibility applied');
    }
}

// Har 500ms da tekshir, faqat settings ochilganda ishlat
setInterval(() => {
    const sv = document.getElementById('settingsView');
    if (sv && sv.style.display === 'flex') {
        forceSettingsVisibility();
    }
}, 500);
// settings.js ichida
switchSettingsTab('profile'); 
console.log("✅ Profile paneli majburan yoqildi");
