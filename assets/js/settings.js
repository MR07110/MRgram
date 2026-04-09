// assets/js/settings.js

let currentUser = null;
let settingsLoaded = false;

export async function initSettings(user) {
    currentUser = user;

    // Settings HTML ni yuklash
    if (!settingsLoaded) {
        const response = await fetch('/html/settings.html');
        const html = await response.text();
        document.getElementById('settingsView').innerHTML = html;
        settingsLoaded = true;
    }

    // CSS ni yuklash (agar hali yuklanmagan bo‘lsa)
    if (!document.querySelector('link[href="assets/css/settings.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'assets/css/settings.css';
        document.head.appendChild(link);
    }

    // UI elementlarini sozlash
    attachSettingsEvents();
    loadUserData();
    setupTheme();
    setupNotifications();
    setupChatSettings();
    setupVoiceSettings();
    setupDataHandlers();
    setupAbout();

    // Settings oynasini ko‘rsatish
    document.getElementById('settingsView').style.display = 'flex';
    switchSettingsTab('profile');
}

function attachSettingsEvents() {
    // Tab tugmalari
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.dataset.tab;
            if (tabName) switchSettingsTab(tabName);
        };
    });

    // Yopish tugmasi
    const closeBtn = document.getElementById('closeSettingsBtn');
    if (closeBtn) closeBtn.onclick = () => {
        document.getElementById('settingsView').style.display = 'none';
    };

    // Profil saqlash
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) saveProfileBtn.onclick = saveProfile;

    // Avatar yuklash
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

    // Parol o‘zgartirish
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.onclick = changePassword;

    // Bildirishnomalar
    const enableNotificationsBtn = document.getElementById('enableNotifications');
    if (enableNotificationsBtn) enableNotificationsBtn.onclick = requestNotificationPermission;

    const notificationSound = document.getElementById('notificationSound');
    if (notificationSound) {
        notificationSound.checked = localStorage.getItem('notif_sound') !== 'false';
        notificationSound.onchange = (e) => {
            localStorage.setItem('notif_sound', e.target.checked);
        };
    }

    // Mikrofon ruxsati
    const enableMicBtn = document.getElementById('enableMicBtn');
    if (enableMicBtn) enableMicBtn.onclick = requestMicrophonePermission;

    // Kesh tozalash
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) clearCacheBtn.onclick = clearCache;

    // Eksport
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.onclick = exportData;

    // Hisobni o‘chirish
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) deleteAccountBtn.onclick = deleteAccount;
}

function loadUserData() {
    document.getElementById('settingsName').value = currentUser.name || '';
    document.getElementById('settingsUsername').value = currentUser.username || '';
    document.getElementById('settingsBio').value = currentUser.bio || '';
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
        // UI yangilash (agar kerak bo‘lsa)
        document.getElementById('sidebarName').innerText = currentUser.name;
        document.getElementById('meName').innerText = currentUser.name;
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
        document.getElementById('profileAvatarImg').src = url;
        document.getElementById('sidebarAvatarImg').src = url;
        alert("✅ Rasm yangilandi!");
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

async function changePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    if (!oldPass || !newPass || !confirmPass) return alert("Barcha maydonlarni to‘ldiring!");
    if (newPass !== confirmPass) return alert("Yangi parol va tasdiqlash mos emas!");
    if (newPass.length < 6) return alert("Parol kamida 6 belgi!");

    if (oldPass !== currentUser.password) return alert("Eski parol xato!");

    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(db, "users", currentUser.uid), { password: newPass });
        currentUser.password = newPass;
        localStorage.setItem('mrgram_user', JSON.stringify(currentUser));
        alert("✅ Parol o‘zgartirildi!");
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
    if (granted) {
        document.getElementById('notificationStatus').innerHTML = '✅ Yoqilgan';
        document.getElementById('notificationStatus').style.color = '#28a745';
    } else {
        document.getElementById('notificationStatus').innerHTML = '❌ Ruxsat berilmagan';
        document.getElementById('notificationStatus').style.color = '#ff3b30';
    }
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        document.getElementById('micStatus').innerHTML = '✅ Ruxsat berilgan';
        document.getElementById('micStatus').style.color = '#28a745';
    } catch (err) {
        document.getElementById('micStatus').innerHTML = '❌ Ruxsat berilmagan';
        document.getElementById('micStatus').style.color = '#ff3b30';
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
        statusSpan.innerHTML = '⏳ Ruxsat so‘ralmagan';
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
    // Mikrofon holatini tekshirish
    navigator.permissions.query({ name: 'microphone' }).then(result => {
        const micSpan = document.getElementById('micStatus');
        if (micSpan) {
            if (result.state === 'granted') {
                micSpan.innerHTML = '✅ Ruxsat berilgan';
                micSpan.style.color = '#28a745';
            } else if (result.state === 'denied') {
                micSpan.innerHTML = '❌ Ruxsat berilmagan';
                micSpan.style.color = '#ff3b30';
            } else {
                micSpan.innerHTML = '⏳ Ruxsat so‘ralmagan';
                micSpan.style.color = '#ffc107';
            }
        }
    });
}

function setupDataHandlers() {
    // Kesh tozalash
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.onclick = () => {
            localStorage.clear();
            sessionStorage.clear();
            if ('caches' in window) caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
            alert('Kesh tozalandi!');
        };
    }
    // Eksport
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.onclick = () => {
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
        };
    }
    // Hisobni o‘chirish
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (!confirm("Hisobingiz butunlay o‘chiriladi. Davom etasizmi?")) return;
            try {
                const { db } = await import("./config/firebase-config.js");
                const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                await deleteDoc(doc(db, "users", currentUser.uid));
                localStorage.clear();
                alert("Hisob o‘chirildi. Sahifa yangilanadi.");
                location.reload();
            } catch (err) {
                alert("Xatolik: " + err.message);
            }
        };
    }
}

function setupAbout() {
    document.getElementById('appVersion').innerHTML = `<strong>MR GRAM</strong><br>Versiya: 2.0.0<br>Build: 2026.04.08<br>Litsenziya: MIT`;
    document.getElementById('appAuthor').innerHTML = `<strong>👨‍💻 Muallif</strong><br>GitHub: <a href="https://github.com/MR07110" target="_blank">@MR07110</a>`;
    document.getElementById('appTech').innerHTML = `<strong>🛠 Texnologiyalar</strong><br>🔥 Firebase Firestore<br>⚡ WebRTC<br>🎨 HTML5 / CSS3 / JS (ES6)`;
    document.getElementById('appExtra').innerHTML = `<strong>📱 Qo‘llab-quvvatlanadi</strong><br>✅ Desktop brauzerlar<br>✅ Mobile brauzerlar`;
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`settings-${tabName}`).classList.add('active');
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.settings-tab[data-tab="${tabName}"]`).classList.add('active');
}