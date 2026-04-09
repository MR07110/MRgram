// assets/group/group.js

import { db } from "./config/firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./ui-helpers.js";

export async function createGroup(ownerId, groupName, description = "", photoURL = null) {
    if (!groupName || groupName.trim() === "") {
        showToast("Guruh nomini kiriting");
        return null;
    }
    try {
        const docRef = await addDoc(collection(db, "groups"), {
            name: groupName.trim(),
            description: description,
            admin: ownerId,
            creator: ownerId,
            members: [ownerId],
            createdAt: new Date().toISOString(),
            type: 'group',
            photoURL: photoURL,
            messageCount: 0,
            memberCount: 1
        });
        showToast("✅ Guruh yaratildi!");
        return docRef.id;
    } catch (e) {
        console.error("Guruh yaratish xatosi:", e);
        showToast("❌ Xatolik: " + e.message);
        return null;
    }
}

export async function getGroup(groupId) {
    try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
            return { id: groupDoc.id, ...groupDoc.data() };
        }
        return null;
    } catch (error) {
        console.error("Guruh ma'lumotlarini olish xatosi:", error);
        return null;
    }
}

export async function addMemberToGroup(groupId, userId, adminId) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (group.admin !== adminId && group.creator !== adminId) {
            showToast("❌ Faqat guruh admini a'zo qo'sha oladi");
            return false;
        }
        if (group.members.includes(userId)) {
            showToast("Bu foydalanuvchi allaqachon guruhda");
            return false;
        }
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, {
            members: arrayUnion(userId),
            memberCount: (group.memberCount || group.members.length) + 1
        });
        showToast("👤 Foydalanuvchi guruhga qo'shildi");
        return true;
    } catch (error) {
        console.error("A'zo qo'shish xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}

export async function removeMemberFromGroup(groupId, userId, adminId) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (userId !== adminId && group.admin !== adminId && group.creator !== adminId) {
            showToast("❌ Faqat guruh admini a'zoni o'chira oladi");
            return false;
        }
        if (userId === group.admin) {
            showToast("❌ Adminni o'chirishdan oldin boshqa admin tayinlang");
            return false;
        }
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, {
            members: arrayRemove(userId),
            memberCount: (group.memberCount || group.members.length) - 1
        });
        showToast("👤 Foydalanuvchi guruhdan chiqarildi");
        return true;
    } catch (error) {
        console.error("A'zoni o'chirish xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}

export async function leaveGroup(groupId, userId) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (userId === group.admin) {
            showToast("❌ Admin guruhdan chiqishdan oldin boshqa admin tayinlang");
            return false;
        }
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, {
            members: arrayRemove(userId),
            memberCount: (group.memberCount || group.members.length) - 1
        });
        showToast("🚪 Guruhdan chiqdingiz");
        return true;
    } catch (error) {
        console.error("Guruhdan chiqish xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}

export async function deleteGroup(groupId, userId) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (group.admin !== userId && group.creator !== userId) {
            showToast("❌ Faqat guruh admini o'chira oladi");
            return false;
        }
        const messagesRef = collection(db, "chats", groupId, "messages");
        const messagesSnap = await getDocs(messagesRef);
        const deletePromises = [];
        messagesSnap.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
        await deleteDoc(doc(db, "groups", groupId));
        showToast("✅ Guruh o'chirildi");
        return true;
    } catch (error) {
        console.error("Guruh o'chirish xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}

export async function loadUserGroups(userId, onGroupClick = null) {
    try {
        const q = query(collection(db, "groups"), where("members", "array-contains", userId));
        const querySnapshot = await getDocs(q);
        const groups = [];
        querySnapshot.forEach(doc => {
            groups.push({ id: doc.id, ...doc.data() });
        });
        const groupsList = document.getElementById('groupsList');
        if (groupsList) {
            groupsList.innerHTML = '';
            if (groups.length === 0) {
                groupsList.innerHTML = '<div class="empty-state">👥 Siz hech qanday guruhda emassiz</div>';
            } else {
                groups.forEach(group => {
                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'user-card';
                    let avatarHtml = '';
                    if (group.photoURL) {
                        avatarHtml = `<img src="${group.photoURL}" class="avatar-img">`;
                    } else {
                        avatarHtml = `<span>👥</span>`;
                    }
                    groupDiv.innerHTML = `
                        <div class="avatar" style="background:#28a745">${avatarHtml}</div>
                        <div class="user-info">
                            <b>${group.name}</b>
                            <br>
                            <small style="opacity:0.6">${group.memberCount || group.members.length} a'zo</small>
                        </div>
                    `;
                    groupDiv.onclick = () => {
                        if (onGroupClick) {
                            onGroupClick(group);
                        } else {
                            const event = new CustomEvent('openChat', { detail: { name: group.name, id: group.id, type: 'group' } });
                            document.dispatchEvent(event);
                        }
                    };
                    groupsList.appendChild(groupDiv);
                });
            }
        }
        return groups;
    } catch (error) {
        console.error("Guruhlarni yuklash xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return [];
    }
}

export async function changeGroupAdmin(groupId, newAdminId, currentAdminId) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (group.admin !== currentAdminId && group.creator !== currentAdminId) {
            showToast("❌ Faqat guruh admini o'zgartira oladi");
            return false;
        }
        if (!group.members.includes(newAdminId)) {
            showToast("❌ Yangi admin guruh a'zosi bo'lishi kerak");
            return false;
        }
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, { admin: newAdminId });
        showToast("👑 Admin o'zgartirildi");
        return true;
    } catch (error) {
        console.error("Admin o'zgartirish xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}

export async function updateGroupInfo(groupId, userId, updates) {
    try {
        const group = await getGroup(groupId);
        if (!group) {
            showToast("Guruh topilmadi");
            return false;
        }
        if (group.admin !== userId && group.creator !== userId) {
            showToast("❌ Faqat guruh admini yangilay oladi");
            return false;
        }
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, updates);
        showToast("✅ Guruh ma'lumotlari yangilandi");
        return true;
    } catch (error) {
        console.error("Guruh yangilash xatosi:", error);
        showToast("❌ Xatolik: " + error.message);
        return false;
    }
}
