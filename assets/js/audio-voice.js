// assets/js/audio-voice.js

let currentPlayer = null;
let currentPlayerMsg = null;
let animationId = null;

export function createPlayer(audioUrl, title, fileSize, type = 'audio', isMe = false) {
    const playerDiv = document.createElement('div');
    playerDiv.className = `av-player ${isMe ? 'me-player' : 'them-player'}`;
    
    const formattedSize = formatFileSize(fileSize);
    const iconSvg = type === 'audio' ? 'document.svg' : 'microphone.svg';
    const displayTitle = type === 'audio' ? title : 'Ovozli xabar';
    
    playerDiv.innerHTML = `
        <div class="av-play-btn">
            <div class="av-wave av-wave-1"></div>
            <div class="av-wave av-wave-2"></div>
            <div class="av-wave av-wave-3"></div>
            <img src="svg-icons/play.svg" class="play-icon" width="28" height="28">
        </div>
        <div class="av-info">
            <div class="av-title">${escapeHtml(displayTitle)}</div>
            <div class="av-progress-wrapper">
                <div class="av-progress-bar">
                    <div class="av-progress-fill" style="width: 0%"></div>
                    <div class="av-progress-slider" style="left: 0%"></div>
                </div>
                <div class="av-time">
                    <span class="av-current-time">0:00</span>
                    <span class="av-duration">0:00</span>
                </div>
            </div>
            <div class="av-footer">
                <img src="svg-icons/${iconSvg}" class="av-icon">
                <span class="av-size">${formattedSize}</span>
            </div>
        </div>
    `;
    
    const playBtn = playerDiv.querySelector('.av-play-btn');
    const playIcon = playBtn.querySelector('.play-icon');
    const footerIcon = playerDiv.querySelector('.av-icon');
    const waves = playerDiv.querySelectorAll('.av-wave');
    const progressFill = playerDiv.querySelector('.av-progress-fill');
    const progressSlider = playerDiv.querySelector('.av-progress-slider');
    const progressBar = playerDiv.querySelector('.av-progress-bar');
    const currentTimeSpan = playerDiv.querySelector('.av-current-time');
    const durationSpan = playerDiv.querySelector('.av-duration');
    
    let audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    
    let isPlaying = false;
    let isDragging = false;
    
    // ========== ORQA FONGA QARAB SVG RANGINI O'ZGARTIRISH ==========
    function updateIconColors() {
        if (isMe) {
            playIcon.style.filter = 'brightness(0) invert(1)';
            if (footerIcon) footerIcon.style.filter = 'brightness(0) invert(1)';
        } else {
            playIcon.style.filter = 'brightness(0) saturate(100%) invert(47%) sepia(91%) saturate(1680%) hue-rotate(178deg) brightness(95%) contrast(101%)';
            if (footerIcon) footerIcon.style.filter = 'brightness(0) saturate(100%) invert(47%) sepia(91%) saturate(1680%) hue-rotate(178deg) brightness(95%) contrast(101%)';
        }
    }
    
    // Web Audio API o'zgaruvchilari
    let audioCtx = null;
    let analyser = null;
    let source = null;
    let dataArray = null;

    // Visualizer funksiyasi (Siri to'lqinlari)
    function startVisualizer() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            analyser.fftSize = 64;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }

        function animate() {
            if (!isPlaying) {
                waves.forEach(w => {
                    w.style.transform = 'translate(-50%, -50%) scale(1)';
                    w.style.opacity = '0';
                });
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            let average = sum / dataArray.length;
            
            let scaleBase = 1 + (average / 120);
            
            waves.forEach((wave, index) => {
                let s = scaleBase + (index * 0.35);
                let op = (average / 255) * (1 - index * 0.3);
                wave.style.transform = `translate(-50%, -50%) scale(${s})`;
                wave.style.opacity = Math.max(0, Math.min(0.6, op));
            });

            animationId = requestAnimationFrame(animate);
        }
        animate();
    }

    audio.addEventListener('loadedmetadata', () => {
        if (audio.duration) {
            durationSpan.textContent = formatTime(audio.duration);
        }
    });
    
    audio.addEventListener('timeupdate', () => {
        if (!isDragging && audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            updateProgress(percent);
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }
    });

    function updateProgress(percent) {
        progressFill.style.width = `${percent}%`;
        progressSlider.style.left = `${percent}%`;
    }

    playBtn.onclick = (e) => {
        e.stopPropagation();
        
        if (currentPlayer && currentPlayer !== audio) {
            stopAllPlayers();
        }
        
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            playIcon.src = 'svg-icons/play.svg';
            playerDiv.classList.remove('playing');
            if (animationId) cancelAnimationFrame(animationId);
            waves.forEach(w => {
                w.style.transform = 'translate(-50%, -50%) scale(1)';
                w.style.opacity = '0';
            });
        } else {
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            audio.play().then(() => {
                isPlaying = true;
                playIcon.src = 'svg-icons/pause.svg';
                playerDiv.classList.add('playing');
                currentPlayer = audio;
                currentPlayerMsg = playerDiv;
                startVisualizer();
            }).catch(err => console.error("Audio ijro etilmadi:", err));
        }
    };

    progressBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleSeek(e);
        document.addEventListener('mousemove', handleSeek);
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleSeek);
        }, { once: true });
    });
    
    progressBar.addEventListener('touchstart', (e) => {
        isDragging = true;
        handleSeek(e);
        document.addEventListener('touchmove', handleSeek);
        document.addEventListener('touchend', () => {
            isDragging = false;
            document.removeEventListener('touchmove', handleSeek);
        }, { once: true });
    });

    function handleSeek(e) {
        const rect = progressBar.getBoundingClientRect();
        let clientX = e.clientX;
        if (e.touches) clientX = e.touches[0].clientX;
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = (x / rect.width) * 100;
        updateProgress(percent);
        if (audio.duration) {
            audio.currentTime = (percent / 100) * audio.duration;
            currentTimeSpan.textContent = formatTime(audio.currentTime);
        }
    }

    audio.addEventListener('ended', () => {
        isPlaying = false;
        playIcon.src = 'svg-icons/play.svg';
        playerDiv.classList.remove('playing');
        updateProgress(0);
        currentTimeSpan.textContent = '0:00';
        if (animationId) cancelAnimationFrame(animationId);
        waves.forEach(w => {
            w.style.transform = 'translate(-50%, -50%) scale(1)';
            w.style.opacity = '0';
        });
    });
    
    updateIconColors();
    
    return playerDiv;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function stopAllPlayers() {
    if (currentPlayer) {
        currentPlayer.pause();
        if (currentPlayerMsg) {
            const icon = currentPlayerMsg.querySelector('.play-icon');
            if (icon) icon.src = 'svg-icons/play.svg';
            currentPlayerMsg.classList.remove('playing');
            
            const waves = currentPlayerMsg.querySelectorAll('.av-wave');
            waves.forEach(w => {
                w.style.transform = 'translate(-50%, -50%) scale(1)';
                w.style.opacity = '0';
            });
        }
        if (animationId) cancelAnimationFrame(animationId);
        currentPlayer = null;
        currentPlayerMsg = null;
    }
}
