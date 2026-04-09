// assets/js/tabs.js

import { db } from "./config/firebase-config.js";
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, getAvatarColorFromUsername, getAvatarInitial } from "./ui-helpers.js";

let me = null;
let dbInstance = null;

export function initTabs(user, database) {
    me = user;
    dbInstance = database;
    renderList();
}

async function getMyContacts() {
    const contactSnap = await getDoc(doc(dbInstance, "users", me.uid, "contacts", "list"));
    return contactSnap.exists() ? contactSnap.data().uids || [] : [];
}

export async function addToContacts(targetUid, event) {
    if(event) event.stopPropagation();
    const contactRef = doc(dbInstance, "users", me.uid, "contacts", "list");
    const snap = await getDoc(contactRef);
    
    if(snap.exists()) {
        const current = snap.data().uids || [];
        if(!current.includes(targetUid)) {
            await updateDoc(contactRef, { uids: arrayUnion(targetUid) });
            showToast("Kontaktga qo'shildi");
        } else { 
            showToast("Bu foydalanuvchi allaqachon kontaktlarda"); 
        }
    } else { 
        await setDoc(contactRef, { uids: [targetUid] });
        showToast("Kontaktga qo'shildi");
    }
    renderList();
}

export async function deleteUser(uid, event) {
    event.stopPropagation();
    if(confirm("Foydalanuvchini butunlay o'chirilsinmi?")) {
        await deleteDoc(doc(dbInstance, "users", uid));
        showToast("Foydalanuvchi o'chirildi");
        renderList();
    }
}

export async function renderList() {
    const myContacts = await getMyContacts();
    onSnapshot(collection(dbInstance, "users"), (snap) => {
        const area = document.getElementById('listArea');
        if(!area) return;
        area.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            if(u.uid === me.uid) return;
            const isContact = myContacts.includes(u.uid);
            if(isContact) {
                const card = document.createElement('div');
                card.className = 'user-card';
                
                // SMART AVATAR
                let avatarHtml = '';
                if (u.photoURL && u.photoURL !== "") {
                    const bgColor = getAvatarColorFromUsername(u.username);
                    avatarHtml = `<img src="${u.photoURL}" class="avatar-img" onerror="this.style.display='none'; this.parentElement.style.background='${bgColor}'; this.parentElement.innerHTML='<span class=\'avatar-span\'>${getAvatarInitial(u.name)}</span>';">`;
                } else {
                    const bgColor = getAvatarColorFromUsername(u.username);
                    avatarHtml = `<span class="avatar-span" style="background: ${bgColor};">${getAvatarInitial(u.name)}</span>`;
                }
                
                card.innerHTML = `
                    <div class="avatar" style="background: ${u.photoURL ? 'transparent' : getAvatarColorFromUsername(u.username)}">${avatarHtml}</div>
                    <div class="user-info"><b>${u.name || u.username}</b><br><small style="opacity:0.4">@${u.username}</small></div>
                    <div class="hover-actions">
                        ${me.isAdmin ? `<button class="hover-admin-del-btn" data-uid="${u.uid}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg> O'chirish</button>` : ''}
                    </div>
                `;
                
                const delBtn = card.querySelector('.hover-admin-del-btn');
                if(delBtn) delBtn.onclick = (e) => deleteUser(delBtn.dataset.uid, e);
                
                card.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON' && !e.target.closest('.hover-admin-del-btn')) {
                        const event = new CustomEvent('openChat', { detail: u });
                        document.dispatchEvent(event);
                    }
                };
                area.appendChild(card);
            }
        });
    });
}
