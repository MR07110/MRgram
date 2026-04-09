// assets/contacts/contacts.js

import { db } from "./config/firebase-config.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from "./ui-helpers.js";

export async function getContacts(uid) {
    const contactSnap = await getDoc(doc(db, "users", uid, "contacts", "list"));
    return contactSnap.exists() ? contactSnap.data().uids || [] : [];
}

export async function addContact(uid, targetUid) {
    const contactRef = doc(db, "users", uid, "contacts", "list");
    const snap = await getDoc(contactRef);
    if(snap.exists()) {
        const current = snap.data().uids || [];
        if(!current.includes(targetUid)) {
            await updateDoc(contactRef, { uids: arrayUnion(targetUid) });
            showToast("Kontaktga qo'shildi");
            return true;
        } else {
            showToast("Bu foydalanuvchi allaqachon kontaktlarda");
            return false;
        }
    } else {
        await updateDoc(contactRef, { uids: [targetUid] });
        showToast("Kontaktga qo'shildi");
        return true;
    }
}

export async function removeContact(uid, targetUid) {
    const contactRef = doc(db, "users", uid, "contacts", "list");
    await updateDoc(contactRef, { uids: arrayRemove(targetUid) });
    showToast("Kontakt o'chirildi");
}
