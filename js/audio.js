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

        // Add to queue as pending
        this.audioQueue.push({
            text: text,
            status: 'pending',
            promise: null
        });

        // Trigger processing
        if (!this.isPlaying) {
            this.processQueue();
        }
        
        // Trigger lookahead fetching
        this.manageBuffer();
    }

    // Manages the lookahead buffer (pre-fetching)
    manageBuffer() {
        if (!this.enabled) return;

        // Find items that are pending and start fetching them
        // Limit concurrency to avoid flooding network (e.g., max 3 parallel fetches)
        let activeFetches = this.audioQueue.filter(item => item.status === 'fetching').length;
        const maxFetches = 3;

        for (const item of this.audioQueue) {
            if (activeFetches >= maxFetches) break;

            if (item.status === 'pending') {
                item.status = 'fetching';
                item.promise = this.fetchAudio(item.text).catch(err => {
                    console.error('Fetch failed for:', item.text.substring(0, 20), err);
                    return null;
                });
                activeFetches++;
            }
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
        
        // Ensure the next item is being fetched (if it wasn't caught by manageBuffer)
        this.manageBuffer();
        
        const item = this.audioQueue[0]; // Peek first

        try {
            // If not fetching yet, force start (should happen in manageBuffer but safety check)
            if (item.status === 'pending') {
                item.status = 'fetching';
                item.promise = this.fetchAudio(item.text).catch(err => null);
            }

            // Wait for the pre-fetched audio
            const blob = await item.promise;

            // Check if stopped/cleared while fetching
            if (this.playbackId !== currentId || !this.enabled) {
                return;
            }

            // Remove from queue NOW, before playing, so next item becomes index 0
            this.audioQueue.shift();
            
            // Trigger fetch for NEXT items now that a slot is free
            this.manageBuffer();

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
             // If error, ensure we remove the item so we don't get stuck
             if (this.audioQueue[0] === item) {
                 this.audioQueue.shift();
             }
        }

        // Check again before continuing
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
