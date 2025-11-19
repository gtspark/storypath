class AudioManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.enabled = false;
        this.currentVoice = null;
        this.lang = 'en';
        
        // Initialize Howler for SFX
        this.sounds = {
            click: new Howl({
                src: ['https://assets.codepen.io/21542/click.mp3'], // Placeholder
                volume: 0.5
            }),
            hover: new Howl({
                src: ['https://assets.codepen.io/21542/hover.mp3'], // Placeholder
                volume: 0.2
            }),
            ambient: null // Will be set based on genre
        };

        // Load voices
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
        this.loadVoices();
    }

    loadVoices() {
        this.voices = this.synth.getVoices();
        this.setVoiceForLang(this.lang);
    }

    setLanguage(lang) {
        this.lang = lang;
        this.setVoiceForLang(lang);
    }

    setVoiceForLang(lang) {
        // Try to find a good voice for the language
        const langCode = lang === 'ja' ? 'ja-JP' : 'en-US';
        
        // Prefer Google voices or high quality ones
        this.currentVoice = this.voices.find(v => v.lang === langCode && v.name.includes('Google')) 
            || this.voices.find(v => v.lang === langCode)
            || this.voices[0];
            
        console.log(`🗣️ Voice set to: ${this.currentVoice ? this.currentVoice.name : 'Default'}`);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stop();
        }
        return this.enabled;
    }

    speak(text) {
        if (!this.enabled || !text) return;

        // Cancel current speech
        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.currentVoice) {
            utterance.voice = this.currentVoice;
        }
        
        utterance.lang = this.lang === 'ja' ? 'ja-JP' : 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        this.synth.speak(utterance);
    }

    stop() {
        this.synth.cancel();
    }

    playSfx(name) {
        if (this.sounds[name]) {
            this.sounds[name].play();
        }
    }
    
    playAmbient(genre) {
        // Stop previous ambient
        if (this.sounds.ambient) {
            this.sounds.ambient.fade(0.5, 0, 1000);
            setTimeout(() => this.sounds.ambient.stop(), 1000);
        }
        
        // Map genre to ambient sound (placeholders for now)
        // In a real app, these would be local files
        const ambientUrls = {
            fantasy: 'https://assets.codepen.io/21542/fantasy_ambience.mp3',
            scifi: 'https://assets.codepen.io/21542/scifi_ambience.mp3',
            mystery: 'https://assets.codepen.io/21542/mystery_ambience.mp3',
            horror: 'https://assets.codepen.io/21542/horror_ambience.mp3',
            adventure: 'https://assets.codepen.io/21542/adventure_ambience.mp3'
        };
        
        if (ambientUrls[genre]) {
            this.sounds.ambient = new Howl({
                src: [ambientUrls[genre]],
                html5: true, // Use HTML5 Audio for long files
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
