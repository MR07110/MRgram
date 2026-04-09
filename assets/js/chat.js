// assets/js/chat.js

import { db } from "./config/firebase-config.js";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sendMessage, setCurrentChat, clearEditing, getPendingImage, getPendingVideo, getPendingVoice, getPendingFile, setPendingImage, setPendingVideo, setPendingVoice, setPendingFile } from "./messages.js";
import { stopAllVoice, initVoice } from "./voice.js";
import { escapeHtml, viewFullImage, showToast, getAvatarColorFromUsername, getAvatarInitial } from "./ui-helpers.js";
import { startCall, acceptCall, rejectCall, listenForIncomingCalls, initCallElements, endCall } from "./call.js";
import { uploadMedia } from "./upload-file.js";
import { createPlayer, stopAllPlayers } from "./audio-voice.js";
import { isStealthModeActive, getCurrentStealthChatId } from "./stealth-router.js";

let me = null;
let dbInstance = null;
let currentChatUser = null;
let currentChat = null;
let messagesUnsubscribe = null;
let currentChatType = "private";

let videoProgressCallback = null;
let incomingCallUnsubscribe = null;

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
                voice: url
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

    let messageData = { from: me.uid, time: serverTimestamp() };
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

export function openStealthChat(stealthData) {
    stopAllVoice();
    stopAllPlayers();
    
    currentChatUser = {
        uid: stealthData.id,
        name: stealthData.name,
        username: null,
        photoURL: stealthData.photoURL,
        isStealth: true
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
    
    if (chatView) chatView.classList.add('active');
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

    let msgTime = "";
    if (message.time) {
        const date = new Date(message.time.seconds * 1000);
        msgTime = date.getHours().toString().padStart(2, "0") + ":" + date.getMinutes().toString().padStart(2, "0");
    }

    let contentHtml = `<div class="msg-header"><span class="msg-time">${msgTime}</span></div>`;
    contentHtml += `<div class="msg-content">`;
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

    msgDiv.innerHTML = contentHtml;

    const msgImage = msgDiv.querySelector(".msg-image");
    if (msgImage) {
        msgImage.onclick = () => viewFullImage(msgImage.dataset.src);
    }

    const avContainer = msgDiv.querySelector(".av-container");
    if (avContainer) {
        const url = avContainer.dataset.url;
        const name = avContainer.dataset.name;
        const sizeVal = parseInt(avContainer.dataset.size) || 0;
        const playerType = avContainer.dataset.type;
        const isMeVal = avContainer.dataset.isMe === "true";
        const player = createPlayer(url, name, sizeVal, playerType, isMeVal);
        avContainer.innerHTML = "";
        avContainer.appendChild(player);
    }

    return msgDiv;
}

export function closeChat() {
    const chatView = document.getElementById("chatView");
    if (chatView) chatView.classList.remove("active");
    if (messagesUnsubscribe) messagesUnsubscribe();
    currentChatUser = null;
    currentChat = null;
    currentChatType = "private";
    clearEditing();
    stopAllVoice();
    stopAllPlayers();
    endCall();

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
