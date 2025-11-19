class AudioManager {
    constructor() {
        this.enabled = false;
        this.lang = 'en';
        this.currentAudio = null;
        this.audioQueue = [];
        this.isPlaying = false;
        
        // Initialize Howler for SFX and Ambient
        this.sounds = {
            click: new Howl({
                src: ['audio/click.wav'],
                volume: 0.4
            }),
            hover: new Howl({
                src: ['audio/hover.wav'],
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
        if (this.enabled) {
            // Resume ambient if it was playing
            if (this.sounds.ambient && !this.sounds.ambient.playing()) {
                this.sounds.ambient.play();
            }
            // Resume queue if paused
            if (this.audioQueue.length > 0 && !this.isPlaying) {
                this.processQueue();
            }
        } else {
            this.stop(); // Stops speech and clears queue
            if (this.sounds.ambient) {
                this.sounds.ambient.stop();
            }
        }
        return this.enabled;
    }

    async speak(text, clearQueue = false) {
        if (!this.enabled || !text) return;

        if (clearQueue) {
            this.stop();
        }

        this.audioQueue.push(text);
        if (!this.isPlaying) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const text = this.audioQueue.shift();

        try {
            // Use OpenAI TTS via our backend
            // 'fable' is better for storytelling in English
            // 'onyx' or 'shimmer' are better for Japanese storytelling than 'nova'
            const voice = this.lang === 'ja' ? 'onyx' : 'fable';
            
            const response = await fetch('/storypath-api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            });

            if (!response.ok) throw new Error('TTS request failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            this.currentAudio = new Audio(url);
            
            // Wait for audio to end before processing next
            await new Promise((resolve) => {
                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    this.currentAudio = null;
                    resolve();
                };
                this.currentAudio.onerror = () => {
                    console.error('Audio playback error');
                    resolve(); // Skip to next on error
                };
                this.currentAudio.play().catch(e => {
                    console.error('Play error:', e);
                    resolve();
                });
            });

        } catch (error) {
            console.error('TTS Error:', error);
            // Fallback to Web Speech API if backend fails
            await this.speakFallback(text);
        }

        // Process next item
        if (this.enabled) {
            this.processQueue();
        } else {
            this.isPlaying = false;
        }
    }

    speakFallback(text) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang === 'ja' ? 'ja-JP' : 'en-US';
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.speak(utterance);
        });
    }

    stop() {
        this.audioQueue = [];
        this.isPlaying = false;
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        window.speechSynthesis.cancel();
    }

    playSfx(name) {
        if (!this.enabled) return;

        if (this.sounds[name]) {
            // Stop if already playing to allow rapid re-triggering
            this.sounds[name].stop();
            this.sounds[name].play();
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
