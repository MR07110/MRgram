// assets/js/stealth-router.js - Infinity Hash Routing & Stealth Mode

let stealthModeActive = false;
let currentStealthChatId = null;

export function initHashRouting() {
    const checkHash = () => {
        const hash = window.location.hash.substring(1);
        
        if (hash && hash.length >= 4 && /^\d+$/.test(hash)) {
            activateStealthChat(hash);
        } else if (stealthModeActive) {
            deactivateStealthChat();
        }
    };
    
    checkHash();
    window.addEventListener('hashchange', checkHash);
}

function activateStealthChat(chatId) {
    stealthModeActive = true;
    currentStealthChatId = chatId;
    
    sessionStorage.setItem('stealth_chat_id', chatId);
    sessionStorage.setItem('stealth_mode', 'true');
    
    window.history.replaceState(null, '', window.location.pathname);
    
    applyStealthUI();
    openStealthChat(chatId);
    
    console.log('🔒 Stealth mode activated for chat:', chatId);
}

function deactivateStealthChat() {
    stealthModeActive = false;
    currentStealthChatId = null;
    
    sessionStorage.removeItem('stealth_chat_id');
    sessionStorage.removeItem('stealth_mode');
    
    removeStealthUI();
    
    console.log('🔓 Stealth mode deactivated');
}

function applyStealthUI() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainApp = document.getElementById('mainApp');
    const fabMenu = document.querySelector('.fab-container');
    
    if (sidebar) sidebar.style.display = 'none';
    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (fabMenu) fabMenu.style.display = 'none';
    
    const chatTitle = document.getElementById('chatTitle');
    const chatUsername = document.querySelector('.chat-username');
    if (chatTitle && chatTitle.dataset.originalTitle) {
        const titleText = chatTitle.innerText;
        if (titleText.includes('@')) {
            chatTitle.dataset.originalTitle = titleText;
            chatTitle.innerText = titleText.split('@')[0];
        }
    }
    if (chatUsername) chatUsername.style.display = 'none';
    
    document.body.classList.add('stealth-mode');
}

function removeStealthUI() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainApp = document.getElementById('mainApp');
    const fabMenu = document.querySelector('.fab-container');
    
    if (sidebar) sidebar.style.display = '';
    if (sidebarOverlay) sidebarOverlay.style.display = '';
    if (mainApp) mainApp.style.display = 'flex';
    if (fabMenu) fabMenu.style.display = '';
    
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle && chatTitle.dataset.originalTitle) {
        chatTitle.innerText = chatTitle.dataset.originalTitle;
        delete chatTitle.dataset.originalTitle;
    }
    
    document.body.classList.remove('stealth-mode');
}

async function openStealthChat(chatId) {
    try {
        const { db } = await import("./config/firebase-config.js");
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const userRef = doc(db, "stealth_users", chatId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const event = new CustomEvent('openStealthChat', { 
                detail: {
                    id: chatId,
                    name: userData.name,
                    photoURL: userData.photoURL,
                    isStealth: true
                }
            });
            document.dispatchEvent(event);
        } else {
            console.error('Stealth chat not found:', chatId);
        }
    } catch (err) {
        console.error('Stealth chat error:', err);
    }
}

export function generateStealthId() {
    const baseId = Math.floor(Math.random() * 9000) + 1000;
    return baseId.toString();
}

export function isStealthModeActive() {
    return stealthModeActive || sessionStorage.getItem('stealth_mode') === 'true';
}

export function getCurrentStealthChatId() {
    return currentStealthChatId || sessionStorage.getItem('stealth_chat_id');
}
