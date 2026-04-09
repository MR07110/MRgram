// assets/js/voice-message.js

let currentVoice = null;
let currentVoiceMsg = null;

export function createVoiceMessage(audioUrl, duration, fileSize, isMe = false) {
    const voiceDiv = document.createElement('div');
    voiceDiv.className = `voice-message ${isMe ? 'me-voice' : 'them-voice'}`;
    
    const formattedSize = formatFileSize(fileSize);
    const totalSeconds = duration || 0;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalSecondsRemain = Math.floor(totalSeconds % 60);
    const totalTimeStr = `${totalMinutes}:${totalSecondsRemain.toString().padStart(2, '0')}`;
    
    voiceDiv.innerHTML = `
        <div class="voice-play-btn">
            <img src="svg-icons/play.svg" class="play-icon" width="18" height="18">
        </div>
        <div class="voice-info">
            <div class="voice-title">Ovozli xabar</div>
            <div class="voice-progress-wrapper">
                <div class="voice-progress-bar">
                    <div class="voice-progress-fill" style="width: 0%"></div>
                    <div class="voice-progress-slider" style="left: 0%"></div>
                </div>
                <div class="voice-time">
                    <span class="voice-current-time">0:00</span>
                    <span class="voice-duration">${totalTimeStr}</span>
                </div>
            </div>
            <div class="voice-footer">
                <img src="svg-icons/microphone.svg" class="voice-icon" width="12" height="12">
                <span class="voice-size">${formattedSize}</span>
            </div>
        </div>
    `;
    
    const playBtn = voiceDiv.querySelector('.voice-play-btn');
    const playIcon = playBtn.querySelector('.play-icon');
    const progressFill = voiceDiv.querySelector('.voice-progress-fill');
    const progressSlider = voiceDiv.querySelector('.voice-progress-slider');
    const progressBar = voiceDiv.querySelector('.voice-progress-bar');
    const currentTimeSpan = voiceDiv.querySelector('.voice-current-time');
    const durationSpan = voiceDiv.querySelector('.voice-duration');
    
    let audio = new Audio(audioUrl);
    let isPlaying = false;
    let isDragging = false;
    
    audio.addEventListener('loadedmetadata', () => {
        if (!duration && audio.duration) {
            const mins = Math.floor(audio.duration / 60);
            const secs = Math.floor(audio.duration % 60);
            durationSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    });
    
    audio.addEventListener('timeupdate', () => {
        if (!isDragging && audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            updateProgress(percent);
            
            const mins = Math.floor(audio.currentTime / 60);
            const secs = Math.floor(audio.currentTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    });
    
    function updateProgress(percent) {
        progressFill.style.width = `${percent}%`;
        progressSlider.style.left = `${percent}%`;
    }
    
    function getPercentFromEvent(e) {
        const rect = progressBar.getBoundingClientRect();
        let clientX;
        if (e.touches) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        return (x / rect.width) * 100;
    }
    
    function setAudioProgress(percent) {
        if (audio.duration && !isNaN(audio.duration)) {
            const newTime = (percent / 100) * audio.duration;
            audio.currentTime = newTime;
            updateProgress(percent);
            
            const mins = Math.floor(newTime / 60);
            const secs = Math.floor(newTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    const onMouseMove = (e) => {
        e.preventDefault();
        const percent = getPercentFromEvent(e);
        updateProgress(percent);
        if (audio.duration) {
            const newTime = (percent / 100) * audio.duration;
            const mins = Math.floor(newTime / 60);
            const secs = Math.floor(newTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    };
    
    const onMouseUp = (e) => {
        isDragging = false;
        const percent = getPercentFromEvent(e);
        setAudioProgress(percent);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    const onMouseDown = (e) => {
        e.preventDefault();
        isDragging = true;
        const percent = getPercentFromEvent(e);
        setAudioProgress(percent);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    const onTouchMove = (e) => {
        e.preventDefault();
        const percent = getPercentFromEvent(e);
        updateProgress(percent);
        if (audio.duration) {
            const newTime = (percent / 100) * audio.duration;
            const mins = Math.floor(newTime / 60);
            const secs = Math.floor(newTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    };
    
    const onTouchEnd = (e) => {
        isDragging = false;
        const percent = getPercentFromEvent(e);
        setAudioProgress(percent);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };
    
    const onTouchStart = (e) => {
        e.preventDefault();
        isDragging = true;
        const percent = getPercentFromEvent(e);
        setAudioProgress(percent);
        document.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onTouchEnd);
    };
    
    progressBar.addEventListener('mousedown', onMouseDown);
    progressBar.addEventListener('touchstart', onTouchStart);
    
    audio.addEventListener('ended', () => {
        isPlaying = false;
        playIcon.src = 'svg-icons/play.svg';
        voiceDiv.classList.remove('playing');
        updateProgress(0);
        currentTimeSpan.textContent = '0:00';
        if (currentVoice === audio) {
            currentVoice = null;
            currentVoiceMsg = null;
        }
    });
    
    playBtn.onclick = (e) => {
        e.stopPropagation();
        
        if (currentVoice && currentVoice !== audio) {
            currentVoice.pause();
            if (currentVoiceMsg) {
                const oldIcon = currentVoiceMsg.querySelector('.play-icon');
                if (oldIcon) oldIcon.src = 'svg-icons/play.svg';
                currentVoiceMsg.classList.remove('playing');
            }
        }
        
        if (isPlaying) {
            audio.pause();
            playIcon.src = 'svg-icons/play.svg';
            voiceDiv.classList.remove('playing');
            isPlaying = false;
            currentVoice = null;
            currentVoiceMsg = null;
        } else {
            audio.play();
            playIcon.src = 'svg-icons/pause.svg';
            voiceDiv.classList.add('playing');
            isPlaying = true;
            currentVoice = audio;
            currentVoiceMsg = voiceDiv;
        }
    };
    
    return voiceDiv;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function stopAllVoiceMessages() {
    if (currentVoice) {
        currentVoice.pause();
        if (currentVoiceMsg) {
            const icon = currentVoiceMsg.querySelector('.play-icon');
            if (icon) icon.src = 'svg-icons/play.svg';
            currentVoiceMsg.classList.remove('playing');
        }
        currentVoice = null;
        currentVoiceMsg = null;
    }
}
