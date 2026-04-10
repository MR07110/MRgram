// assets/js/chat.js

import { db } from "./config/firebase-config.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sendMessage, setCurrentChat, clearEditing, getPendingImage, getPendingVideo, getPendingVoice, getPendingFile, setPendingImage, setPendingVideo, setPendingVoice, setPendingFile, markMessageAsRead, getReadStatusIcon } from "./messages.js";
import { stopAllVoice, initVoice } from "./voice.js";
import { escapeHtml, viewFullImage, showToast, getAvatarColorFromUsername, getAvatarInitial } from "./ui-helpers.js";
import { startCall, acceptCall, rejectCall, listenForIncomingCalls, initCallElements, endCall } from "./call.js";
import { uploadMedia } from "./upload-file.js";
import { createPlayer, stopAllPlayers } from "./audio-voice.js";
import { isStealthModeActive, getCurrentStealthChatId, openStealthChat as stealthRouterOpen } from "./stealth-router.js";

let me = null;
let dbInstance = null;
let currentChatUser = null;
let currentChat = null;
let messagesUnsubscribe = null;
let currentChatType = "private";

let videoProgressCallback = null;
let incomingCallUnsubscribe = null;

// Typing Indicator
let typingTimeout = null;
let typingUnsubscribe = null;
let replyToMessageData = null;

export function initChat(user, database) {
    me = user;
    dbInstance = database;
    initCallElements();

    const closeBtn = document.getElementById("closeChatBtn");
    if (closeBtn) closeBtn.onclick = closeChat;

    const voiceBtn = document.getElementById("voiceBtn");
    const sendBtn = document.getElementById("sendBtn");
    const msgInput = document.getElementById("msgInput");

    createVoiceUI();

    if (voiceBtn) {
        voiceBtn.style.display = "flex";
        if (sendBtn) sendBtn.style.display = "none";
        initVoice(voiceBtn, async (audioBlob) => {
            await sendVoiceMessage(audioBlob);
        });
    }

    function toggleButtons() {
        if (!voiceBtn || !sendBtn) return;
        const hasText = msgInput && msgInput.value.trim().length > 0;
        const hasImage = getPendingImage() !== null;
        const hasVideo = getPendingVideo() !== null;
        const hasVoice = getPendingVoice() !== null;
        const hasFile = getPendingFile() !== null;
        const hasMedia = hasImage || hasVideo || hasVoice || hasFile;

        if (hasText || hasMedia) {
            voiceBtn.style.display = "none";
            sendBtn.style.display = "flex";
        } else {
            voiceBtn.style.display = "flex";
            sendBtn.style.display = "none";
        }
    }

    if (sendBtn) {
        sendBtn.onclick = async () => {
            const hasImage = getPendingImage() !== null;
            const hasVideo = getPendingVideo() !== null;
            const hasVoice = getPendingVoice() !== null;
            const hasFile = getPendingFile() !== null;

            if (hasImage || hasVideo || hasVoice || hasFile) {
                await handleMediaUpload();
            } else {
                await sendMessage(currentChat, me, (callback) => { videoProgressCallback = callback; });
            }
            setTimeout(toggleButtons, 100);
        };
    }

    if (msgInput) {
        msgInput.addEventListener("input", toggleButtons);
        msgInput.onkeypress = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (sendBtn && sendBtn.style.display === "flex") sendBtn.click();
            }
        };
    }

    setInterval(toggleButtons, 500);
    toggleButtons();

    const audioCallBtn = document.getElementById("audioCallBtn");
    const videoCallBtn = document.getElementById("videoCallBtn");

    if (audioCallBtn) {
        audioCallBtn.innerHTML = `<img src="svg-icons/phone.svg" width="24" height="24">`;
        audioCallBtn.onclick = () => {
            if (currentChatUser && currentChatType === "private") {
                startCall(currentChatUser.uid, me.uid, false);
            }
        };
    }
    if (videoCallBtn) {
        videoCallBtn.innerHTML = `<img src="svg-icons/video.svg" width="24" height="24">`;
        videoCallBtn.onclick = () => {
            if (currentChatUser && currentChatType === "private") {
                startCall(currentChatUser.uid, me.uid, true);
            }
        };
    }

    if (!window.callListenerStarted) {
        window.callListenerStarted = true;
        incomingCallUnsubscribe = listenForIncomingCalls(me.uid, (callerId, callId, isVideo) => {
            const acceptBtn = document.getElementById("acceptCallBtn");
            const rejectBtn = document.getElementById("rejectCallBtn");
            if (acceptBtn) acceptBtn.onclick = () => acceptCall(callId, me.uid);
            if (rejectBtn) rejectBtn.onclick = () => rejectCall(callId);
        });
    }

    document.addEventListener("openChat", (e) => openChat(e.detail));
    document.addEventListener("openStealthChat", (e) => openStealthChat(e.detail));
}

function createVoiceUI() {
    let recordingStatus = document.getElementById("recordingStatus");
    if (!recordingStatus) {
        recordingStatus = document.createElement("div");
        recordingStatus.id = "recordingStatus";
        recordingStatus.className = "recording-status-panel";
        recordingStatus.innerHTML = `
            <div class="recording-waveform" id="recordingWaveform"></div>
            <div class="recording-timer" id="recordingTimer">0:00</div>
            <div id="slideHint" class="slide-hint">⬅️ Bekor qilish</div>
        `;
        document.querySelector(".chat-input-area").appendChild(recordingStatus);
    }

    let lockWrapper = document.getElementById("lockWrapper");
    if (!lockWrapper) {
        lockWrapper = document.createElement("div");
        lockWrapper.id = "lockWrapper";
        lockWrapper.className = "lock-wrapper";
        lockWrapper.innerHTML = `
            <div id="lockIcon" class="lock-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9v4c0 .83.67 1.5 1.5 1.5S8 13.83 8 13V9c0-2.21 1.79-4 4-4s4 1.79 4 4v4c0 .83.67 1.5 1.5 1.5S19 13.83 19 13V9c0-3.87-3.13-7-7-7z"/>
                    <path d="M12 11c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2s2-.9 2-2v-6c0-1.1-.9-2-2-2z"/>
                </svg>
            </div>
            <span class="lock-label">Yuborish uchun qulflash</span>
        `;
        document.body.appendChild(lockWrapper);
    }
}

async function sendVoiceMessage(audioBlob) {
    try {
        const { uploadAudio } = await import("./upload-file.js");
        const url = await uploadAudio(audioBlob);
        if (url && currentChat) {
            const messageData = {
                from: me.uid,
                time: serverTimestamp(),
                voice: url,
                read: false
            };
            await addDoc(collection(dbInstance, "chats", currentChat, "messages"), messageData);
            showToast("Ovozli xabar yuborildi");
        }
    } catch (err) {
        console.error("Ovoz yuborish xatosi:", err);
        showToast("Xatolik: " + err.message);
    }
}

async function handleMediaUpload() {
    const hasImage = getPendingImage() !== null;
    const hasVideo = getPendingVideo() !== null;
    const hasVoice = getPendingVoice() !== null;
    const hasFile = getPendingFile() !== null;

    let messageData = { from: me.uid, time: serverTimestamp(), read: false };
    const msgInput = document.getElementById("msgInput");
    const msgText = msgInput ? msgInput.value.trim() : "";
    if (msgText) messageData.txt = msgText;

    try {
        if (hasImage) {
            messageData.image = getPendingImage();
            setPendingImage(null);
        }
        if (hasVideo) {
            messageData.video = getPendingVideo();
            setPendingVideo(null);
        }
        if (hasVoice) {
            messageData.voice = getPendingVoice();
            setPendingVoice(null);
        }
        if (hasFile) {
            messageData.file = getPendingFile();
            setPendingFile(null);
        }

        await addDoc(collection(dbInstance, "chats", currentChat, "messages"), messageData);
        if (msgInput) msgInput.value = "";

        const panels = ["imagePreviewPanel", "videoPreviewPanel", "voicePreviewPanel", "filePreviewPanel"];
        panels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.style.display = "none";
        });
        showToast("Xabar yuborildi");
    } catch (error) {
        console.error("Xabar yuborish xatosi:", error);
        showToast("Xatolik: " + error.message);
    }
}

// ========== TYPING INDICATOR ==========
function sendTypingStatus(chatId, userId, isTyping) {
    if (!chatId || !userId) return;
    const typingRef = doc(dbInstance, "typing", chatId);
    const data = { [userId]: isTyping ? serverTimestamp() : null };
    updateDoc(typingRef, data).catch(() => setDoc(typingRef, data).catch(() => {}));
}

function listenForTyping(chatId, currentUserId, callback) {
    if (!chatId) return;
    const typingRef = doc(dbInstance, "typing", chatId);
    return onSnapshot(typingRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            let isTyping = false;
            const now = Date.now();
            for (const [userId, timestamp] of Object.entries(data)) {
                if (userId !== currentUserId && timestamp) {
                    const time = timestamp.seconds ? timestamp.seconds * 1000 : timestamp;
                    if (now - time < 3000) {
                        isTyping = true;
                        break;
                    }
                }
            }
            callback(isTyping);
        } else {
            callback(false);
        }
    });
}

function initTypingIndicator(chatId, targetName) {
    const msgInput = document.getElementById('msgInput');
    if (!msgInput) return;
    let lastTypingTime = 0;
    const inputHandler = () => {
        const now = Date.now();
        if (now - lastTypingTime > 1000) {
            lastTypingTime = now;
            sendTypingStatus(chatId, me.uid, true);
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => sendTypingStatus(chatId, me.uid, false), 2000);
        }
    };
    const blurHandler = () => sendTypingStatus(chatId, me.uid, false);
    msgInput.addEventListener('input', inputHandler);
    msgInput.addEventListener('blur', blurHandler);
    return () => {
        msgInput.removeEventListener('input', inputHandler);
        msgInput.removeEventListener('blur', blurHandler);
    };
}

function showTypingIndicator(isTyping, name) {
    const chatTitle = document.getElementById('chatTitle');
    if (!chatTitle) return;
    if (isTyping) {
        if (!chatTitle.dataset.originalTitle) chatTitle.dataset.originalTitle = chatTitle.innerText;
        chatTitle.innerHTML = `${name} <span class="typing-dots-inline"><span>.</span><span>.</span><span>.</span></span>`;
    } else if (chatTitle.dataset.originalTitle) {
        chatTitle.innerText = chatTitle.dataset.originalTitle;
        delete chatTitle.dataset.originalTitle;
    }
}

// ========== FORWARD MESSAGE ==========
export function forwardMessageToChat(message, targetChatId, targetChatName) {
    const messageData = {
        from: me.uid, time: serverTimestamp(), read: false, isForwarded: true,
        originalFrom: message.from, originalText: message.txt || null,
        originalImage: message.image || null, originalVideo: message.video || null,
        originalVoice: message.voice || null
    };
    if (message.txt) messageData.txt = message.txt;
    if (message.image) messageData.image = message.image;
    if (message.video) messageData.video = message.video;
    if (message.voice) messageData.voice = message.voice;
    addDoc(collection(dbInstance, "chats", targetChatId, "messages"), messageData);
    showToast(`✅ Xabar ${targetChatName} ga forward qilindi`);
}

// ========== REPLY TO MESSAGE ==========
export function replyToMessage(message, msgId) {
    replyToMessageData = { message, msgId };
    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.focus();
        let replyIndicator = document.getElementById('replyIndicator');
        if (!replyIndicator) {
            replyIndicator = document.createElement('div');
            replyIndicator.id = 'replyIndicator';
            replyIndicator.className = 'reply-indicator';
            document.querySelector('.chat-input-area').prepend(replyIndicator);
        }
        const replyText = message.txt ? message.txt.substring(0, 50) : (message.image ? '📷 Rasm' : (message.video ? '🎥 Video' : '🎤 Ovoz'));
        replyIndicator.innerHTML = `
            <div class="reply-indicator-content">
                <span class="reply-indicator-text">↩️ Javob: ${escapeHtml(replyText)}</span>
                <button class="reply-indicator-cancel" id="cancelReplyBtn">✕</button>
            </div>
        `;
        replyIndicator.style.display = 'block';
        document.getElementById('cancelReplyBtn').onclick = () => {
            replyToMessageData = null;
            replyIndicator.style.display = 'none';
        };
    }
}

// ========== DELETE FOR EVERYONE ==========
export async function deleteForEveryone(chatId, msgId) {
    if (!confirm("Xabarni hamma uchun o'chirilsinmi?")) return;
    try {
        await updateDoc(doc(dbInstance, "chats", chatId, "messages", msgId), {
            deletedForEveryone: true, deletedAt: serverTimestamp(),
            txt: "Xabar o'chirildi", image: null, video: null, voice: null
        });
        showToast("✅ Xabar hamma uchun o'chirildi");
    } catch (err) {
        console.error("Delete for everyone error:", err);
        showToast("❌ Xatolik yuz berdi");
    }
}

// ========== PIN MESSAGES ==========
export async function pinMessage(chatId, msgId, message) {
    try {
        const chatRef = doc(dbInstance, "chats", chatId);
        await updateDoc(chatRef, {
            pinnedMessage: { id: msgId, text: message.txt || (message.image ? '📷 Rasm' : (message.video ? '🎥 Video' : '🎤 Ovoz')), from: message.from, time: message.time },
            pinnedAt: serverTimestamp()
        });
        showToast("📌 Xabar pin qilindi");
        showPinnedMessage(message);
    } catch (err) {
        console.error("Pin message error:", err);
        showToast("❌ Xatolik yuz berdi");
    }
}

function showPinnedMessage(message) {
    let pinnedBar = document.getElementById('pinnedMessageBar');
    if (!pinnedBar) {
        pinnedBar = document.createElement('div');
        pinnedBar.id = 'pinnedMessageBar';
        pinnedBar.className = 'pinned-message-bar';
        const header = document.querySelector('.chat-header');
        if (header) header.after(pinnedBar);
    }
    const text = message.txt ? message.txt.substring(0, 60) : (message.image ? '📷 Rasm' : (message.video ? '🎥 Video' : '🎤 Ovoz'));
    pinnedBar.innerHTML = `
        <div class="pinned-message-content">
            <span class="pinned-message-icon">📌</span>
            <span class="pinned-message-text">${escapeHtml(text)}</span>
            <button class="pinned-message-close" id="unpinBtn">✕</button>
        </div>
    `;
    pinnedBar.style.display = 'block';
    document.getElementById('unpinBtn').onclick = () => unpinMessage(currentChat);
}

async function unpinMessage(chatId) {
    try {
        const chatRef = doc(dbInstance, "chats", chatId);
        await updateDoc(chatRef, { pinnedMessage: null, pinnedAt: null });
        const pinnedBar = document.getElementById('pinnedMessageBar');
        if (pinnedBar) pinnedBar.style.display = 'none';
        showToast("📌 Pin olib tashlandi");
    } catch (err) { console.error("Unpin error:", err); }
}

// ========== MESSAGE SEARCH ==========
let searchResults = [], currentSearchIndex = 0;
function clearSearchHighlight() {
    document.querySelectorAll('#chatMsgs .msg.search-highlight').forEach(msg => msg.classList.remove('search-highlight', 'search-current'));
    searchResults = [];
}
export function searchMessages(chatId, keyword) {
    if (!keyword || keyword.trim() === '') { clearSearchHighlight(); return []; }
    const messages = document.querySelectorAll('#chatMsgs .msg');
    const results = [];
    messages.forEach((msg, index) => {
        const textElement = msg.querySelector('.msg-content div');
        if (textElement && textElement.innerText.toLowerCase().includes(keyword.toLowerCase())) {
            results.push({ element: msg, index });
            msg.classList.add('search-highlight');
        }
    });
    searchResults = results;
    currentSearchIndex = 0;
    if (results.length > 0) {
        results[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        results[0].element.classList.add('search-current');
        showToast(`🔍 ${results.length} ta xabar topildi`);
    } else {
        showToast(`🔍 "${keyword}" topilmadi`);
    }
    return results;
}
export function nextSearchResult() {
    if (searchResults.length === 0) return;
    searchResults[currentSearchIndex].element.classList.remove('search-current');
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    searchResults[currentSearchIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchResults[currentSearchIndex].element.classList.add('search-current');
}
export function prevSearchResult() {
    if (searchResults.length === 0) return;
    searchResults[currentSearchIndex].element.classList.remove('search-current');
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    searchResults[currentSearchIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchResults[currentSearchIndex].element.classList.add('search-current');
}

// ========== OPEN CHAT ==========
export function openChat(target, type = "private", chatId = null) {
    stopAllVoice();
    stopAllPlayers();
    currentChatUser = target;
    currentChatType = type;

    if (type === "private") {
        currentChat = [me.uid, target.uid].sort().join("_");
    } else if (type === "group") {
        currentChat = chatId || target.id;
    } else if (type === "channel") {
        currentChat = chatId || target.id;
    }

    setCurrentChat(currentChat);

    const chatTitle = document.getElementById("chatTitle");
    const chatView = document.getElementById("chatView");
    const audioCallBtn = document.getElementById("audioCallBtn");
    const videoCallBtn = document.getElementById("videoCallBtn");
    const groupInfoBtn = document.getElementById("groupInfoBtn");

    if (type === "private") {
        chatTitle.innerText = target.name || target.username;
        if (audioCallBtn) audioCallBtn.style.display = "flex";
        if (videoCallBtn) videoCallBtn.style.display = "flex";
        if (groupInfoBtn) groupInfoBtn.style.display = "none";
    } else {
        chatTitle.innerText = target.name;
        if (audioCallBtn) audioCallBtn.style.display = "none";
        if (videoCallBtn) videoCallBtn.style.display = "none";
        if (groupInfoBtn) groupInfoBtn.style.display = "flex";
    }

    const chatAvatarImg = document.getElementById("chatAvatarImg");
    if (chatAvatarImg) {
        if (type === "private" && target.photoURL && target.photoURL !== "") {
            chatAvatarImg.src = target.photoURL;
            chatAvatarImg.style.display = "inline-block";
            const oldSpan = chatAvatarImg.parentElement?.querySelector('.smart-avatar-span');
            if (oldSpan) oldSpan.remove();
        } else if (type === "private") {
            chatAvatarImg.style.display = "none";
            const parent = chatAvatarImg.parentElement;
            let span = parent.querySelector('.smart-avatar-span');
            if (!span) {
                span = document.createElement('span');
                span.className = 'smart-avatar-span chat-smart-avatar';
                const bgColor = getAvatarColorFromUsername(target.username);
                span.style.cssText = `width:36px; height:36px; border-radius:50%; background:${bgColor}; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px; color:white;`;
                span.innerText = getAvatarInitial(target.name);
                parent.insertBefore(span, chatAvatarImg);
            }
        }
    }

    // Typing Indicator
    if (typingUnsubscribe) typingUnsubscribe();
    typingUnsubscribe = listenForTyping(currentChat, me.uid, (isTyping) => {
        showTypingIndicator(isTyping, target.name || target.username);
    });
    initTypingIndicator(currentChat, target.name || target.username);

    if (chatView) chatView.classList.add("active");
    if (messagesUnsubscribe) messagesUnsubscribe();

    const q = query(collection(dbInstance, "chats", currentChat, "messages"), orderBy("time", "asc"));
    messagesUnsubscribe = onSnapshot(q, (snap) => {
        const container = document.getElementById("chatMsgs");
        if (!container) return;
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.from === me.uid;
            const msgDiv = createMessageElement(msg, docSnap.id, isMe);
            container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
        loadPinnedMessage(currentChat);
    });
}

async function loadPinnedMessage(chatId) {
    try {
        const chatRef = doc(dbInstance, "chats", chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists() && chatSnap.data().pinnedMessage) {
            showPinnedMessage(chatSnap.data().pinnedMessage);
        }
    } catch (err) { console.error("Load pinned error:", err); }
}

export function openStealthChat(stealthData) {
    stopAllVoice();
    stopAllPlayers();
    currentChatUser = {
        uid: stealthData.id, name: stealthData.name, username: null,
        photoURL: stealthData.photoURL, isStealth: true
    };
    currentChatType = 'private';
    currentChat = `stealth_${stealthData.id}`;
    setCurrentChat(currentChat);

    const chatTitle = document.getElementById('chatTitle');
    const chatView = document.getElementById('chatView');
    const audioCallBtn = document.getElementById('audioCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    const groupInfoBtn = document.getElementById('groupInfoBtn');

    chatTitle.innerText = stealthData.name;
    if (audioCallBtn) audioCallBtn.style.display = 'flex';
    if (videoCallBtn) videoCallBtn.style.display = 'flex';
    if (groupInfoBtn) groupInfoBtn.style.display = 'none';

    const chatAvatarImg = document.getElementById('chatAvatarImg');
    if (chatAvatarImg) {
        if (stealthData.photoURL) {
            chatAvatarImg.src = stealthData.photoURL;
            chatAvatarImg.style.display = 'inline-block';
        } else {
            chatAvatarImg.style.display = 'none';
            const parent = chatAvatarImg.parentElement;
            let span = parent.querySelector('.smart-avatar-span');
            if (!span) {
                span = document.createElement('span');
                span.className = 'smart-avatar-span chat-smart-avatar';
                const bgColor = getAvatarColorFromUsername(stealthData.id);
                span.style.cssText = `width:36px; height:36px; border-radius:50%; background:${bgColor}; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px; color:white;`;
                span.innerText = getAvatarInitial(stealthData.name);
                parent.insertBefore(span, chatAvatarImg);
            }
        }
    }

    if (chatView) chatView.classList.add("active");
    if (messagesUnsubscribe) messagesUnsubscribe();

    const q = query(collection(dbInstance, "chats", currentChat, "messages"), orderBy("time", "asc"));
    messagesUnsubscribe = onSnapshot(q, (snap) => {
        const container = document.getElementById("chatMsgs");
        if (!container) return;
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.from === me.uid;
            const msgDiv = createMessageElement(msg, docSnap.id, isMe);
            container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function createMessageElement(message, msgId, isMe) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg " + (isMe ? "me" : "them");
    msgDiv.dataset.msgId = msgId;

    let msgTime = "";
    if (message.time) {
        const date = new Date(message.time.seconds * 1000);
        msgTime = date.getHours().toString().padStart(2, "0") + ":" + date.getMinutes().toString().padStart(2, "0");
    }

    let contentHtml = `<div class="msg-header"><span class="msg-time">${msgTime}</span>`;
    if (message.isForwarded) contentHtml += `<span class="forward-badge">↗️ Forwarded</span>`;
    if (message.isReply) contentHtml += `<div class="reply-badge">↩️ Reply to: ${escapeHtml(message.replyToText || 'Media')}</div>`;
    if (message.deletedForEveryone) {
        contentHtml += `<div class="deleted-message"><i>Xabar o'chirildi</i></div></div><div class="msg-content"></div>`;
        msgDiv.innerHTML = contentHtml;
        return msgDiv;
    }
    contentHtml += `</div><div class="msg-content">`;
    if (message.txt) contentHtml += `<div>${escapeHtml(message.txt)}</div>`;
    if (message.image && message.image !== "") {
        contentHtml += `<img src="${message.image}" class="msg-image" data-src="${message.image}" style="max-width:200px; max-height:200px; border-radius:16px; cursor:pointer;">`;
    }
    if (message.video && message.video !== "") {
        contentHtml += `<video controls src="${message.video}" style="max-width:250px; max-height:200px; border-radius:16px;"></video>`;
    }
    if (message.file && message.file.type === "audio") {
        contentHtml += `<div class="av-container" data-url="${message.file.url}" data-name="${escapeHtml(message.file.name)}" data-size="${message.file.size}" data-type="audio" data-is-me="${isMe}"></div>`;
    }
    if (message.voice) {
        contentHtml += `<div class="av-container" data-url="${message.voice}" data-name="Ovozli xabar" data-size="0" data-type="voice" data-is-me="${isMe}"></div>`;
    }
    contentHtml += `</div>`;

    // READ RECEIPTS
    if (isMe) {
        const readIcon = getReadStatusIcon(message);
        contentHtml += `<div class="msg-footer">${readIcon}</div>`;
    }

    msgDiv.innerHTML = contentHtml;

    const msgImage = msgDiv.querySelector(".msg-image");
    if (msgImage) msgImage.onclick = () => viewFullImage(msgImage.dataset.src);

    const avContainer = msgDiv.querySelector(".av-container");
    if (avContainer) {
        const url = avContainer.dataset.url, name = avContainer.dataset.name;
        const sizeVal = parseInt(avContainer.dataset.size) || 0;
        const playerType = avContainer.dataset.type, isMeVal = avContainer.dataset.isMe === "true";
        const player = createPlayer(url, name, sizeVal, playerType, isMeVal);
        avContainer.innerHTML = "";
        avContainer.appendChild(player);
    }

    // READ RECEIPTS - mark as read
    if (!isMe && !message.read) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    markMessageAsRead(currentChat, msgId, me.uid);
                    observer.disconnect();
                }
            });
        }, { threshold: 0.5 });
        observer.observe(msgDiv);
    }

    // Long press menu
    let pressTimer = null;
    const showContextMenu = (e) => {
        if (e.button !== 0 && e.button !== undefined) return;
        let menu = document.getElementById('messageContextMenu');
        if (menu) menu.remove();
        menu = document.createElement('div');
        menu.id = 'messageContextMenu';
        menu.className = 'message-context-menu';
        let menuHtml = `
            <div class="context-menu-item" data-action="copy"><img src="svg-icons/copy.svg" width="18" height="18"> Nusxa olish</div>
            <div class="context-menu-item" data-action="forward"><img src="svg-icons/forward.svg" width="18" height="18"> Forward qilish</div>
            <div class="context-menu-item" data-action="reply"><img src="svg-icons/reply.svg" width="18" height="18"> Javob qilish</div>
            <div class="context-menu-item" data-action="pin"><img src="svg-icons/pin.svg" width="18" height="18"> Pin qilish</div>
        `;
        if (isMe) {
            menuHtml += `
                <div class="context-menu-item" data-action="edit"><img src="svg-icons/edit.svg" width="18" height="18"> Tahrirlash</div>
                <div class="context-menu-item" data-action="delete"><img src="svg-icons/delete.svg" width="18" height="18"> O'chirish</div>
                <div class="context-menu-item" data-action="deleteForEveryone"><img src="svg-icons/delete.svg" width="18" height="18"> Hamma uchun o'chirish</div>
            `;
        }
        menu.innerHTML = menuHtml;
        document.body.appendChild(menu);
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.style.display = 'block';
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.onclick = async () => {
                const action = item.dataset.action;
                if (action === 'copy' && message.txt) {
                    navigator.clipboard.writeText(message.txt);
                    showToast("Xabar nusxalandi");
                } else if (action === 'forward') showToast("↗️ Forward qilish (tez kunda)");
                else if (action === 'reply') replyToMessage(message, msgId);
                else if (action === 'pin') pinMessage(currentChat, msgId, message);
                else if (action === 'edit') {
                    const { editMessage } = await import("./messages.js");
                    editMessage(msgId, message, currentChat);
                } else if (action === 'delete' && confirm("Xabarni o'chirilsinmi?")) {
                    await deleteDoc(doc(dbInstance, "chats", currentChat, "messages", msgId));
                    showToast("Xabar o'chirildi");
                } else if (action === 'deleteForEveryone') deleteForEveryone(currentChat, msgId);
                menu.remove();
            };
        });
        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
    };
    msgDiv.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        pressTimer = setTimeout(() => showContextMenu(e), 500);
    });
    msgDiv.addEventListener('mouseup', () => clearTimeout(pressTimer));
    msgDiv.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    msgDiv.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => showContextMenu(e), 500);
    });
    msgDiv.addEventListener('touchend', () => clearTimeout(pressTimer));
    msgDiv.addEventListener('contextmenu', (e) => e.preventDefault());
    return msgDiv;
}

export function closeChat() {
    const chatView = document.getElementById("chatView");
    if (chatView) chatView.classList.remove("active");
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (typingUnsubscribe) typingUnsubscribe();
    currentChatUser = null;
    currentChat = null;
    currentChatType = "private";
    clearEditing();
    stopAllVoice();
    stopAllPlayers();
    endCall();

    const replyIndicator = document.getElementById('replyIndicator');
    if (replyIndicator) replyIndicator.style.display = 'none';
    replyToMessageData = null;
    clearSearchHighlight();

    const msgInput = document.getElementById("msgInput");
    if (msgInput) msgInput.value = "";

    const voiceBtn = document.getElementById("voiceBtn");
    const sendBtn = document.getElementById("sendBtn");
    if (voiceBtn && sendBtn) {
        voiceBtn.style.display = "flex";
        sendBtn.style.display = "none";
    }
}

export function getCurrentChat() { return currentChat; }
export function getCurrentChatUser() { return currentChatUser; }
export function getCurrentChatType() { return currentChatType; }
