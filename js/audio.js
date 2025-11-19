class AudioManager {
    constructor() {
        this.enabled = false;
        this.lang = 'en';
        this.currentAudio = null;
        
        // Initialize Howler for SFX
        this.sounds = {
            click: new Howl({
                src: ['audio/click.ogg'],
                volume: 0.4
            }),
            hover: new Howl({
                src: ['audio/hover.ogg'],
                volume: 0.2
            }),
            ambient: null
        };
    }

    setLanguage(lang) {
        this.lang = lang;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stop();
            if (this.sounds.ambient) {
                this.sounds.ambient.stop();
            }
        } else {
            // Resume ambient if it was playing
            if (this.sounds.ambient && !this.sounds.ambient.playing()) {
                this.sounds.ambient.play();
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

    playSfx(name) {
        if (!this.enabled) return;

        if (this.sounds[name]) {
            this.sounds[name].play();
        }
    }
    
    playAmbient(genre) {
        if (!this.enabled) return;

        // Stop previous ambient
        if (this.sounds.ambient) {
            this.sounds.ambient.fade(0.5, 0, 1000);
            setTimeout(() => this.sounds.ambient.stop(), 1000);
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
                volume: 0.3
            });
            
            this.sounds.ambient.play();
            this.sounds.ambient.fade(0, 0.3, 2000);
        }
    }
}

// Export instance
window.audioManager = new AudioManager();
