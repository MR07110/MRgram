// assets/js/media-preview.js

import { uploadMedia } from "./upload-file.js";
import { setPendingImage, setPendingVideo, setPendingVoice, setPendingFile, clearPendingMedia } from "./messages.js";
import { showToast } from "./ui-helpers.js";
import { clearEditing } from "./messages.js";

let currentFileType = null;
let currentFileUrl = null;

export function initMediaPreviews() {
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    if (fileUploadBtn) {
        fileUploadBtn.onclick = () => triggerFileUpload();
    }
    
    const cancelImage = document.getElementById('cancelImagePreview');
    if (cancelImage) {
        cancelImage.onclick = () => clearPreview();
    }
    
    const cancelVideo = document.getElementById('cancelVideoPreview');
    if (cancelVideo) {
        cancelVideo.onclick = () => clearPreview();
    }
    
    const cancelVoice = document.getElementById('cancelVoicePreview');
    if (cancelVoice) {
        cancelVoice.onclick = () => clearPreview();
    }
}

async function triggerFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.mp3,.wav,.ogg,.m4a';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileType = getFileType(file);
        
        try {
            showToast(`📁 ${file.name} yuklanmoqda...`);
            const result = await uploadMedia(file, (percent, loaded) => {
                updatePreviewProgress(percent);
            });
            
            if (result) {
                showFilePreview(result);
            }
        } catch (err) {
            showToast("Xatolik: " + err.message);
            clearPreview();
        }
    };
    input.click();
}

function getFileType(file) {
    const type = file.type;
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return 'image';
    }
    if (type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
        return 'video';
    }
    if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        return 'audio';
    }
    return 'file';
}

function showFilePreview(fileData) {
    const { url, type, name, size } = fileData;
    currentFileUrl = url;
    currentFileType = type;
    
    const formattedSize = formatFileSize(size);
    
    if (type === 'image') {
        setPendingImage(url);
        const panel = document.getElementById('imagePreviewPanel');
        const img = document.getElementById('previewImg');
        const fileNameSpan = document.getElementById('previewFileName');
        if (panel) panel.style.display = 'flex';
        if (img) img.src = url;
        if (fileNameSpan) fileNameSpan.innerText = `${name} (${formattedSize})`;
    } 
    else if (type === 'video') {
        setPendingVideo(url);
        const panel = document.getElementById('videoPreviewPanel');
        const video = document.getElementById('videoPreview');
        const fileNameSpan = document.getElementById('videoFileName');
        if (panel) panel.style.display = 'flex';
        if (video) {
            video.src = url;
            video.load();
        }
        if (fileNameSpan) fileNameSpan.innerText = `${name} (${formattedSize})`;
    }
    else if (type === 'audio') {
        setPendingFile({ url, type, name, size });
        const panel = document.getElementById('voicePreviewPanel');
        const audio = document.getElementById('voicePreviewAudio');
        const fileNameSpan = document.getElementById('audioFileName');
        if (panel) panel.style.display = 'flex';
        if (audio) {
            audio.src = url;
            audio.load();
        }
        if (fileNameSpan) fileNameSpan.innerText = `${name} (${formattedSize})`;
    }
    else {
        setPendingFile({ url, type, name, size });
        const panel = document.getElementById('filePreviewPanel');
        if (panel) panel.style.display = 'flex';
        const fileNameSpan = document.getElementById('fileName');
        if (fileNameSpan) fileNameSpan.innerText = `${name} (${formattedSize})`;
    }
    
    // Send tugmasini ko'rsatish
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    if (sendBtn && voiceBtn) {
        sendBtn.style.display = 'flex';
        voiceBtn.style.display = 'none';
    }
}

function updatePreviewProgress(percent) {
    const progressFill = document.querySelector('.preview-progress-fill');
    if (progressFill) progressFill.style.width = `${percent}%`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}

function clearPreview() {
    setPendingImage(null);
    setPendingVideo(null);
    setPendingVoice(null);
    setPendingFile(null);
    
    const panels = ['imagePreviewPanel', 'videoPreviewPanel', 'voicePreviewPanel', 'filePreviewPanel'];
    panels.forEach(id => {
        const panel = document.getElementById(id);
        if (panel) panel.style.display = 'none';
    });
    
    const previewImg = document.getElementById('previewImg');
    if (previewImg) previewImg.src = '';
    
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) videoPreview.src = '';
    
    const voiceAudio = document.getElementById('voicePreviewAudio');
    if (voiceAudio) voiceAudio.src = '';
    
    clearEditing();
    
    // Voice tugmasini qayta ko'rsatish
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const msgInput = document.getElementById('msgInput');
    if (sendBtn && voiceBtn && (!msgInput || msgInput.value.trim() === '')) {
        sendBtn.style.display = 'none';
        voiceBtn.style.display = 'flex';
    }
}

export function setVoicePreviewFromBlob(blob, url) {
    setPendingVoice(url);
    const voicePanel = document.getElementById('voicePreviewPanel');
    const voiceAudio = document.getElementById('voicePreviewAudio');
    if (voicePanel) voicePanel.style.display = 'flex';
    if (voiceAudio) voiceAudio.src = url;
    
    // Send tugmasini ko'rsatish
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    if (sendBtn && voiceBtn) {
        sendBtn.style.display = 'flex';
        voiceBtn.style.display = 'none';
    }
}
