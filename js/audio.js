class AudioManager {
    constructor() {
        this.enabled = false;
        this.lang = 'en';
        this.currentAudio = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.playbackId = 0; // To track invalidation
        
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

        // Start fetching IMMEDIATELY
        // We store the promise in the queue, not the text
        const promise = this.fetchAudio(text).catch(err => {
            console.error('Fetch failed for:', text.substring(0, 20), err);
            return null;
        });

        this.audioQueue.push({
            text: text,
            promise: promise
        });

        if (!this.isPlaying) {
            this.processQueue();
        }
    }

    async fetchAudio(text) {
        // 'fable' is better for storytelling in English
        // 'onyx' or 'shimmer' are better for Japanese storytelling than 'nova'
        const voice = this.lang === 'ja' ? 'onyx' : 'fable';
        
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice })
        });

        if (!response.ok) throw new Error('TTS request failed');
        return await response.blob();
    }

    async processQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const currentId = this.playbackId;
        const item = this.audioQueue.shift();

        try {
            // Wait for the pre-fetched audio
            const blob = await item.promise;

            // Check if stopped/cleared while fetching
            if (this.playbackId !== currentId || !this.enabled) {
                return;
            }

            if (!blob) {
                // Fetch failed, use fallback
                await this.speakFallback(item.text);
            } else {
                const url = URL.createObjectURL(blob);
                this.currentAudio = new Audio(url);
                
                await new Promise((resolve) => {
                    this.currentAudio.onended = () => {
                        URL.revokeObjectURL(url);
                        this.currentAudio = null;
                        resolve();
                    };
                    this.currentAudio.onerror = () => {
                        console.warn('Audio playback error');
                        resolve();
                    };
                    this.currentAudio.play().catch(e => {
                         console.warn('Play failed', e);
                         resolve();
                    });
                });
            }

        } catch (err) {
            console.error('Queue processing error:', err);
        }

        // Check again before continuing (in case stop() was called during playback)
        if (this.playbackId === currentId && this.enabled) {
            this.processQueue();
        } else {
            if (this.playbackId === currentId) this.isPlaying = false;
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
        this.playbackId++; // Invalidate pending operations
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
