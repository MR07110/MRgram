// assets/js/ui-helpers.js

export function showToast(msg) {
    let toast = document.getElementById('customToast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.style.cssText = 'position:fixed; bottom:100px; left:20px; right:20px; background:#1c1c1e; color:white; text-align:center; padding:14px; border-radius:30px; z-index:10000; backdrop-filter:blur(20px); border:1px solid var(--accent); transition:0.3s; opacity:0;';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

export function escapeHtml(str) {
    if(!str) return "";
    return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

export function viewFullImage(src) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:100000; display:flex; align-items:center; justify-content:center; cursor:pointer;';
    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.borderRadius = '24px';
    img.style.objectFit = 'contain';
    modal.appendChild(img);
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

// ========== SMART AVATAR (HASH DAN RANG) ==========
export function getAvatarColorFromUsername(username) {
    if (!username) return 'hsl(200, 65%, 35%)';
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash;
    }
    
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 35%)`;
}

export function getAvatarInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

export function getSmartAvatarHTML(name, username, photoURL = null) {
    if (photoURL && photoURL !== "") {
        return `<img src="${photoURL}" class="avatar-img" onerror="this.style.display='none'; this.parentElement.style.background='${getAvatarColorFromUsername(username)}'; this.parentElement.innerHTML='<span class=\'avatar-span\'>${getAvatarInitial(name)}</span>';">`;
    }
    
    const bgColor = getAvatarColorFromUsername(username);
    const initial = getAvatarInitial(name);
    
    return `<span class="avatar-span" style="background: ${bgColor};">${initial}</span>`;
}
