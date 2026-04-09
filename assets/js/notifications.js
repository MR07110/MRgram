// assets/app/notifications.js

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { db } from "./config/firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ========== YANGI VAPID KEY ==========
const VAPID_KEY = "BKL7e4Gw0JXLezM2vReIGVXByOLteZS1btgUxk9r6WQdwpDE6yJUQLwJTvl0FssV2q112KJVDyPjGA4dn_ZnJZs";

let messaging = null;
let currentUser = null;

// ========== RUXSAT SO'RASH ==========
export async function requestNotificationPermission(user) {
  currentUser = user;
  
  if (!('Notification' in window)) {
    console.log("❌ Brauzer notification qo'llab-quvvatlamaydi");
    return false;
  }
  
  // Service Worker tayyor bo'lishini kutish
  try {
    await navigator.serviceWorker.ready;
    console.log("✅ Service Worker ready");
  } catch (err) {
    console.error("❌ Service Worker error:", err);
    return false;
  }
  
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    console.log("✅ Notification ruxsati berildi");
    const token = await getFCMToken();
    if (token) {
      console.log("✅ FCM Token olingan!");
      return true;
    } else {
      console.log("⚠️ FCM Token olinmadi");
      return false;
    }
  } else {
    console.log("❌ Notification ruxsati rad etildi");
    return false;
  }
}

// ========== FCM TOKEN OLISH ==========
async function getFCMToken() {
  try {
    const swReg = await navigator.serviceWorker.ready;
    messaging = getMessaging();
    
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });
    
    if (token) {
      console.log("✅ FCM Token:", token.substring(0, 50) + "...");
      
      // Tokenni Firestore ga saqlash
      await setDoc(doc(db, "users", currentUser.uid, "fcm", "token"), {
        token: token,
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
      
      return token;
    }
  } catch (err) {
    console.error("❌ Token olish xatosi:", err.message);
  }
  return null;
}

// ========== XABAR KELGANDA (APP OCHIQ) ==========
export function listenForMessages() {
  try {
    messaging = getMessaging();
    
    onMessage(messaging, (payload) => {
      console.log("📨 Xabar keldi:", payload);
      
      const title = payload.notification?.title || "MR GRAM";
      const body = payload.notification?.body || "Yangi xabar";
      
      showBeautifulNotification(title, body);
    });
  } catch (err) {
    console.error("❌ Messaging error:", err);
  }
}

// ========== CHIROYLI NOTIFICATION KO'RSATISH ==========
function showBeautifulNotification(title, body) {
  // 1. Ovoz o'ynatish
  const audio = new Audio('/assets/sounds/notification.mp3');
  audio.play().catch(e => console.log('Audio play failed'));
  
  // 2. Toast xabar (sayt ichida)
  let toast = document.getElementById('mrgram-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mrgram-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e1e2e;
      border-radius: 16px;
      padding: 16px;
      z-index: 100000;
      border-left: 4px solid #2a9d8f;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease;
      max-width: 320px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(toast);
  }
  
  toast.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center;">
      <img src="/svg-icons/messenger.svg" width="40" height="40" style="border-radius: 50%;">
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 13px; color: #a8a8a8;">${body}</div>
        <div style="font-size: 11px; color: #6c6c6c; margin-top: 4px;">${new Date().toLocaleTimeString()}</div>
      </div>
      <button id="toast-close" style="background: none; border: none; color: #a8a8a8; cursor: pointer; font-size: 16px;">✕</button>
    </div>
  `;
  
  toast.style.display = 'block';
  
  // Close button
  const closeBtn = toast.querySelector('#toast-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      toast.style.display = 'none';
    };
  }
  
  // 3 soniyadan keyin avtomatik yopish
  setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 5000);
  
  // Toastga bosilganda saytni fokuslash
  toast.onclick = (e) => {
    if (e.target.id !== 'toast-close') {
      window.focus();
      toast.style.display = 'none';
    }
  };
}

// ========== TOKENNI YANGILASH ==========
export async function refreshToken() {
  if (!currentUser) return null;
  return await getFCMToken();
}

// ========== RUXSAT HOLATINI TEKSHIRISH ==========
export function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
