// assets/js/voice.js

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingInterval = null;
let animationFrame = null;
let audioContext = null;
let analyser = null;
let stream = null;
let onVoiceReadyCallback = null;

export function initVoice(voiceBtnElement, onVoiceReady) {
if (!voiceBtnElement) return;
onVoiceReadyCallback = onVoiceReady;
voiceBtnElement.addEventListener("click", () => {
if (isRecording) stopRecording(); else startRecording();
});
}

async function startRecording() {
try {
stream = await navigator.mediaDevices.getUserMedia({ audio: true });
audioContext = new (window.AudioContext || window.webkitAudioContext)();
analyser = audioContext.createAnalyser();
analyser.fftSize = 64;
let source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);
let dataArray = new Uint8Array(analyser.frequencyBinCount);
mediaRecorder = new MediaRecorder(stream);
audioChunks = [];
mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
mediaRecorder.start();
isRecording = true;

let voiceBtn = document.querySelector(".voice-inline-btn");
let inputWrapper = document.querySelector(".voice-input-wrapper");
let recordingPanel = document.getElementById("recordingStatusInline");
let lockWrapper = document.getElementById("lockWrapperInline");

if (voiceBtn) {
voiceBtn.classList.add("recording");
voiceBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="12" height="16" rx="2"/><line x1="12" y1="12" x2="12" y2="16" stroke="white" stroke-width="2"/></svg>`;
}
if (inputWrapper) inputWrapper.style.display = "none";
if (recordingPanel) recordingPanel.classList.add("active");
if (lockWrapper) lockWrapper.classList.add("visible");

recordingStartTime = Date.now();
startTimer();
startVolumeAnimation(analyser, dataArray);
} catch(e) { alert("Mikrofon ruxsati kerak!"); }
}

function startTimer() {
if (recordingInterval) clearInterval(recordingInterval);
recordingInterval = setInterval(() => {
if (!isRecording) return;
let e = Math.floor((Date.now() - recordingStartTime) / 1000);
let m = Math.floor(e / 60);
let s = e % 60;
let t = document.getElementById("recordingTimerInline");
if (t) t.innerText = m + ":" + (s < 10 ? "0" + s : s);
}, 1000);
}

function startVolumeAnimation(a, d) {
function draw() {
if (!isRecording || !a) return;
a.getByteFrequencyData(d);
let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i];
let avg = sum / d.length;
let btn = document.querySelector(".voice-inline-btn");
if (btn) {
if (avg < 30) btn.setAttribute("data-level", "low");
else if (avg < 80) btn.setAttribute("data-level", "medium");
else btn.setAttribute("data-level", "high");
}
let w = document.getElementById("recordingWaveformInline");
if (w) {
w.innerHTML = "";
for (let i = 0; i < 14; i++) {
let h = Math.max(3, (d[i % d.length] / 255) * 20);
let bar = document.createElement("div");
bar.className = "wave-bar";
bar.style.height = h + "px";
w.appendChild(bar);
}
}
animationFrame = requestAnimationFrame(draw);
}
if (animationFrame) cancelAnimationFrame(animationFrame);
draw();
}

function stopRecording(send = true) {
if (!mediaRecorder || !isRecording) { resetUI(); return; }
mediaRecorder.onstop = async () => {
if (send && onVoiceReadyCallback) {
let blob = new Blob(audioChunks, { type: "audio/webm" });
onVoiceReadyCallback(blob);
}
if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
if (audioContext) { await audioContext.close(); audioContext = null; }
if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
resetUI();
};
if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
}

function resetUI() {
isRecording = false;
let btn = document.querySelector(".voice-inline-btn");
let wrap = document.querySelector(".voice-input-wrapper");
let panel = document.getElementById("recordingStatusInline");
let lock = document.getElementById("lockWrapperInline");
let icon = document.getElementById("lockIconInline");
let wave = document.getElementById("recordingWaveformInline");
let timer = document.getElementById("recordingTimerInline");
if (btn) {
btn.classList.remove("recording");
btn.removeAttribute("data-level");
btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
}
if (wrap) wrap.style.display = "flex";
if (panel) panel.classList.remove("active");
if (lock) lock.classList.remove("visible");
if (icon) icon.classList.remove("active");
if (wave) wave.innerHTML = "";
if (timer) timer.innerText = "0:00";
}

export function stopAllVoice() {
if (isRecording && mediaRecorder && mediaRecorder.state === "recording") stopRecording(false);
}

window.cancelVoiceRecording = () => { stopRecording(false); };
window.sendVoiceRecording = () => { stopRecording(true); };

