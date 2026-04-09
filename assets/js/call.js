// assets/call/call.js

import { db } from "./config/firebase-config.js";
import { rtdb } from "./config/firebase-config.js";
import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, arrayUnion, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let localStream = null;
let peerConnection = null;
let currentCallId = null;
let callUnsubscribe = null;
let ringtoneOut = null;
let ringtoneIn = null;
let remoteAudio = null;
let localVideoEl = null;
let remoteVideoEl = null;
let isVideoEnabled = true;
let isMicMuted = false;
let isSpeakerMuted = false;
let isCallActive = false;
let currentTargetUser = null;
let animationInterval = null;
let currentTargetUserId = null;
let currentStatus = 'waiting';
let callStartTime = null;
let callDurationInterval = null;

let toggleVideoBtn = null;
let endCallBtn = null;
let acceptCallBtn = null;
let rejectCallBtn = null;
let toggleMicBtn = null;
let toggleSpeakerBtn = null;
let screenshotBtn = null;
let switchCameraBtn = null;
let callDurationEl = null;
let incomingCallDiv = null;
let callContainer = null;
let callStatusText = null;
let callTargetAvatar = null;
let callTargetName = null;

const RINGTONE_OUT_URL = "assets/sounds/call-out.mp3";
const RINGTONE_IN_URL = "assets/sounds/call-in.mp3";
const TARMOQDA_EMAS_URL = "assets/sounds/tarmoqda_emas.mp3";
const BAND_URL = "assets/sounds/band.mp3";
const ABONENT_STOP_URL = "assets/sounds/abonent-stop.mp3";
const RED_BTN_URL = "assets/sounds/red-btn.mp3";

const ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function initCallElements() {
    callContainer = document.getElementById('callContainer');
    localVideoEl = document.getElementById('localVideo');
    remoteVideoEl = document.getElementById('remoteVideo');
    toggleVideoBtn = document.getElementById('toggleVideoBtn');
    endCallBtn = document.getElementById('endCallBtn');
    acceptCallBtn = document.getElementById('acceptCallBtn');
    rejectCallBtn = document.getElementById('rejectCallBtn');
    toggleMicBtn = document.getElementById('toggleMicBtn');
    toggleSpeakerBtn = document.getElementById('toggleSpeakerBtn');
    screenshotBtn = document.getElementById('screenshotBtn');
    switchCameraBtn = document.getElementById('switchCameraBtn');
    callDurationEl = document.getElementById('callDuration');
    incomingCallDiv = document.getElementById('incomingCallDiv');
    callStatusText = document.getElementById('callStatusText');
    callTargetAvatar = document.getElementById('callTargetAvatar');
    callTargetName = document.getElementById('callTargetName');
    
    if (endCallBtn) {
        endCallBtn.innerHTML = `<img src="svg-icons/end-call.svg" width="56" height="56">`;
        endCallBtn.style.background = 'transparent';
        endCallBtn.style.border = 'none';
        endCallBtn.style.cursor = 'pointer';
        endCallBtn.onclick = () => { endCallWithSound(); };
    }
    if (toggleVideoBtn) {
        toggleVideoBtn.innerHTML = `<img src="svg-icons/camera.svg" width="36" height="36">`;
        toggleVideoBtn.onclick = () => toggleVideo();
    }
    if (toggleMicBtn) {
        toggleMicBtn.innerHTML = `<img src="svg-icons/mic.svg" width="36" height="36">`;
        toggleMicBtn.onclick = () => toggleMicrophone();
    }
    if (toggleSpeakerBtn) {
        toggleSpeakerBtn.innerHTML = `<img src="svg-icons/volume-up.svg" width="36" height="36">`;
        toggleSpeakerBtn.onclick = () => toggleSpeaker();
    }
    if (screenshotBtn) {
        screenshotBtn.innerHTML = `<img src="svg-icons/camera.svg" width="36" height="36">`;
        screenshotBtn.onclick = () => takeScreenshot();
    }
    if (switchCameraBtn) {
        switchCameraBtn.innerHTML = `<img src="svg-icons/switch-camera.svg" width="36" height="36">`;
        switchCameraBtn.onclick = () => switchCamera();
    }
    if (acceptCallBtn) {
        acceptCallBtn.innerHTML = `<img src="svg-icons/accept-call.svg" width="56" height="56">`;
        acceptCallBtn.onclick = () => {
            if (window.pendingCallId) {
                acceptCall(window.pendingCallId, window.currentUserId);
            }
        };
    }
    if (rejectCallBtn) {
        rejectCallBtn.innerHTML = `<img src="svg-icons/end-call.svg" width="56" height="56">`;
        rejectCallBtn.onclick = () => {
            if (window.pendingCallId) {
                rejectCall(window.pendingCallId);
            }
        };
    }
}

function playSound(url, loop = false) {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.play().catch(e => console.log("Ovoz xatosi:", url, e));
    return audio;
}

async function checkUserOnline(userId) {
    return new Promise((resolve) => {
        const userStatusRef = ref(rtdb, `status/${userId}/state`);
        onValue(userStatusRef, (snapshot) => {
            const status = snapshot.val();
            resolve(status === "online");
        }, { onlyOnce: true });
    });
}

async function isUserBusy(userId) {
    const callsRef = collection(db, "calls");
    const q = query(callsRef, where("callee", "==", userId), where("status", "in", ["calling", "active"]));
    const q2 = query(callsRef, where("caller", "==", userId), where("status", "in", ["calling", "active"]));
    const snapshot = await getDocs(q);
    const snapshot2 = await getDocs(q2);
    return !snapshot.empty || !snapshot2.empty;
}

function startWaitingAnimation() {
    let dots = 0;
    if (animationInterval) clearInterval(animationInterval);
    animationInterval = setInterval(() => {
        if (callStatusText && callStatusText.innerText.includes("Kutilmoqda")) {
            dots = (dots + 1) % 4;
            callStatusText.innerText = `Kutilmoqda${".".repeat(dots)}`;
        } else if (callStatusText && callStatusText.innerText.includes("Band")) {
            dots = (dots + 1) % 4;
            callStatusText.innerText = `Band${".".repeat(dots)}`;
        } else if (callStatusText && callStatusText.innerText.includes("Abonent tarmoqda emas")) {
            dots = (dots + 1) % 4;
            callStatusText.innerText = `Abonent tarmoqda emas${".".repeat(dots)}`;
        }
    }, 500);
}

function stopAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
}

function updateCallUI(targetUser, status, isVideo) {
    if (callTargetName) {
        callTargetName.innerText = targetUser.name || targetUser.username;
    }
    if (callTargetAvatar) {
        if (targetUser.photoURL && targetUser.photoURL !== "") {
            callTargetAvatar.src = targetUser.photoURL;
            callTargetAvatar.style.display = 'block';
        } else {
            callTargetAvatar.style.display = 'none';
        }
    }
    if (callStatusText) {
        callStatusText.innerText = status;
    }
    if (callContainer) {
        callContainer.style.display = 'flex';
    }
    if (localVideoEl) {
        localVideoEl.style.display = (isVideo && localStream) ? 'block' : 'none';
    }
}

function startCallDuration() {
    callStartTime = Date.now();
    if (callDurationInterval) clearInterval(callDurationInterval);
    callDurationInterval = setInterval(() => {
        if (!isCallActive) return;
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        if (callDurationEl) {
            callDurationEl.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }
        if (callStatusText && isCallActive) {
            callStatusText.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }
    }, 1000);
}

function stopCallDuration() {
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
    if (callDurationEl) {
        callDurationEl.innerText = "00:00";
    }
}

async function endCallWithSound() {
    if (isCallActive) {
        if (currentCallId) {
            await updateDoc(doc(db, "calls", currentCallId), { status: "ended" }).catch(()=>{});
        }
        playSound(ABONENT_STOP_URL, false);
        setTimeout(() => endCall(), 500);
    } else {
        playSound(ABONENT_STOP_URL, false);
        setTimeout(() => endCall(), 500);
    }
}

async function createPeerConnection(isCaller, callId, targetId, isVideo) {
    peerConnection = new RTCPeerConnection(ICE_CONFIG);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await updateDoc(doc(db, "calls", callId), { iceCandidates: arrayUnion(event.candidate.toJSON()) });
        }
    };
    
    peerConnection.ontrack = (event) => {
        if (event.streams[0].getVideoTracks().length > 0 && remoteVideoEl) {
            remoteVideoEl.srcObject = event.streams[0];
        } else if (!remoteAudio) {
            remoteAudio = new Audio();
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
            remoteAudio.srcObject = event.streams[0];
            if (isSpeakerMuted && remoteAudio) {
                remoteAudio.volume = 0;
            }
        }
    };
    
    if (!isCaller) {
        const callSnap = await getDoc(doc(db, "calls", callId));
        const data = callSnap.data();
        if (data?.offer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await updateDoc(doc(db, "calls", callId), { answer: { type: answer.type, sdp: answer.sdp } });
        }
    }
    
    onSnapshot(doc(db, "calls", callId), async (snap) => {
        const data = snap.data();
        if (data?.iceCandidates && peerConnection) {
            for (let cand of data.iceCandidates) {
                try { await peerConnection.addIceCandidate(new RTCIceCandidate(cand)); } catch(e) {}
            }
        }
    });
}

function toggleMicrophone() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isMicMuted = !isMicMuted;
        audioTrack.enabled = !isMicMuted;
        if (toggleMicBtn) {
            toggleMicBtn.innerHTML = isMicMuted 
                ? `<img src="svg-icons/mic-off.svg" width="36" height="36">`
                : `<img src="svg-icons/mic.svg" width="36" height="36">`;
        }
    }
}

function toggleSpeaker() {
    isSpeakerMuted = !isSpeakerMuted;
    if (remoteAudio) {
        remoteAudio.volume = isSpeakerMuted ? 0 : 1;
    }
    if (toggleSpeakerBtn) {
        toggleSpeakerBtn.innerHTML = isSpeakerMuted 
            ? `<img src="svg-icons/volume-off.svg" width="36" height="36">`
            : `<img src="svg-icons/volume-up.svg" width="36" height="36">`;
    }
}

function toggleVideo() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        if (toggleVideoBtn) {
            toggleVideoBtn.innerHTML = isVideoEnabled 
                ? `<img src="svg-icons/camera.svg" width="36" height="36">`
                : `<img src="svg-icons/camera-off.svg" width="36" height="36">`;
        }
    }
}

async function takeScreenshot() {
    if (!remoteVideoEl || !remoteVideoEl.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = remoteVideoEl.videoWidth;
    canvas.height = remoteVideoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(remoteVideoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screenshot_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

let currentCamera = 'user';
async function switchCamera() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        currentCamera = currentCamera === 'user' ? 'environment' : 'user';
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: { facingMode: { exact: currentCamera } }
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = videoTrack;
            localStream.removeTrack(oldVideoTrack);
            localStream.addTrack(newVideoTrack);
            oldVideoTrack.stop();
            if (localVideoEl) {
                localVideoEl.srcObject = localStream;
            }
            const sender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        } catch (err) {
            console.error("Camera switch failed:", err);
        }
    }
}

function playRingtoneOut() {
    if (ringtoneOut) ringtoneOut.pause();
    ringtoneOut = new Audio(RINGTONE_OUT_URL);
    ringtoneOut.loop = true;
    ringtoneOut.play().catch(e => console.log("Ringtone out xatosi:", e));
}

function stopRingtoneOut() {
    if (ringtoneOut) { ringtoneOut.pause(); ringtoneOut = null; }
}

function playRingtoneIn() {
    if (ringtoneIn) ringtoneIn.pause();
    ringtoneIn = new Audio(RINGTONE_IN_URL);
    ringtoneIn.loop = true;
    ringtoneIn.play().catch(e => console.log("Ringtone in xatosi:", e));
}

function stopRingtoneIn() {
    if (ringtoneIn) { ringtoneIn.pause(); ringtoneIn = null; }
}

export async function startCall(targetUserId, currentUserId, isVideo = false) {
    if (isCallActive) return;
    currentTargetUserId = targetUserId;
    const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
    if (!targetUserDoc.exists()) {
        updateCallUI({ name: targetUserId }, "Abonent mavjud emas", isVideo);
        playSound(TARMOQDA_EMAS_URL, false);
        setTimeout(() => endCall(), 3000);
        return;
    }
    currentTargetUser = targetUserDoc.data();
    updateCallUI(currentTargetUser, "Kutilmoqda", isVideo);
    startWaitingAnimation();
    
    setTimeout(async () => {
        if (isCallActive) return;
        const isOnline = await checkUserOnline(targetUserId);
        if (!isOnline) {
            stopAnimation();
            updateCallUI(currentTargetUser, "Abonent tarmoqda emas", isVideo);
            playSound(TARMOQDA_EMAS_URL, false);
            setTimeout(() => endCall(), 3000);
            return;
        }
        const isBusy = await isUserBusy(targetUserId);
        if (isBusy) {
            stopAnimation();
            updateCallUI(currentTargetUser, "Band", isVideo);
            playSound(BAND_URL, false);
            setTimeout(() => endCall(), 3000);
            return;
        }
        stopAnimation();
        updateCallUI(currentTargetUser, "Chaqirmoqda...", isVideo);
        playRingtoneOut();
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
            if (isVideo && localVideoEl) localVideoEl.srcObject = localStream;
            const callId = `call_${currentUserId}_${targetUserId}_${Date.now()}`;
            currentCallId = callId;
            await setDoc(doc(db, "calls", callId), {
                caller: currentUserId, callee: targetUserId, status: "calling",
                isVideo: isVideo, createdAt: new Date(), offer: null, answer: null, iceCandidates: []
            });
            await createPeerConnection(true, callId, targetUserId, isVideo);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            await updateDoc(doc(db, "calls", callId), { offer: { type: offer.type, sdp: offer.sdp } });
            callUnsubscribe = onSnapshot(doc(db, "calls", callId), (snap) => {
                const data = snap.data();
                if (data?.answer && peerConnection && !peerConnection.currentRemoteDescription) {
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    stopRingtoneOut();
                    isCallActive = true;
                    startCallDuration();
                }
                if (data?.status === "rejected") {
                    stopRingtoneOut();
                    updateCallUI(currentTargetUser, "Rad etildi", isVideo);
                    playSound(ABONENT_STOP_URL, false);
                    setTimeout(() => endCall(), 2000);
                }
                if (data?.status === "ended") {
                    stopRingtoneOut();
                    endCall();
                }
            });
        } catch (err) {
            alert("Mikrofon/kamera ruxsati kerak!");
            endCall();
        }
    }, 3000);
}

export function listenForIncomingCalls(currentUserId, onIncomingCall) {
    window.currentUserId = currentUserId;
    const q = query(collection(db, "calls"), where("callee", "==", currentUserId), where("status", "==", "calling"));
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const callData = change.doc.data();
                const callerDoc = await getDoc(doc(db, "users", callData.caller));
                const callerData = callerDoc.data();
                playRingtoneIn();
                window.pendingCallId = change.doc.id;
                if (incomingCallDiv) {
                    incomingCallDiv.style.display = 'block';
                    const incomingName = document.getElementById('incomingCallName');
                    if (incomingName) {
                        incomingName.innerHTML = `<img src="svg-icons/phone.svg" width="20" height="20" style="margin-right:8px">${callerData?.name || callData.caller}`;
                    }
                }
                onIncomingCall(callData.caller, change.doc.id, callData.isVideo);
            }
        });
    });
}

export async function acceptCall(callId, currentUserId) {
    stopRingtoneIn();
    const callDoc = doc(db, "calls", callId);
    const snap = await getDoc(callDoc);
    const callData = snap.data();
    if (!callData) return;
    const callerDoc = await getDoc(doc(db, "users", callData.caller));
    currentTargetUser = callerDoc.data();
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callData.isVideo });
        if (callData.isVideo && localVideoEl) localVideoEl.srcObject = localStream;
        await createPeerConnection(false, callId, callData.caller, callData.isVideo);
        await updateDoc(callDoc, { status: "active" });
        isCallActive = true;
        startCallDuration();
        if (incomingCallDiv) incomingCallDiv.style.display = 'none';
        window.pendingCallId = null;
    } catch (err) {
        alert("Mikrofon/kamera ruxsati kerak!");
        endCall();
    }
}

export function rejectCall(callId) {
    playSound(RED_BTN_URL, false);
    stopRingtoneIn();
    updateDoc(doc(db, "calls", callId), { status: "rejected" });
    if (incomingCallDiv) incomingCallDiv.style.display = 'none';
    window.pendingCallId = null;
}

export async function endCall() {
    stopAnimation();
    stopRingtoneOut();
    stopRingtoneIn();
    stopCallDuration();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    if (currentCallId) await deleteDoc(doc(db, "calls", currentCallId)).catch(()=>{});
    if (callUnsubscribe) callUnsubscribe();
    if (remoteAudio) remoteAudio.srcObject = null;
    if (localVideoEl) localVideoEl.srcObject = null;
    if (remoteVideoEl) remoteVideoEl.srcObject = null;
    localStream = null; peerConnection = null; currentCallId = null;
    isCallActive = false;
    isMicMuted = false;
    isSpeakerMuted = false;
    isVideoEnabled = true;
    if (callContainer) callContainer.style.display = 'none';
    if (toggleMicBtn) toggleMicBtn.innerHTML = `<img src="svg-icons/mic.svg" width="36" height="36">`;
    if (toggleVideoBtn) toggleVideoBtn.innerHTML = `<img src="svg-icons/camera.svg" width="36" height="36">`;
    if (toggleSpeakerBtn) toggleSpeakerBtn.innerHTML = `<img src="svg-icons/volume-up.svg" width="36" height="36">`;
}
