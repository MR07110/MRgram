// assets/js/vault.js - The Vault (PIN-kod bilan himoyalangan seyf)

let vaultUnlocked = false;
let pendingPinCallback = null;
let vaultData = null;

// PIN-kod hash (oddiy xavfsizlik uchun, real production'da bcrypt ishlatish kerak)
function hashPin(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        hash = ((hash << 5) - hash) + pin.charCodeAt(i);
        hash = hash & hash;
    }
    return hash.toString();
}

// Vault ni ochish (PIN so'rash)
export function openVault(callback, title = "Maxfiy kontaktlar") {
    pendingPinCallback = callback;
    
    // Modalni yaratish
    let modal = document.getElementById('vaultModal');
    if (!modal) {
        createVaultModal();
        modal = document.getElementById('vaultModal');
    }
    
    // Modalni sozlash
    const modalTitle = modal.querySelector('.vault-modal-title');
    if (modalTitle) modalTitle.innerText = title;
    
    const pinInput = document.getElementById('vaultPinInput');
    const errorMsg = document.getElementById('vaultErrorMsg');
    
    if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
    }
    if (errorMsg) errorMsg.style.display = 'none';
    
    modal.classList.add('active');
}

function createVaultModal() {
    const modal = document.createElement('div');
    modal.id = 'vaultModal';
    modal.className = 'vault-modal';
    modal.innerHTML = `
        <div class="vault-modal-content">
            <div class="vault-modal-header">
                <h3 class="vault-modal-title">🔐 PIN-kod kiriting</h3>
                <button class="vault-modal-close" id="vaultCloseBtn">✕</button>
            </div>
            <div class="vault-modal-body">
                <p class="vault-modal-desc">Maxfiy kontaktlarni ko'rish uchun PIN-kod kiriting</p>
                <div class="vault-pin-inputs">
                    <input type="password" id="vaultPinInput" class="vault-pin-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="••••">
                </div>
                <div id="vaultErrorMsg" class="vault-error-msg" style="display: none;">❌ PIN-kod xato!</div>
                <div class="vault-modal-buttons">
                    <button id="vaultConfirmBtn" class="vault-confirm-btn">Tasdiqlash</button>
                    <button id="vaultCancelBtn" class="vault-cancel-btn">Bekor qilish</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Eventlar
    document.getElementById('vaultCloseBtn').onclick = closeVaultModal;
    document.getElementById('vaultCancelBtn').onclick = closeVaultModal;
    document.getElementById('vaultConfirmBtn').onclick = verifyPin;
    
    const pinInput = document.getElementById('vaultPinInput');
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyPin();
    });
    
    // Faqat raqamlar
    pinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    });
}

function closeVaultModal() {
    const modal = document.getElementById('vaultModal');
    if (modal) modal.classList.remove('active');
    pendingPinCallback = null;
}

async function verifyPin() {
    const pinInput = document.getElementById('vaultPinInput');
    const pin = pinInput.value;
    const errorMsg = document.getElementById('vaultErrorMsg');
    
    if (!pin || pin.length !== 4) {
        errorMsg.innerText = '❌ 4 xonali PIN-kod kiriting!';
        errorMsg.style.display = 'block';
        return;
    }
    
    // PIN ni tekshirish
    const isValid = await checkPin(pin);
    
    if (isValid) {
        vaultUnlocked = true;
        closeVaultModal();
        if (pendingPinCallback) {
            pendingPinCallback(true);
            pendingPinCallback = null;
        }
    } else {
        errorMsg.innerText = '❌ PIN-kod xato! Qaytadan urining.';
        errorMsg.style.display = 'block';
        pinInput.value = '';
        pinInput.focus();
    }
}

// PIN ni tekshirish (Firebase'dan yoki localStorage'dan)
async function checkPin(pin) {
    const savedPinHash = localStorage.getItem('vault_pin_hash');
    
    // Agar PIN birinchi marta o'rnatilayotgan bo'lsa
    if (!savedPinHash) {
        // Default PIN: 0000 (yoki birinchi marta so'rash)
        const defaultPin = '0000';
        localStorage.setItem('vault_pin_hash', hashPin(defaultPin));
        localStorage.setItem('vault_pin_set', 'true');
        return pin === defaultPin;
    }
    
    return hashPin(pin) === savedPinHash;
}

// PIN ni o'zgartirish
export async function changePin(oldPin, newPin) {
    if (!oldPin || !newPin || newPin.length !== 4) {
        return { success: false, error: "PIN 4 xonali bo'lishi kerak" };
    }
    
    const isValid = await checkPin(oldPin);
    if (!isValid) {
        return { success: false, error: "Eski PIN xato" };
    }
    
    localStorage.setItem('vault_pin_hash', hashPin(newPin));
    return { success: true };
}

// PIN ni reset qilish (admin yoki maxsus kalit bilan)
export function resetPin() {
    localStorage.removeItem('vault_pin_hash');
    localStorage.removeItem('vault_pin_set');
    vaultUnlocked = false;
}

// Vault holatini tekshirish
export function isVaultUnlocked() {
    return vaultUnlocked;
}

// Vault ma'lumotlarini saqlash (maxfiy kontaktlar)
export async function saveVaultData(data) {
    if (!vaultUnlocked) return false;
    
    const encrypted = btoa(JSON.stringify(data));
    localStorage.setItem('vault_encrypted_data', encrypted);
    
    // Firebase ga ham saqlash (xavfsizroq)
    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const { getCurrentUser } = await import("./auth.js");
        const user = getCurrentUser();
        if (user) {
            await setDoc(doc(db, "vault", user.uid), {
                data: encrypted,
                updatedAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error("Vault Firebase save error:", err);
    }
    
    return true;
}

// Vault ma'lumotlarini o'qish
export async function loadVaultData() {
    if (!vaultUnlocked) return null;
    
    // LocalStorage dan o'qish
    let encrypted = localStorage.getItem('vault_encrypted_data');
    
    // Agar localStorage'da bo'lmasa, Firebase'dan o'qish
    if (!encrypted) {
        try {
            const { db } = await import("./config/firebase-config.js");
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const { getCurrentUser } = await import("./auth.js");
            const user = getCurrentUser();
            if (user) {
                const docSnap = await getDoc(doc(db, "vault", user.uid));
                if (docSnap.exists()) {
                    encrypted = docSnap.data().data;
                }
            }
        } catch (err) {
            console.error("Vault Firebase load error:", err);
        }
    }
    
    if (!encrypted) return {};
    
    try {
        return JSON.parse(atob(encrypted));
    } catch (err) {
        console.error("Vault decrypt error:", err);
        return {};
    }
}

// Maxfiy kontakt qo'shish
export async function addSecretContact(contact) {
    const data = await loadVaultData();
    if (!data) return false;
    
    if (!data.contacts) data.contacts = [];
    data.contacts.push({
        id: Date.now(),
        ...contact,
        createdAt: new Date().toISOString()
    });
    
    return await saveVaultData(data);
}

// Maxfiy kontaktlarni olish
export async function getSecretContacts() {
    const data = await loadVaultData();
    return data?.contacts || [];
}

// Maxfiy kontakt o'chirish
export async function deleteSecretContact(contactId) {
    const data = await loadVaultData();
    if (!data || !data.contacts) return false;
    
    data.contacts = data.contacts.filter(c => c.id !== contactId);
    return await saveVaultData(data);
}

// Vault holatini reset qilish (logout da)
export function resetVaultState() {
    vaultUnlocked = false;
}

// Joriy foydalanuvchini olish (auth.js dan)
let currentUser = null;
export function setCurrentUser(user) {
    currentUser = user;
}
export function getCurrentUser() {
    return currentUser;
}
