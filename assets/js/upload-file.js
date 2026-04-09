// assets/js/upload-file.js (to'liq versiya)

import { supabase, BUCKET } from "./config/supabase-config.js";
import { showToast } from "./ui-helpers.js";

let loadingToast = null;
let currentFileSize = 0;
let uploadStartTime = 0;
let speedInterval = null;

// ========== YUKLASH PROGRESS UI ==========
function showLoadingToast(fileName, fileSize) {
    if (loadingToast) {
        loadingToast.remove();
        loadingToast = null;
    }
    
    currentFileSize = fileSize;
    uploadStartTime = Date.now();
    
    loadingToast = document.createElement('div');
    loadingToast.id = 'loadingToast';
    loadingToast.className = 'loading-toast';
    loadingToast.innerHTML = `
        <div class="loading-spinner-small"></div>
        <div class="loading-info">
            <div class="loading-text">${fileName}</div>
            <div class="loading-progress-bar">
                <div class="loading-progress-fill" style="width: 0%"></div>
            </div>
            <div class="loading-stats">
                <span class="loading-percent">0%</span>
                <span class="loading-speed">0 KB/s</span>
                <span class="loading-time">0s qoldi</span>
            </div>
        </div>
    `;
    document.body.appendChild(loadingToast);
    
    if (speedInterval) clearInterval(speedInterval);
    speedInterval = setInterval(updateSpeed, 500);
}

function updateSpeed() {
    if (!loadingToast) return;
    const elapsed = (Date.now() - uploadStartTime) / 1000;
    const speed = currentFileSize / elapsed / 1024;
    const speedSpan = loadingToast.querySelector('.loading-speed');
    if (speedSpan && !isNaN(speed) && isFinite(speed)) {
        if (speed > 1024) {
            speedSpan.innerText = `${(speed / 1024).toFixed(1)} MB/s`;
        } else {
            speedSpan.innerText = `${speed.toFixed(0)} KB/s`;
        }
    }
}

function updateLoadingToast(percent, loadedBytes = null) {
    if (loadingToast) {
        const percentEl = loadingToast.querySelector('.loading-percent');
        const fillEl = loadingToast.querySelector('.loading-progress-fill');
        const timeEl = loadingToast.querySelector('.loading-time');
        
        if (percentEl) percentEl.innerText = `${Math.round(percent)}%`;
        if (fillEl) fillEl.style.width = `${percent}%`;
        
        if (loadedBytes !== null && currentFileSize > 0) {
            const elapsed = (Date.now() - uploadStartTime) / 1000;
            const speed = loadedBytes / elapsed;
            if (speed > 0 && percent < 100) {
                const remainingBytes = currentFileSize - loadedBytes;
                const remainingTime = remainingBytes / speed;
                if (timeEl && !isNaN(remainingTime) && isFinite(remainingTime)) {
                    if (remainingTime > 60) {
                        timeEl.innerText = `${Math.floor(remainingTime / 60)}m ${Math.floor(remainingTime % 60)}s qoldi`;
                    } else {
                        timeEl.innerText = `${Math.ceil(remainingTime)}s qoldi`;
                    }
                }
            }
        }
    }
}

function hideLoadingToast() {
    if (speedInterval) {
        clearInterval(speedInterval);
        speedInterval = null;
    }
    if (loadingToast) {
        loadingToast.remove();
        loadingToast = null;
    }
}

// ========== SUPABASE YUKLASH ==========
export async function uploadToSupabase(file, typePrefix, onProgress) {
    const ext = file.name.split('.').pop();
    const fileName = `${typePrefix}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: (progress) => {
                if (onProgress) {
                    const percent = (progress.loaded / progress.total) * 100;
                    onProgress(percent, progress.loaded);
                }
            }
        });
    
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

// ========== UMUMIY MEDIA YUKLASH ==========
export async function uploadMedia(file, onProgress) {
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast(`Fayl hajmi ${(maxSize / 1024 / 1024).toFixed(0)}MB dan katta`);
        return null;
    }
    
    const fileType = getFileType(file);
    let typePrefix = 'files';
    
    if (fileType === 'image') typePrefix = 'images';
    else if (fileType === 'video') typePrefix = 'videos';
    else if (fileType === 'audio') typePrefix = 'audio';
    
    showLoadingToast(file.name, file.size);
    
    try {
        const url = await uploadToSupabase(file, typePrefix, (percent, loaded) => {
            updateLoadingToast(percent, loaded);
            if (onProgress) onProgress(percent, loaded);
        });
        
        updateLoadingToast(100, file.size);
        setTimeout(() => hideLoadingToast(), 800);
        showToast(`${file.name} yuklandi!`);
        
        return { url, type: fileType, name: file.name, size: file.size };
    } catch (err) {
        hideLoadingToast();
        showToast(`Xatolik: ${err.message}`);
        return null;
    }
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
    return 'document';
}

export async function uploadAvatar(file) {
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Rasm hajmi 5MB dan kichik bo'lishi kerak");
    }
    showLoadingToast(file.name, file.size);
    try {
        const url = await uploadToSupabase(file, "avatars", (percent, loaded) => {
            updateLoadingToast(percent, loaded);
        });
        updateLoadingToast(100, file.size);
        setTimeout(() => hideLoadingToast(), 800);
        return url;
    } catch (err) {
        hideLoadingToast();
        throw err;
    }
}

export async function uploadImage(file) {
    const result = await uploadMedia(file);
    return result?.url || null;
}

export async function uploadVideo(file, onProgress) {
    const result = await uploadMedia(file, onProgress);
    return result?.url || null;
}

export async function uploadAudio(blob) {
    const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
    const result = await uploadMedia(file);
    return result?.url || null;
}
