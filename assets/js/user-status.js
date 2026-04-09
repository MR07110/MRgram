// assets/status/user-status.js

import { rtdb } from "./config/firebase-config.js";
import { ref, set, onDisconnect, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let currentUserId = null;
let statusListener = null;
let allUsersListener = null;

export function setUserOnline(userId) {
    if (!userId) return;
    currentUserId = userId;
    const userStatusRef = ref(rtdb, `status/${userId}`);
    
    set(userStatusRef, {
        state: "online",
        lastSeen: serverTimestamp()
    });
    
    onDisconnect(userStatusRef).set({
        state: "offline",
        lastSeen: serverTimestamp()
    });
}

export function setUserOffline(userId) {
    if (!userId) return;
    const userStatusRef = ref(rtdb, `status/${userId}`);
    set(userStatusRef, {
        state: "offline",
        lastSeen: serverTimestamp()
    });
}

export async function isUserOnline(userId) {
    return new Promise((resolve) => {
        const userStatusRef = ref(rtdb, `status/${userId}/state`);
        onValue(userStatusRef, (snapshot) => {
            const status = snapshot.val();
            resolve(status === "online");
        }, { onlyOnce: true });
    });
}

export function checkUserOnlineRealtime(userId, callback) {
    const userStatusRef = ref(rtdb, `status/${userId}/state`);
    return onValue(userStatusRef, (snapshot) => {
        const isOnline = snapshot.val() === "online";
        callback(isOnline);
    });
}

export function observeAllUsersStatus(callback) {
    const statusRef = ref(rtdb, `status`);
    allUsersListener = onValue(statusRef, (snapshot) => {
        const data = snapshot.val() || {};
        callback(data);
    });
    return allUsersListener;
}

export function observeUserStatus(userId, callback) {
    const userStatusRef = ref(rtdb, `status/${userId}/state`);
    statusListener = onValue(userStatusRef, (snapshot) => {
        const isOnline = snapshot.val() === "online";
        callback(isOnline);
    });
    return statusListener;
}

export function stopObserving() {
    if (statusListener) {
        statusListener();
        statusListener = null;
    }
    if (allUsersListener) {
        allUsersListener();
        allUsersListener = null;
    }
}
