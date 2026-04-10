// assets/js/app.js
import { requestNotificationPermission, listenForMessages } from "./notifications.js";
import { db } from "./config/firebase-config.js";
import { initAuth, logout } from "./auth.js";
import { initTabs, renderList, addToContacts } from "./tabs.js";
import { initChat, openChat } from "./chat.js";
import { initMediaPreviews, setVoicePreviewFromBlob } from "./media-preview.js";
import { initVoice, stopAllVoice } from "./voice.js";
import { uploadAudio, uploadAvatar } from "./upload-file.js";
import { setUserOnline, setUserOffline } from "./user-status.js";
import { showToast } from "./ui-helpers.js";
import { createGroup, loadUserGroups } from "./group.js";
import { createChannel, loadUserChannels } from "./channel.js";
import { initSettings } from "./settings.js";
import { 
    collection, query, where, getDocs, doc, getDoc, 
    setDoc, updateDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let me = null;
let pendingAvatarFile = null;
let allUsersForSearch = [];
let currentTab = 'chats';

// HTML fayllarni yuklash
async function loadHTMLFiles() {
    const appRoot = document.getElementById('appRoot');
    if (!appRoot) {
        console.error("appRoot topilmadi");
        return;
    }
    
    const files = [
        'layout', 'auth', 'chat', 'call', 'modals', 'search', 'settings'
    ];
    
    for (const file of files) {
        try {
            const response = await fetch(`html/${file}.html`);
            if (response.ok) {
                const html = await response.text();
                appRoot.insertAdjacentHTML('beforeend', html);
                console.log(`✅ ${file}.html yuklandi`);
            } else {
                console.log(`⚠️ ${file}.html topilmadi (${response.status})`);
            }
        } catch (err) {
            console.log(`⚠️ ${file}.html yuklanmadi:`, err.message);
        }
    }
}

window.onload = async () => {
    // HTML fayllarni yuklash
    await loadHTMLFiles();
    
    const saved = localStorage.getItem('mrgram_user');
    if(!saved) {
        const splash = document.getElementById('splash');
        if(splash) splash.style.display = 'none';
        const authPage = document.getElementById('authPage');
        if(authPage) authPage.style.display = 'flex';
        initAuth((user) => { me = user; startApp(); });
    } else {
        me = JSON.parse(saved);
        startApp();
    }
};

function startApp() {
    const authPage = document.getElementById('authPage');
    if(authPage) authPage.style.display = 'none';
    
    const mainApp = document.getElementById('mainApp');
    if(mainApp) mainApp.style.display = 'flex';
    
    // Yashirin elementlarni to'ldirish (agar mavjud bo'lsa)
    const meNameEl = document.getElementById('meName');
    const meUserEl = document.getElementById('meUser');
    if (meNameEl) meNameEl.innerText = me.name;
    if (meUserEl) meUserEl.innerHTML = '@' + me.username;
    
    updateProfileAvatarDisplay(me.photoURL);
    updateSidebarInfo();
    
    const newNameInput = document.getElementById('newName');
    if (newNameInput) newNameInput.value = me.name || '';
    
    setUserOnline(me.uid);
    
    window.addEventListener('beforeunload', () => {
        setUserOffline(me.uid);
    });
    
    initTabs(me, db);
    initChat(me, db);
    initMediaPreviews();
    
    // ========== MENU & SIDEBAR ==========
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (menuBtn && sidebar && sidebarOverlay) {
        menuBtn.onclick = () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        };
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.onclick = () => {
            if (sidebar) sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        };
    }
    
    const sidebarSettings = document.getElementById('sidebarSettings');
    if (sidebarSettings) sidebarSettings.onclick = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        openSettings();
    };

    const sidebarLogout = document.getElementById('sidebarLogout');
    if (sidebarLogout) sidebarLogout.onclick = () => {
        setUserOffline(me.uid);
        logout();
    };
    
    const sidebarGroups = document.getElementById('sidebarGroups');
    if (sidebarGroups) sidebarGroups.onclick = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        switchTab('groups');
    };
    
    const sidebarChannels = document.getElementById('sidebarChannels');
    if (sidebarChannels) sidebarChannels.onclick = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        switchTab('channels');
    };
    
    // ========== TABS ==========
    const tabChats = document.getElementById('tabChats');
    const tabGroups = document.getElementById('tabGroups');
    const tabChannels = document.getElementById('tabChannels');
    const indicator = document.getElementById('indicator');
    const listArea = document.getElementById('listArea');
    const groupsList = document.getElementById('groupsList');
    const channelsList = document.getElementById('channelsList');
    
    function switchTab(tab) {
        currentTab = tab;
        
        if (tabChats) tabChats.classList.toggle('active', tab === 'chats');
        if (tabGroups) tabGroups.classList.toggle('active', tab === 'groups');
        if (tabChannels) tabChannels.classList.toggle('active', tab === 'channels');
        
        if (indicator) {
            let position = 0;
            if (tab === 'chats') position = 0;
            else if (tab === 'groups') position = 33.33;
            else position = 66.66;
            indicator.style.left = position + '%';
        }
        
        if (listArea) listArea.style.display = tab === 'chats' ? 'block' : 'none';
        if (groupsList) groupsList.style.display = tab === 'groups' ? 'block' : 'none';
        if (channelsList) channelsList.style.display = tab === 'channels' ? 'block' : 'none';
        
        if (tab === 'groups') {
            loadUserGroups(me.uid, (group) => openChat(group, 'group', group.id));
        }
        if (tab === 'channels') {
            loadUserChannels(me.uid, (channel) => openChat(channel, 'channel', channel.id));
        }
    }
    
    if (tabChats) tabChats.onclick = () => switchTab('chats');
    if (tabGroups) tabGroups.onclick = () => switchTab('groups');
    if (tabChannels) tabChannels.onclick = () => switchTab('channels');
    
    // ========== FAB MENU ==========
    const mainFab = document.getElementById('mainFab');
    const fabMenu = document.getElementById('fabMenu');
    let fabOpen = false;
    
    if (mainFab && fabMenu) {
        mainFab.onclick = () => {
            fabOpen = !fabOpen;
            fabMenu.classList.toggle('open', fabOpen);
        };
        
        document.addEventListener('click', (e) => {
            if (fabOpen && !mainFab.contains(e.target) && !fabMenu.contains(e.target)) {
                fabOpen = false;
                fabMenu.classList.remove('open');
            }
        });
    }
    
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) newChatBtn.onclick = () => {
        fabOpen = false;
        fabMenu.classList.remove('open');
        openAddContactModal();
    };
    
    const newGroupBtn = document.getElementById('newGroupBtn');
    if (newGroupBtn) newGroupBtn.onclick = () => {
        fabOpen = false;
        fabMenu.classList.remove('open');
        openCreateGroupModal();
    };
    
    const newChannelBtn = document.getElementById('newChannelBtn');
    if (newChannelBtn) newChannelBtn.onclick = () => {
        fabOpen = false;
        fabMenu.classList.remove('open');
        openCreateChannelModal();
    };
    
    // ========== GROUP & CHANNEL MODALS ==========
    const createGroupModal = document.getElementById('createGroupModal');
    const createChannelModal = document.getElementById('createChannelModal');
    
    window.openCreateGroupModal = () => {
        if (createGroupModal) createGroupModal.classList.add('active');
        const groupNameInput = document.getElementById('groupName');
        const groupDescInput = document.getElementById('groupDescription');
        if (groupNameInput) groupNameInput.value = '';
        if (groupDescInput) groupDescInput.value = '';
    };
    
    window.openCreateChannelModal = () => {
        if (createChannelModal) createChannelModal.classList.add('active');
        const channelNameInput = document.getElementById('channelName');
        const channelDescInput = document.getElementById('channelDescription');
        if (channelNameInput) channelNameInput.value = '';
        if (channelDescInput) channelDescInput.value = '';
    };
    
    const confirmCreateGroupBtn = document.getElementById('confirmCreateGroupBtn');
    if (confirmCreateGroupBtn) {
        confirmCreateGroupBtn.onclick = async () => {
            const groupName = document.getElementById('groupName')?.value.trim();
            const groupDesc = document.getElementById('groupDescription')?.value.trim();
            if (!groupName) {
                showToast("Guruh nomini kiriting");
                return;
            }
            const groupId = await createGroup(me.uid, groupName, groupDesc);
            if (groupId) {
                if (createGroupModal) createGroupModal.classList.remove('active');
                switchTab('groups');
                loadUserGroups(me.uid, (group) => openChat(group, 'group', group.id));
            }
        };
    }
    
    const cancelCreateGroupBtn = document.getElementById('cancelCreateGroupBtn');
    if (cancelCreateGroupBtn) {
        cancelCreateGroupBtn.onclick = () => {
            if (createGroupModal) createGroupModal.classList.remove('active');
        };
    }
    
    const confirmCreateChannelBtn = document.getElementById('confirmCreateChannelBtn');
    if (confirmCreateChannelBtn) {
        confirmCreateChannelBtn.onclick = async () => {
            const channelName = document.getElementById('channelName')?.value.trim();
            const channelDesc = document.getElementById('channelDescription')?.value.trim();
            if (!channelName) {
                showToast("Kanal nomini kiriting");
                return;
            }
            const channelId = await createChannel(me.uid, channelName, channelDesc);
            if (channelId) {
                if (createChannelModal) createChannelModal.classList.remove('active');
                switchTab('channels');
                loadUserChannels(me.uid, (channel) => openChat(channel, 'channel', channel.id));
            }
        };
    }
    
    const cancelCreateChannelBtn = document.getElementById('cancelCreateChannelBtn');
    if (cancelCreateChannelBtn) {
        cancelCreateChannelBtn.onclick = () => {
            if (createChannelModal) createChannelModal.classList.remove('active');
        };
    }
    
    // ========== SEARCH PAGE ==========
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.onclick = openSearchPage;

    const searchCloseBtn = document.getElementById('searchCloseBtn');
    if (searchCloseBtn) searchCloseBtn.onclick = closeSearchPage;

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.oninput = (e) => debounceSearch(e.target.value);
    
    // ========== VOICE MESSAGE ==========
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        initVoice(voiceBtn, async (audioBlob) => {
            try {
                const url = await uploadAudio(audioBlob);
                if (url) setVoicePreviewFromBlob(audioBlob, url);
            } catch (err) {
                console.error("Ovoz yuklash xatosi:", err);
            }
        });
    }
    
    // ========== SETTINGS ==========
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.onclick = openSettings;

    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    if (() => console.log("Settings close disabled")Btn) closeSettingsBtn.onclick = closeSettings;

    // Notification ruxsat so'rash
    setTimeout(async () => {
        const granted = await requestNotificationPermission(me);
        if (granted) {
            listenForMessages();
        }
    }, 3000);
    
    // Splash ekranni yashirish
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 800);
}

// ========== SEARCH PAGE FUNKSIYALARI ==========

async function loadAllUsersForSearch() {
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);
    allUsersForSearch = [];
    querySnapshot.forEach(doc => {
        const user = doc.data();
        if (user.uid !== me.uid) allUsersForSearch.push(user);
    });
}

function openSearchPage() {
    const mainApp = document.getElementById('mainApp');
    const searchPage = document.getElementById('searchPage');
    if (mainApp) mainApp.style.display = 'none';
    if (searchPage) searchPage.style.display = 'flex';
    loadAllUsersForSearch();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    renderSearchResults('');
}

function closeSearchPage() {
    const mainApp = document.getElementById('mainApp');
    const searchPage = document.getElementById('searchPage');
    if (mainApp) mainApp.style.display = 'flex';
    if (searchPage) searchPage.style.display = 'none';
}

async function isContactForSearch(targetUid) {
    const contactRef = doc(db, "users", me.uid, "contacts", "list");
    const snap = await getDoc(contactRef);
    if (snap.exists()) {
        const contacts = snap.data().uids || [];
        return contacts.includes(targetUid);
    }
    return false;
}

async function addToContactsFromSearch(targetUid, buttonElement) {
    const contactRef = doc(db, "users", me.uid, "contacts", "list");
    const snap = await getDoc(contactRef);
    
    try {
        if (snap.exists()) {
            const current = snap.data().uids || [];
            if (!current.includes(targetUid)) {
                await updateDoc(contactRef, { uids: arrayUnion(targetUid) });
                showToast("Kontaktga qo'shildi");
            } else {
                showToast("Bu foydalanuvchi allaqachon kontaktlarda");
                return;
            }
        } else {
            await setDoc(contactRef, { uids: [targetUid] });
            showToast("Kontaktga qo'shildi");
        }
        
        if (buttonElement) {
            buttonElement.innerHTML = '✓ Qo\'shilgan';
            buttonElement.disabled = true;
            buttonElement.style.opacity = '0.6';
        }
        renderList();
    } catch (err) {
        showToast("Xatolik yuz berdi");
    }
}

function renderSearchResults(keyword) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    if (!keyword || keyword.trim() === '') {
        searchResults.innerHTML = '<div class="search-hint">🔍 Foydalanuvchi qidirish</div>';
        return;
    }
    
    const lowerKeyword = keyword.toLowerCase();
    const filtered = allUsersForSearch.filter(user => 
        user.name?.toLowerCase().includes(lowerKeyword) || 
        user.username?.toLowerCase().includes(lowerKeyword)
    );
    
    if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">❌ Foydalanuvchi topilmadi</div>';
        return;
    }
    
    let html = '';
    filtered.forEach(user => {
        const avatarHtml = user.photoURL 
            ? `<img src="${user.photoURL}" class="search-avatar-img" onerror="this.style.display='none';">` 
            : `<span class="search-avatar-initial">${(user.name || 'U')[0].toUpperCase()}</span>`;
        
        html += `
            <div class="search-user-card">
                <div class="search-avatar" style="background:${user.color || '#2c2c2e'}">${avatarHtml}</div>
                <div class="search-user-info">
                    <div class="search-user-name">${user.name || user.username}</div>
                    <div class="search-user-username">@${user.username}</div>
                </div>
                <button class="search-add-btn" data-uid="${user.uid}">
                    + Qo'shish
                </button>
            </div>`;
    });
    
    searchResults.innerHTML = html;
    
    document.querySelectorAll('.search-add-btn').forEach(btn => {
        btn.onclick = async () => {
            const isAlready = await isContactForSearch(btn.dataset.uid);
            if (isAlready) {
                showToast("Bu foydalanuvchi allaqachon kontaktlarda");
            } else {
                await addToContactsFromSearch(btn.dataset.uid, btn);
            }
        };
    });
}

let debounceTimer;
function debounceSearch(value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderSearchResults(value), 300);
}

function openAddContactModal() {
    const modal = document.getElementById('addContactModal');
    if (modal) modal.classList.add('active');
    const searchUsername = document.getElementById('searchUsername');
    if (searchUsername) searchUsername.value = '';
    const searchResult = document.getElementById('searchResult');
    if (searchResult) searchResult.style.display = 'none';
}

function closeAddContactModal() {
    const modal = document.getElementById('addContactModal');
    if (modal) modal.classList.remove('active');
}

function updateSidebarInfo() {
    const sName = document.getElementById('sidebarName');
    const sUser = document.getElementById('sidebarUsername');
    const sImg = document.getElementById('sidebarAvatarImg');
    
    if (sName) sName.innerText = me.name;
    if (sUser) sUser.innerText = '@' + me.username;
    
    if (sImg) {
        if (me.photoURL) {
            sImg.src = me.photoURL;
        } else {
            sImg.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233a3a3c'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E`;
        }
        sImg.style.width = '100%';
        sImg.style.height = '100%';
        sImg.style.objectFit = 'cover';
        sImg.style.borderRadius = '50%';
    }
}

function updateProfileAvatarDisplay(url) {
    const pImg = document.getElementById('profileAvatarImg');
    const sImg = document.getElementById('sidebarAvatarImg');
    const defaultSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233a3a3c'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E`;
    
    if (pImg) {
        pImg.src = url || defaultSvg;
        pImg.style.width = '100%';
        pImg.style.height = '100%';
        pImg.style.objectFit = 'cover';
        pImg.style.borderRadius = '50%';
    }
    
    if (sImg) {
        sImg.src = url || defaultSvg;
        sImg.style.width = '100%';
        sImg.style.height = '100%';
        sImg.style.objectFit = 'cover';
        sImg.style.borderRadius = '50%';
    }
}

function openSettings() { 
    const settingsView = document.getElementById('settingsView');
    if (settingsView) settingsView.style.display = 'flex';
    if (typeof initSettings === 'function') {
        initSettings(me);
    }
}

//function closeSettings() { 
//    const settingsView = document.getElementById('settingsView');
//    if (settingsView) settingsView.style.display = 'none'; 
//}
