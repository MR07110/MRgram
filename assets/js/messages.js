// assets/messages/messages.js

import { db } from "./config/firebase-config.js";
import { collection, doc, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, escapeHtml } from "./ui-helpers.js";

let currentEditingMsgId = null;
let currentEditingChat = null;
let pendingImageUrl = null;
let pendingVoiceUrl = null;
let pendingVideoUrl = null;
let pendingFileData = null;
let sendingMessageId = null;

export let editingMsgId = null;

// ========== GETTERS ==========
export function getEditingMsgId() { return currentEditingMsgId; }
export function getPendingImage() { return pendingImageUrl; }
export function getPendingVoice() { return pendingVoiceUrl; }
export function getPendingVideo() { return pendingVideoUrl; }
export function getPendingFile() { return pendingFileData; }
export function isSendingMessage() { return sendingMessageId !== null; }

// ========== SETTERS ==========
export function setCurrentChat(chatId) {
    currentEditingChat = chatId;
}

export function setPendingImage(url) { pendingImageUrl = url; }
export function setPendingVoice(url) { pendingVoiceUrl = url; }
export function setPendingVideo(url) { pendingVideoUrl = url; }
export function setPendingFile(data) { pendingFileData = data; }

export function clearPendingMedia() {
    pendingImageUrl = null;
    pendingVoiceUrl = null;
    pendingVideoUrl = null;
    pendingFileData = null;
}

// ========== TAHRIRLASH ==========
export function editMessage(msgId, message, chatId) {
    currentEditingMsgId = msgId;
    currentEditingChat = chatId;
    editingMsgId = msgId;
    
    const msgInput = document.getElementById('msgInput');
    if(msgInput) msgInput.value = message.txt || "";
    
    if(message.image && message.image !== "") {
        pendingImageUrl = message.image;
        const imagePanel = document.getElementById('imagePreviewPanel');
        const previewImg = document.getElementById('previewImg');
        const fileNameSpan = document.getElementById('previewFileName');
        if(imagePanel) {
            imagePanel.style.display = 'flex';
            if(previewImg) {
                previewImg.src = message.image;
                previewImg.style.maxWidth = '60px';
                previewImg.style.maxHeight = '60px';
                previewImg.style.objectFit = 'cover';
                previewImg.style.borderRadius = '12px';
            }
            if(fileNameSpan) fileNameSpan.innerText = 'Rasm';
            const cancelBtn = document.getElementById('cancelImagePreview');
            if(cancelBtn) {
                cancelBtn.onclick = () => {
                    pendingImageUrl = null;
                    imagePanel.style.display = 'none';
                    clearEditing();
                };
            }
        }
    }
    
    if(message.voice && message.voice !== "") {
        pendingVoiceUrl = message.voice;
        const voicePanel = document.getElementById('voicePreviewPanel');
        const voiceAudio = document.getElementById('voicePreviewAudio');
        if(voicePanel) voicePanel.style.display = 'flex';
        if(voiceAudio) voiceAudio.src = message.voice;
        const cancelVoice = document.getElementById('cancelVoicePreview');
        if(cancelVoice) {
            cancelVoice.onclick = () => {
                pendingVoiceUrl = null;
                voicePanel.style.display = 'none';
                clearEditing();
            };
        }
    }
    
    if(message.video && message.video !== "") {
        pendingVideoUrl = message.video;
        const videoPanel = document.getElementById('videoPreviewPanel');
        const videoPreview = document.getElementById('videoPreview');
        if(videoPanel) videoPanel.style.display = 'flex';
        if(videoPreview) {
            videoPreview.src = message.video;
            videoPreview.style.width = '80px';
            videoPreview.style.height = '80px';
        }
        const cancelVideo = document.getElementById('cancelVideoPreview');
        if(cancelVideo) {
            cancelVideo.onclick = () => {
                pendingVideoUrl = null;
                videoPanel.style.display = 'none';
                clearEditing();
            };
        }
    }
    
    const sendBtn = document.getElementById('sendBtn');
    if(sendBtn) {
        sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"><path d="M20 6L9 17l-5-5"/></svg>`;
    }
    showToast("✏️ Xabarni tahrirlash...");
}

// ========== TAHRIRLASHNI TOZALASH ==========
export function clearEditing() {
    currentEditingMsgId = null;
    currentEditingChat = null;
    editingMsgId = null;
    clearPendingMedia();
    
    const sendBtn = document.getElementById('sendBtn');
    if(sendBtn) {
        sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
    }
    
    // Input ni tozalash
    const msgInput = document.getElementById('msgInput');
    if(msgInput) msgInput.value = '';
    
    // Preview panellarni yopish
    const panels = ['imagePreviewPanel', 'videoPreviewPanel', 'voicePreviewPanel'];
    panels.forEach(id => {
        const panel = document.getElementById(id);
        if(panel) panel.style.display = 'none';
    });
}

// ========== YUBORILAYOTGAN XABAR UI ==========
function addSendingMessage(chatId, me, messageData) {
    const chatMsgs = document.getElementById('chatMsgs');
    if(!chatMsgs) return;
    const tempId = `temp_${Date.now()}`;
    const msgDiv = document.createElement('div');
    msgDiv.id = tempId;
    msgDiv.className = 'msg me msg-loading';
    
    let contentHtml = `<div class="msg-content">`;
    if(messageData.txt) contentHtml += `<div>${escapeHtml(messageData.txt)}</div>`;
    if(messageData.image && messageData.image !== "") {
        contentHtml += `<div class="image-loading"><div class="spinner-small"></div><span>📷 Rasm yuklanmoqda...</span></div>`;
    }
    if(messageData.video && messageData.video !== "") {
        contentHtml += `<div class="video-loading"><div class="spinner-small"></div><span>🎥 Video yuklanmoqda...</span><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div></div>`;
    }
    if(messageData.voice && messageData.voice !== "") {
        contentHtml += `<div class="voice-loading"><div class="spinner-small"></div><span>🎤 Ovoz yuklanmoqda...</span></div>`;
    }
    if(messageData.file && messageData.file.url) {
        const fileIcon = getFileIcon(messageData.file.type);
        contentHtml += `<div class="file-loading"><div class="spinner-small"></div><span>${fileIcon} ${messageData.file.name} yuklanmoqda...</span><div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div></div>`;
    }
    contentHtml += `</div>`;
    
    msgDiv.innerHTML = `<div class="msg-header"><span class="msg-time">⏳ Yuborilmoqda...</span></div>${contentHtml}`;
    chatMsgs.appendChild(msgDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    return tempId;
}

function getFileIcon(type) {
    const icons = {
        'image': '🖼️',
        'video': '🎥',
        'audio': '🎵',
        'file': '📎'
    };
    return icons[type] || '📎';
}

function updateSendingMessageProgress(tempId, percent, type = 'video') {
    const msgDiv = document.getElementById(tempId);
    if(!msgDiv) return;
    
    if(type === 'video') {
        const progressFill = msgDiv.querySelector('.progress-fill');
        if(progressFill) progressFill.style.width = `${percent}%`;
        const loadingText = msgDiv.querySelector('.video-loading span');
        if(loadingText) loadingText.innerText = `🎥 Video yuklanmoqda: ${Math.round(percent)}%`;
    }
    
    if(type === 'file') {
        const progressFill = msgDiv.querySelector('.progress-fill');
        if(progressFill) progressFill.style.width = `${percent}%`;
        const loadingText = msgDiv.querySelector('.file-loading span');
        if(loadingText) {
            const match = loadingText.innerText.match(/([📎🎵🎥🖼️])\s+(.+?)\s+yuklanmoqda/);
            if(match) {
                loadingText.innerText = `${match[1]} ${match[2]} yuklanmoqda: ${Math.round(percent)}%`;
            }
        }
    }
}

function removeSendingMessage(tempId) {
    const msgDiv = document.getElementById(tempId);
    if(msgDiv) msgDiv.remove();
}

// ========== XABAR YUBORISH ==========
export async function sendMessage(chatId, me, onVideoProgress = null) {
    const msgText = document.getElementById('msgInput').value.trim();
    const hasImage = pendingImageUrl !== null;
    const hasVoice = pendingVoiceUrl !== null;
    const hasVideo = pendingVideoUrl !== null;
    const hasFile = pendingFileData !== null;
    
    if(!msgText && !hasImage && !hasVoice && !hasVideo && !hasFile) return;
    
    const messageData = {};
    if(msgText) messageData.txt = msgText;
    if(hasImage) messageData.image = pendingImageUrl;
    if(hasVoice) messageData.voice = pendingVoiceUrl;
    if(hasVideo) messageData.video = pendingVideoUrl;
    if(hasFile) messageData.file = pendingFileData;
    
    const tempId = addSendingMessage(chatId, me, messageData);
    
    try {
        if(currentEditingMsgId && currentEditingChat === chatId) {
            let updateObj = { edited: true, time: serverTimestamp() };
            if(msgText) updateObj.txt = msgText;
            if(hasImage) updateObj.image = pendingImageUrl;
            if(hasVoice) updateObj.voice = pendingVoiceUrl;
            if(hasVideo) updateObj.video = pendingVideoUrl;
            if(hasFile) updateObj.file = pendingFileData;
            
            await updateDoc(doc(db, "chats", chatId, "messages", currentEditingMsgId), updateObj);
            currentEditingMsgId = null;
            editingMsgId = null;
            showToast("✅ Xabar tahrirlandi");
        } else {
            let finalMessageData = { from: me.uid, time: serverTimestamp() };
            if(msgText) finalMessageData.txt = msgText;
            if(hasImage) finalMessageData.image = pendingImageUrl;
            if(hasVoice) finalMessageData.voice = pendingVoiceUrl;
            if(hasVideo) {
                if(onVideoProgress) {
                    onVideoProgress((percent) => updateSendingMessageProgress(tempId, percent, 'video'));
                }
                finalMessageData.video = pendingVideoUrl;
            }
            if(hasFile) {
                if(onVideoProgress) {
                    onVideoProgress((percent) => updateSendingMessageProgress(tempId, percent, 'file'));
                }
                finalMessageData.file = pendingFileData;
            }
            
            await addDoc(collection(db, "chats", chatId, "messages"), finalMessageData);
        }
        
        removeSendingMessage(tempId);
        
        // Input va preview larni tozalash
        const msgInput = document.getElementById('msgInput');
        if(msgInput) msgInput.value = "";
        clearPendingMedia();
        
        const panels = ['imagePreviewPanel', 'videoPreviewPanel', 'voicePreviewPanel', 'filePreviewPanel'];
        panels.forEach(id => {
            const panel = document.getElementById(id);
            if(panel) panel.style.display = 'none';
        });
        
        const sendBtn = document.getElementById('sendBtn');
        if(sendBtn) {
            sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
        }
        
        // Voice button ni qayta ko'rsatish
        const voiceBtn = document.getElementById('voiceBtn');
        if(voiceBtn && sendBtn) {
            voiceBtn.style.display = 'flex';
            sendBtn.style.display = 'none';
        }
        
    } catch(error) {
        removeSendingMessage(tempId);
        showToast("❌ Xatolik: " + error.message);
        console.error("Send message error:", error);
    }
}
