// assets/js/settings.js (faqat vault qismi)

import { openVault, getSecretContacts, addSecretContact, deleteSecretContact, changePin, isVaultUnlocked } from "./vault.js";

let currentUser = null;
let settingsLoaded = false;

export async function initSettings(user) {
    currentUser = user;

    if (!settingsLoaded) {
        const response = await fetch('/html/settings.html');
        const html = await response.text();
        document.getElementById('settingsView').innerHTML = html;
        settingsLoaded = true;
    }

    if (!document.querySelector('link[href="assets/css/settings.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'assets/css/settings.css';
        document.head.appendChild(link);
    }
    
    // Vault CSS ni qo'shish
    if (!document.querySelector('link[href="assets/css/vault.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'assets/css/vault.css';
        document.head.appendChild(link);
    }

    attachSettingsEvents();
    loadUserData();
    setupTheme();
    setupNotifications();
    setupChatSettings();
    setupVoiceSettings();
    setupDataHandlers();
    setupAbout();
    setupVaultPanel(); // YANGI: Vault panel

    document.getElementById('settingsView').style.display = 'flex';
    switchSettingsTab('profile');
}

// ========== VAULT PANEL ==========
async function setupVaultPanel() {
    // Settings html ga vault panel qo'shish
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent && !document.getElementById('settings-vault')) {
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
                <button id="vaultChangePinBtn" class="vault-add-btn" style="margin-top: 8px; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">🔑 PIN-kod o'zgartirish</button>
            </div>
        `;
        settingsContent.appendChild(vaultSection);
        
        // Tab qo'shish
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
    
    // Vault tugmalariga event
    document.getElementById('vaultAddContactBtn')?.addEventListener('click', () => {
        openVault(async (unlocked) => {
            if (unlocked) {
                showAddSecretContactModal();
            }
        }, "Maxfiy kontakt qo'shish");
    });
    
    document.getElementById('vaultChangePinBtn')?.addEventListener('click', () => {
        openVault(async (unlocked) => {
            if (unlocked) {
                showChangePinModal();
            }
        }, "PIN-kod o'zgartirish");
    });
    
    // Vault kontaktlarini yuklash
    await loadVaultContacts();
}

async function loadVaultContacts() {
    const container = document.getElementById('vaultContactsList');
    if (!container) return;
    
    const contacts = await getSecretContacts();
    
    if (contacts.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.5;">Hozircha maxfiy kontaktlar yo\'q</div>';
        return;
    }
    
    container.innerHTML = contacts.map(contact => `
        <div class="vault-contact-item" data-id="${contact.id}">
            <div class="vault-contact-info">
                <div class="vault-contact-name">${escapeHtml(contact.name)}</div>
                <div class="vault-contact-id">#${contact.stealthId || contact.id}</div>
            </div>
            <button class="vault-contact-delete" data-id="${contact.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>
            </button>
        </div>
    `).join('');
    
    document.querySelectorAll('.vault-contact-delete').forEach(btn => {
        btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            if (confirm("Kontaktni o'chirilsinmi?")) {
                await deleteSecretContact(id);
                await loadVaultContacts();
            }
        };
    });
}

function showAddSecretContactModal() {
    const name = prompt("Kontakt ismi:");
    if (!name) return;
    
    const stealthId = prompt("Maxfiy ID (4 xonali raqam):");
    if (!stealthId || !/^\d{4}$/.test(stealthId)) {
        alert("4 xonali raqam kiriting!");
        return;
    }
    
    addSecretContact({ name, stealthId });
    loadVaultContacts();
}

function showChangePinModal() {
    // Vault PIN o'zgartirish modalini ko'rsatish
    // (yuqoridagi vault-modal.html dan foydalaning)
    alert("PIN o'zgartirish modal (implement qilinadi)");
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ... qolgan settings funksiyalari (attachSettingsEvents, loadUserData, etc.)
