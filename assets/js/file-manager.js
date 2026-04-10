// assets/js/file-manager.js

let selectedFiles = [];
let filePreviewsContainer = null;

export function initFileManager() {
    // File preview container yaratish
    if (!document.getElementById('filePreviewsContainer')) {
        const container = document.createElement('div');
        container.id = 'filePreviewsContainer';
        container.className = 'file-previews-container';
        
        const inputBar = document.querySelector('.input-bar');
        if (inputBar) {
            inputBar.insertBefore(container, inputBar.firstChild);
        }
        filePreviewsContainer = container;
    }
}

export function addFiles(files) {
    // Yangi fayllarni qo'shish
    for (let file of files) {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
            createFilePreview(file);
        }
    }
    
    // Send tugmasini ko'rsatish
    toggleSendButton();
}

export function removeFile(index) {
    if (index >= 0 && index < selectedFiles.length) {
        selectedFiles.splice(index, 1);
        const preview = document.querySelector(`.file-preview-item[data-index="${index}"]`);
        if (preview) preview.remove();
        
        // Index larni yangilash
        document.querySelectorAll('.file-preview-item').forEach((item, i) => {
            item.setAttribute('data-index', i);
        });
        
        toggleSendButton();
    }
}

export function clearAllFiles() {
    selectedFiles = [];
    if (filePreviewsContainer) {
        filePreviewsContainer.innerHTML = '';
    }
    toggleSendButton();
}

export function getSelectedFiles() {
    return [...selectedFiles];
}

function createFilePreview(file, index) {
    if (!filePreviewsContainer) return;
    
    const index = selectedFiles.length - 1;
    const previewDiv = document.createElement('div');
    previewDiv.className = 'file-preview-item';
    previewDiv.setAttribute('data-index', index);
    
    const fileType = getFileType(file);
    const icon = getFileIcon(fileType);
    const size = formatFileSize(file.size);
    
    previewDiv.innerHTML = `
        <div class="file-preview-icon">${icon}</div>
        <div class="file-preview-info">
            <div class="file-preview-name">${escapeHtml(file.name)}</div>
            <div class="file-preview-size">${size}</div>
        </div>
        <button class="file-preview-remove" data-index="${index}">
            <img src="svg-icons/close.svg" width="14" height="14">
        </button>
    `;
    
    // Rasm uchun thumbnail
    if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = previewDiv.querySelector('.file-preview-icon');
            if (img) {
                img.innerHTML = `<img src="${e.target.result}" style="width:32px; height:32px; object-fit:cover; border-radius:8px;">`;
            }
        };
        reader.readAsDataURL(file);
    }
    
    // Audio uchun icon
    if (fileType === 'audio') {
        const audio = previewDiv.querySelector('.file-preview-icon');
        if (audio) {
            audio.innerHTML = `<img src="svg-icons/mic.svg" width="24" height="24">`;
        }
    }
    
    // Video uchun icon
    if (fileType === 'video') {
        const video = previewDiv.querySelector('.file-preview-icon');
        if (video) {
        }
    }
    
    const removeBtn = previewDiv.querySelector('.file-preview-remove');
    removeBtn.onclick = () => removeFile(index);
    
    filePreviewsContainer.appendChild(previewDiv);
}

function getFileType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
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

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function toggleSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    
    if (sendBtn && voiceBtn) {
        if (selectedFiles.length > 0) {
            sendBtn.style.display = 'flex';
            voiceBtn.style.display = 'none';
        } else {
            const msgInput = document.getElementById('msgInput');
            const hasText = msgInput && msgInput.value.trim().length > 0;
            if (!hasText) {
                sendBtn.style.display = 'none';
                voiceBtn.style.display = 'flex';
            }
        }
    }
}
}
