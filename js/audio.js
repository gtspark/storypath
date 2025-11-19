class AudioManager {
    constructor() {
        this.enabled = false;
        this.lang = 'en';
        this.currentAudio = null;
        this.audioContext = null;
        
        // Initialize Howler for Ambient only
        this.sounds = {
            ambient: null
        };
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    setLanguage(lang) {
        this.lang = lang;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.initAudioContext();
            // Resume ambient if it was playing
            if (this.sounds.ambient && !this.sounds.ambient.playing()) {
                this.sounds.ambient.play();
            }
        } else {
            this.stop();
            if (this.sounds.ambient) {
                this.sounds.ambient.stop();
            }
        }
        return this.enabled;
    }

    async speak(text) {
        if (!this.enabled || !text) return;

        // Cancel current speech
        this.stop();

        try {
            // Use OpenAI TTS via our backend
            const voice = this.lang === 'ja' ? 'nova' : 'alloy'; // 'nova' is good for Japanese
            
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            });

            if (!response.ok) throw new Error('TTS request failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            this.currentAudio = new Audio(url);
            this.currentAudio.play();
            
            this.currentAudio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
            };

        } catch (error) {
            console.error('TTS Error:', error);
            // Fallback to Web Speech API if backend fails
            this.speakFallback(text);
        }
    }

    speakFallback(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang === 'ja' ? 'ja-JP' : 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        window.speechSynthesis.cancel();
    }

    playBeep(frequency, type, duration, volume = 0.1) {
        if (!this.enabled) return;
        this.initAudioContext();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playSfx(name) {
        if (!this.enabled) return;

        if (name === 'click') {
            // High pitched short beep
            this.playBeep(800, 'sine', 0.1, 0.1);
        } else if (name === 'hover') {
            // Lower pitched very short beep
            this.playBeep(400, 'sine', 0.05, 0.05);
        }
    }
    
    playAmbient(genre) {
        if (!this.enabled) return;

        // Stop previous ambient
        if (this.sounds.ambient) {
            this.sounds.ambient.fade(0.5, 0, 1000);
            setTimeout(() => {
                if (this.sounds.ambient) this.sounds.ambient.stop();
            }, 1000);
        }
        
        // Map genre to local ambient sound
        const ambientFiles = {
            fantasy: 'audio/ambient-fantasy.ogg',
            scifi: 'audio/ambient-scifi.ogg',
            mystery: 'audio/ambient-mystery.ogg',
            horror: 'audio/ambient-horror.ogg',
            adventure: 'audio/ambient-adventure.ogg'
        };
        
        if (ambientFiles[genre]) {
            this.sounds.ambient = new Howl({
                src: [ambientFiles[genre]],
                html5: true,
                loop: true,
                volume: 0.3,
                onloaderror: (id, err) => console.warn('Ambient load error:', err)
            });
            
            this.sounds.ambient.play();
            this.sounds.ambient.fade(0, 0.3, 2000);
        }
    }
}

// Export instance
window.audioManager = new AudioManager();
