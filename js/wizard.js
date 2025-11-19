const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
let currentStep = 1;
const storyData = {
    genre: null,
    difficulty: 'balanced',
    maturity_level: 'kids',
    protagonist_name: '',
    protagonist_gender: 'nonbinary',
    protagonist_archetype: 'explorer',
    story_seed: '',
    language: currentLang || 'en',  // Default to current UI language
    password: ''
};

// Genre-specific archetypes
const archetypesByGenre = {
    fantasy: ['warrior', 'mage', 'rogue', 'cleric', 'ranger'],
    scifi: ['soldier', 'engineer', 'diplomat', 'hacker', 'pilot'],
    mystery: ['detective', 'journalist', 'researcher', 'amateur_sleuth', 'consultant'],
    adventure: ['explorer', 'archaeologist', 'treasure_hunter', 'guide', 'mercenary'],
    horror: ['survivor', 'investigator', 'skeptic', 'medium', 'scientist']
};

const archetypeTranslations = {
    en: {
        // Fantasy
        warrior: 'Warrior', mage: 'Mage', rogue: 'Rogue', cleric: 'Cleric', ranger: 'Ranger',
        // Sci-Fi
        soldier: 'Soldier', engineer: 'Engineer', diplomat: 'Diplomat', hacker: 'Hacker', pilot: 'Pilot',
        // Mystery
        detective: 'Detective', journalist: 'Journalist', researcher: 'Researcher',
        amateur_sleuth: 'Amateur Sleuth', consultant: 'Consultant',
        // Adventure
        explorer: 'Explorer', archaeologist: 'Archaeologist', treasure_hunter: 'Treasure Hunter',
        guide: 'Guide', mercenary: 'Mercenary',
        // Horror
        survivor: 'Survivor', investigator: 'Investigator', skeptic: 'Skeptic',
        medium: 'Medium', scientist: 'Scientist'
    },
    ja: {
        // Fantasy
        warrior: '戦士', mage: '魔法使い', rogue: '盗賊', cleric: '僧侶', ranger: 'レンジャー',
        // Sci-Fi
        soldier: '兵士', engineer: 'エンジニア', diplomat: '外交官', hacker: 'ハッカー', pilot: 'パイロット',
        // Mystery
        detective: '探偵', journalist: 'ジャーナリスト', researcher: '研究者',
        amateur_sleuth: 'アマチュア探偵', consultant: 'コンサルタント',
        // Adventure
        explorer: '探検家', archaeologist: '考古学者', treasure_hunter: 'トレジャーハンター',
        guide: 'ガイド', mercenary: '傭兵',
        // Horror
        survivor: '生存者', investigator: '調査員', skeptic: '懐疑論者',
        medium: '霊媒師', scientist: '科学者'
    }
};

function updateArchetypes() {
    const select = document.getElementById('protagonistArchetype');
    const archetypes = archetypesByGenre[storyData.genre] || archetypesByGenre.adventure;
    const lang = currentLang || 'en';

    select.innerHTML = '';
    archetypes.forEach(archetype => {
        const option = document.createElement('option');
        option.value = archetype;
        option.textContent = archetypeTranslations[lang][archetype];
        select.appendChild(option);
    });

    storyData.protagonist_archetype = archetypes[0];
}

function selectGenre(genre) {
    storyData.genre = genre;

    document.querySelectorAll('.genre-card').forEach(card => {
        card.classList.remove('selected');
    });

    document.querySelector(`[data-genre="${genre}"]`).classList.add('selected');
    document.getElementById('step1Next').disabled = false;
}

function selectDifficulty(difficulty, evt) {
    storyData.difficulty = difficulty;

    // Uncheck all and remove selected class
    document.querySelectorAll('#step2 .radio-option[onclick*="selectDifficulty"]').forEach(opt => {
        opt.classList.remove('selected');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('selected');
        const radio = evt.currentTarget.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    } else {
        // Called programmatically on page load
        const option = document.querySelector(`#step2 input[name="difficulty"][value="${difficulty}"]`);
        if (option) {
            option.checked = true;
            option.closest('.radio-option').classList.add('selected');
        }
    }
}

function selectMaturity(maturity, evt) {
    console.log('selectMaturity called with:', maturity);
    storyData.maturity_level = maturity;
    console.log('storyData.maturity_level set to:', storyData.maturity_level);

    // Uncheck all and remove selected class
    document.querySelectorAll('#step2 .radio-option[onclick*="selectMaturity"]').forEach(opt => {
        opt.classList.remove('selected');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = false;
    });

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('selected');
        const radio = evt.currentTarget.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        console.log('Radio button checked:', radio.value);
    }
}

function selectStoryLanguage(lang, evt) {
    storyData.language = lang;

    document.querySelectorAll('#step4 .radio-option').forEach(opt => {
        opt.classList.remove('selected');
    });

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('selected');
        const input = evt.currentTarget.querySelector('input');
        if (input) input.checked = true;
    }
}

function togglePasswordField() {
    const enabled = document.getElementById('enablePassword').checked;
    document.getElementById('passwordFields').classList.toggle('hidden', !enabled);
}

function nextStep() {
    // Collect data from current step
    if (currentStep === 2) {
        // Populate archetypes when entering step 3
        updateArchetypes();
    }

    if (currentStep === 3) {
        storyData.protagonist_name = document.getElementById('protagonistName').value;
        storyData.protagonist_gender = document.getElementById('protagonistGender').value;
        storyData.protagonist_archetype = document.getElementById('protagonistArchetype').value;
        storyData.story_seed = document.getElementById('storySeed').value;
        // Populate language options when entering step 4
        setTimeout(() => populateLanguageOptions(), 100);
    }

    // Hide current step
    document.getElementById(`step${currentStep}`).classList.add('hidden');

    // Update step indicator
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('completed');

    // Show next step
    currentStep++;
    document.getElementById(`step${currentStep}`).classList.remove('hidden');
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
    // Hide current step
    document.getElementById(`step${currentStep}`).classList.add('hidden');

    // Update step indicator
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');

    // Show previous step
    currentStep--;
    document.getElementById(`step${currentStep}`).classList.remove('hidden');
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('completed');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function createStory() {
    // Collect final data
    if (document.getElementById('enablePassword').checked) {
        storyData.password = document.getElementById('storyPassword').value;
    }

    // Show loading screen
    document.getElementById('step5').classList.add('hidden');
    document.getElementById('loadingStep').classList.remove('hidden');

    // Initialize particles
    initLoadingParticles();

    try {
        console.log('Creating story with data:', storyData);

        // Call API to create story (returns immediately)
        const response = await fetch(`${API_URL}/story/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(storyData)
        });

        const data = await response.json();

        if (data.success && data.story_id) {
            // Story created, now poll for completion
            pollStoryStatus(data.story_id);
        } else {
            throw new Error(data.error || 'Failed to create story');
        }

    } catch (error) {
        console.error('Error creating story:', error);
        alert('Failed to create story: ' + error.message);
        // Go back to step 5
        document.getElementById('loadingStep').classList.add('hidden');
        document.getElementById('step5').classList.remove('hidden');
    }
}

// Poll for story generation completion
async function pollStoryStatus(storyId) {
    const statusMessages = currentLang === 'ja' ? {
        'generating': 'ストーリー生成を開始...',
        'arc': 'ストーリーアークを織り込んでいます...',
        'opening': 'オープニングシーンを作成中...',
        'complete': 'ストーリーの準備完了！',
        'error': '何か問題が発生しました...'
    } : {
        'generating': 'Starting story generation...',
        'arc': 'Weaving the story arc...',
        'opening': 'Crafting the opening scene...',
        'complete': 'Story ready!',
        'error': 'Something went wrong...'
    };

    let currentProgress = 0;
    let targetProgress = 0;

    // Smooth progress animation
    const smoothInterval = setInterval(() => {
        if (currentProgress < targetProgress) {
            currentProgress += (targetProgress - currentProgress) * 0.1;
            if (targetProgress - currentProgress < 1) {
                currentProgress = targetProgress;
            }
            setProgress(currentProgress);
        }
    }, 100);

    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_URL}/story/${storyId}/status`);
            const data = await response.json();

            console.log('Status poll:', data);

            // Update subtitle based on status
            if (statusMessages[data.status]) {
                document.getElementById('loadingSubtitle').textContent = statusMessages[data.status];
            }

            // Gradually increase target progress based on status
            if (data.status === 'generating') {
                targetProgress = Math.max(targetProgress, 15);
            } else if (data.status === 'arc') {
                targetProgress = Math.max(targetProgress, 60);
            } else if (data.status === 'opening') {
                targetProgress = Math.max(targetProgress, 90);
            }

            if (data.ready) {
                clearInterval(pollInterval);
                clearInterval(smoothInterval);
                targetProgress = 100;
                setProgress(100, 'Story ready!');

                // Redirect to preview
                setTimeout(() => {
                    window.location.href = `preview.html?story=${storyId}`;
                }, 500);
            } else if (data.error) {
                clearInterval(pollInterval);
                clearInterval(smoothInterval);

                // Show better error message with retry option
                const retry = confirm(
                    'Story generation failed. This is usually a temporary API issue.\n\n' +
                    'Click OK to try again, or Cancel to go back and adjust your settings.'
                );

                if (retry) {
                    // Restart the creation process
                    location.reload();
                } else {
                    document.getElementById('loadingStep').classList.add('hidden');
                    document.getElementById('step5').classList.remove('hidden');
                }
                return;
            }

        } catch (error) {
            clearInterval(pollInterval);
            clearInterval(smoothInterval);
            console.error('Error polling story status:', error);

            const retry = confirm(
                'Connection error while checking story status.\n\n' +
                'Click OK to reload and try again, or Cancel to go back.'
            );

            if (retry) {
                location.reload();
            } else {
                document.getElementById('loadingStep').classList.add('hidden');
                document.getElementById('step5').classList.remove('hidden');
            }
        }
    }, 2000); // Poll every 2 seconds
}

// Progress bar animation
function setProgress(percent, subtitle) {
    const progressBarFill = document.getElementById('progressBarFill');
    if (progressBarFill) {
        progressBarFill.style.width = percent + '%';
    }
    document.getElementById('progressText').textContent = Math.round(percent) + '%';
    if (subtitle) {
        document.getElementById('loadingSubtitle').textContent = subtitle;
    }
}


// Particle effects for loading
function initLoadingParticles() {
    if (typeof tsParticles === 'undefined') return;

    tsParticles.load("loadingParticles", {
        particles: {
            number: { value: 50 },
            color: { value: ["#ff8c42", "#667eea", "#ffd700"] },
            shape: { type: ["circle", "square"] },
            opacity: {
                value: 0.6,
                animation: {
                    enable: true,
                    speed: 1,
                    minimumValue: 0.2
                }
            },
            size: {
                value: { min: 3, max: 8 },
                animation: {
                    enable: true,
                    speed: 3,
                    minimumValue: 2
                }
            },
            move: {
                enable: true,
                speed: 2,
                direction: "top",
                random: true,
                straight: false,
                outModes: "out"
            }
        }
    });
}

function goHome() {
    window.location.href = 'index.html';
}

function switchLanguage(lang) {
    setLanguage(lang);

    document.querySelectorAll('.lang-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
}

function populateLanguageOptions() {
    console.log('populateLanguageOptions called');
    const container = document.getElementById('languageOptions');
    console.log('Container:', container);
    const uiLang = currentLang || 'en';
    console.log('UI Lang:', uiLang);

    if (!container) {
        console.error('languageOptions container not found!');
        return;
    }

    // Put current UI language first
    if (uiLang === 'ja') {
        container.innerHTML = `
            <div class="radio-option selected" onclick="selectStoryLanguage('ja', event)">
                <input type="radio" name="storyLanguage" value="ja" checked style="pointer-events: none;">
                <span class="radio-label">
                    日本語 - 日本語で語られる物語
                </span>
            </div>
            <div class="radio-option" onclick="selectStoryLanguage('en', event)">
                <input type="radio" name="storyLanguage" value="en" style="pointer-events: none;">
                <span class="radio-label">
                    English - Story narrated in English
                </span>
            </div>
        `;
        storyData.language = 'ja';
    } else {
        container.innerHTML = `
            <div class="radio-option selected" onclick="selectStoryLanguage('en', event)">
                <input type="radio" name="storyLanguage" value="en" checked style="pointer-events: none;">
                <span class="radio-label">
                    English - Story narrated in English
                </span>
            </div>
            <div class="radio-option" onclick="selectStoryLanguage('ja', event)">
                <input type="radio" name="storyLanguage" value="ja" style="pointer-events: none;">
                <span class="radio-label">
                    日本語 - 日本語で語られる物語
                </span>
            </div>
        `;
        storyData.language = 'en';
    }
    console.log('Language options populated. HTML length:', container.innerHTML.length);
}

// Set default difficulty selection
window.addEventListener('DOMContentLoaded', () => {
    selectDifficulty('balanced');
    populateLanguageOptions();

    // Sync language selector with current language from i18n.js
    const currentUILang = currentLang || 'en';
    document.querySelectorAll('.lang-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === currentUILang);
    });
});

// Also populate when entering step 4
window.addEventListener('languageChanged', () => {
    if (currentStep === 4) {
        populateLanguageOptions();
    }
});

