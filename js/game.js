const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
const urlParams = new URLSearchParams(window.location.search);
const storyId = urlParams.get('story');

let currentStory = null;
let currentScene = null;
let currentChoices = null;
let imageCheckInterval = null;

// Initialize Audio Manager
const audio = window.audioManager;

// Parse Claude's furigana format: 漢字《かんじ》 -> <ruby>漢字<rt>かんじ</rt></ruby>
function parseFurigana(text) {
    if (!text) return text;

    // If text already contains HTML ruby tags, Claude generated them directly
    if (text.includes('<ruby>') || text.includes('<rt>')) {
        let result = text;

        // When both ruby tag AND bracket exist for same kanji, use bracket reading (it's usually correct)
        // Pattern: <ruby>漢字<rt>wrong</rt></ruby>《correct》 -> <ruby>漢字<rt>correct</rt></ruby>
        result = result.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

        // Strip any remaining bracket notation
        result = result.replace(/《[^》]+》/g, '');

        // Fix nested ruby tags: <ruby><ruby>X<rt>WRONG</rt></ruby><rt>CORRECT</rt></ruby> -> <ruby>X<rt>CORRECT</rt></ruby>
        result = result.replace(/<ruby><ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby><rt>([^<]+)<\/rt><\/ruby>/g, '<ruby>$1<rt>$2</rt></ruby>');

        return result;
    }

    // Convert 漢字《かんじ》 format to HTML ruby tags (legacy format)
    return text.replace(/([一-龯々]+)《([ぁ-ん]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function normalizeJapaneseTypography(text) {
    if (!text) return text;

    const jpChar = '[ぁ-ゖァ-ヺ一-龯々〆ヵヶ]';
    let normalized = text;

    // Collapse multiple spaces into single space
    normalized = normalized.replace(/\s+/g, ' ');

    // Remove spaces between Japanese characters
    normalized = normalized.replace(new RegExp(`(${jpChar})\\s+(${jpChar})`, 'g'), '$1$2');

    // Fix gaps around dashes/hyphens: remove spaces around them
    normalized = normalized.replace(/\s*[-‐‑‒–—―]\s*/g, '—'); // Use em dash, no spaces
    
    // Fix 一 (kanji one) used as dash in vertical text - remove spaces around it
    normalized = normalized.replace(/([一-龯ぁ-ゖ])\s+一\s+([一-龯ぁ-ゖ])/g, '$1—$2');
    normalized = normalized.replace(/([一-龯ぁ-ゖ])\s+一([一-龯ぁ-ゖ])/g, '$1—$2');
    normalized = normalized.replace(/([一-龯ぁ-ゖ])一\s+([一-龯ぁ-ゖ])/g, '$1—$2');

    // Fix gaps after commas/punctuation
    normalized = normalized.replace(/([、。，．])\s+/g, '$1');

    // Fix gaps before numbers
    normalized = normalized.replace(new RegExp(`(${jpChar})\\s*([0-9])`, 'g'), '$1\u200b$2');

    // Remove accidental slashes between kana/kanji
    normalized = normalized.replace(new RegExp(`(${jpChar})\\/(${jpChar})`, 'g'), '$1$2');

    // Prevent bad line breaks in verbs
    normalized = normalized.replace(/([一-龯]+[すする])/g, '$1\u2060');
    normalized = normalized.replace(/([一-龯]+来る)/g, '$1\u2060');

    return normalized;
}

function transformNarrativeText(text) {
    if (!text) return '';
    let transformed = text;

    if (currentStory?.language === 'ja') {
        transformed = normalizeJapaneseTypography(transformed);
        transformed = parseFurigana(transformed);
    }

    return transformed;
}

// Load story on page load
async function loadStory() {
    if (!storyId) {
        alert('No story ID provided');
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/story/${storyId}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        currentStory = data.story;
        currentScene = data.current_scene;
        currentChoices = data.choices;

        // Initialize Audio Language
        if (audio) {
            audio.setLanguage(currentStory.language || 'en');
        }

        // Apply genre/maturity theme
        if (currentStory && currentStory.genre && currentStory.maturity_level) {
            const themeClass = `theme-${currentStory.genre}-${currentStory.maturity_level}`;
            document.body.classList.add(themeClass);
            console.log('🎨 Applied theme:', themeClass);
            
            // Play ambient sound if audio enabled
            // if (audio && audio.enabled) audio.playAmbient(currentStory.genre);
        }

        // Set language based on story
        if (currentStory && currentStory.language) {
            setLanguage(currentStory.language);

            // Apply vertical text for Japanese
            if (currentStory.language === 'ja') {
                document.getElementById('storyView').classList.add('ja-vertical');
                document.body.classList.add('ja-vertical-mode');
            }
        }

        // Validate data
        if (!currentScene) {
            throw new Error('No scene data received');
        }

        // Update UI
        updateStoryView();

    } catch (error) {
        console.error('Failed to load story:', error);
        alert('Failed to load story: ' + error.message);
        window.location.href = '/';
    }
}

function updateStoryView() {
    // Store scroll position to restore after update
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Update title (with furigana support)
    document.getElementById('storyTitleText').innerHTML = parseFurigana(currentStory.title);

    // Update narrative
    const narrativeHtml = formatNarrative(currentScene.narrative_text);
    document.getElementById('narrativeText').innerHTML = narrativeHtml;
    
    // Speak narrative if enabled
    if (audio && audio.enabled) {
        // Strip HTML tags for speech
        const textToSpeak = currentScene.narrative_text.replace(/<[^>]*>/g, '');
        audio.speak(textToSpeak);
    }

    // Update image only if URL changed (prevents collapse/flicker on same scene)
    const imageUrl = currentScene.image_url || '/storypath/images/placeholder-scene.png';
    const sceneImage = document.getElementById('sceneImage');
    if (sceneImage.src !== imageUrl) {
        sceneImage.src = imageUrl;
    }

    // Show loading overlay if using placeholder
    if (imageUrl && imageUrl.includes('placeholder')) {
        document.getElementById('imageLoadingOverlay').style.display = 'flex';
        // Start polling for real image
        startImagePolling();
    } else {
        document.getElementById('imageLoadingOverlay').style.display = 'none';
    }

    // Update choices
    updateChoices(currentChoices);

    // Wrap narrative and choices for vertical layout
    if (currentStory.language === 'ja') {
        const narrativePanel = document.querySelector('.narrative-panel');
        const choicesPanel = document.querySelector('.choices-panel');

        // Only wrap if not already wrapped
        if (!narrativePanel.parentElement.classList.contains('vertical-content-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'vertical-content-wrapper';
            narrativePanel.parentNode.insertBefore(wrapper, narrativePanel);
            wrapper.appendChild(choicesPanel);
            wrapper.appendChild(narrativePanel);
        }
    }

    // Update stats
    updateStats();

    // Hide loading, show content
    document.getElementById('initialLoading').classList.add('hidden');
    document.getElementById('sceneContent').classList.remove('hidden');
    document.getElementById('statsBar').style.display = 'flex';

    // Restore scroll position (prevents jumping to top on updates)
    setTimeout(() => {
        window.scrollTo(scrollX, scrollY);
    }, 0);
}

function formatNarrative(text) {
    if (!text) return '';
    // Split into paragraphs and wrap in <p> tags
    return text.split(/\n\s*\n/)
        .map(p => {
            const content = transformNarrativeText(p.trim());
            return content ? `<p>${content}</p>` : '';
        })
        .join('');
}

function updateChoices(choices) {
    const panel = document.getElementById('choicesPanel');
    panel.innerHTML = '';

    if (!choices || !Array.isArray(choices)) {
        console.error('Invalid choices:', choices);
        return;
    }

    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.setAttribute('data-choice-index', index);
        button.onclick = () => makeChoice(index);
        button.onmouseenter = () => {
            if (audio) audio.playSfx('hover');
        };

        // Support both database format (choice_text/choice_type) and AI format (text/type)
        const choiceText = choice.choice_text || choice.text || '';
        const choiceType = choice.choice_type || choice.type;
        const emoji = choice.emoji || getDefaultEmoji(choiceType);
        const displayText = transformNarrativeText(choiceText);

        button.innerHTML = `
            <span class="choice-emoji">${emoji}</span>
            <span>${displayText}</span>
        `;

        panel.appendChild(button);
    });
}

function getDefaultEmoji(type) {
    const emojis = {
        action: '⚔️',
        dialogue: '💬',
        investigate: '🔍'
    };
    return emojis[type] || '✨';
}

async function makeChoice(choiceIndex) {
    if (audio) audio.playSfx('click');

    // Store scroll position before any changes
    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;

    // Disable all choices
    document.querySelectorAll('.choice-button').forEach(btn => {
        btn.classList.add('disabled');
    });

    // Hide choices, clear narrative, add skeleton placeholders
    document.getElementById('choicesPanel').style.display = 'none';
    const narrativeText = document.getElementById('narrativeText');
    narrativeText.innerHTML = '';

    // Add 3 skeleton paragraph placeholders
    for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-paragraph';
        skeleton.dataset.index = i;
        narrativeText.appendChild(skeleton);
    }

    document.querySelector('.narrative-panel').style.display = 'block';

    try {
        const eventSource = new EventSource(`${API_URL}/story/${storyId}/choice?choice_index=${choiceIndex}`);

        let fullNarrative = '';
        let sceneMetadata = null;
        let paragraphIndex = 0;

        eventSource.addEventListener('message', (e) => {
            console.log('Received SSE:', e.data);
            const event = JSON.parse(e.data);

            if (event.type === 'paragraph') {
                // Find skeleton for this paragraph
                let skeleton = narrativeText.querySelector(`.skeleton-paragraph[data-index="${paragraphIndex}"]`);

                if (!skeleton) {
                    // If skeleton doesn't exist, create it (shouldn't happen but fallback)
                    skeleton = document.createElement('div');
                    skeleton.className = 'skeleton-paragraph';
                    skeleton.dataset.index = paragraphIndex;
                    narrativeText.appendChild(skeleton);
                }

                // Replace skeleton with actual paragraph
                const p = document.createElement('p');
                p.innerHTML = transformNarrativeText(event.text.trim());
                p.style.opacity = '0';
                // Use ink-brush animation for Japanese, typewriter for English
                const isJapanese = currentStory.language === 'ja';
                p.style.animation = isJapanese
                    ? 'inkBrushReveal 0.6s ease-out forwards'
                    : 'typewriterReveal 0.3s ease-out forwards';

                skeleton.replaceWith(p);

                fullNarrative += event.text + '\n\n';
                paragraphIndex++;

                // Proactively create skeleton for NEXT paragraph
                if (!narrativeText.querySelector(`.skeleton-paragraph[data-index="${paragraphIndex}"]`)) {
                    const nextSkeleton = document.createElement('div');
                    nextSkeleton.className = 'skeleton-paragraph';
                    nextSkeleton.dataset.index = paragraphIndex;
                    narrativeText.appendChild(nextSkeleton);
                }
            } else if (event.type === 'metadata') {
                sceneMetadata = event.data;

                // Remove any remaining skeletons
                narrativeText.querySelectorAll('.skeleton-paragraph').forEach(s => s.remove());

                // Close connection
                eventSource.close();

                // Update current scene
                currentScene = {
                    scene_number: sceneMetadata.scene_number,
                    narrative_text: fullNarrative.trim(),
                    image_url: sceneMetadata.image_url
                };

                // Store choices
                currentChoices = sceneMetadata.choices;

                // Update story state
                if (sceneMetadata.state_changes) {
                    if (sceneMetadata.state_changes.hp_delta) {
                        currentStory.hp += sceneMetadata.state_changes.hp_delta;
                    }
                }

                currentStory.current_scene_number = sceneMetadata.scene_number;

                // Remove min-height
                narrativeText.style.minHeight = '';

                // Show choices and update full view
                document.getElementById('choicesPanel').style.display = 'flex';
                updateStoryView();

                // Restore scroll position after scene loads
                setTimeout(() => {
                    window.scrollTo(savedScrollX, savedScrollY);
                }, 50);
            }
        });

        eventSource.addEventListener('error', (e) => {
            console.error('SSE error:', e);
            eventSource.close();
            alert('Failed to process choice. Please try again.');

            // Re-enable choices
            document.querySelectorAll('.choice-button').forEach(btn => {
                btn.classList.remove('disabled');
            });
        });

    } catch (error) {
        console.error('Failed to process choice:', error);
        alert('Failed to process choice: ' + error.message);

        // Re-enable choices
        document.querySelectorAll('.choice-button').forEach(btn => {
            btn.classList.remove('disabled');
        });

        document.getElementById('choicesPanel').style.display = 'flex';
    }
}

function updateStats() {
    document.getElementById('statHP').textContent = `${currentStory.hp}/${currentStory.max_hp}`;
    document.getElementById('statScene').textContent = currentStory.current_scene_number;

    // Parse stats
    const stats = currentStory.stats ? JSON.parse(currentStory.stats) : {};
    const inventory = currentStory.inventory ? JSON.parse(currentStory.inventory) : [];

    document.getElementById('statItems').textContent = `${inventory.length} ${inventory.length === 1 ? 'item' : 'items'}`;

    // Karma
    const karma = stats.karma || 0;
    let karmaText = 'Neutral';
    if (karma > 30) karmaText = 'Good';
    else if (karma > 60) karmaText = 'Heroic';
    else if (karma < -30) karmaText = 'Dark';
    else if (karma < -60) karmaText = 'Villainous';

    document.getElementById('statKarma').textContent = karmaText;
}

function startImagePolling() {
    if (imageCheckInterval) {
        clearInterval(imageCheckInterval);
    }

    imageCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_URL}/story/${storyId}/image/${currentStory.current_scene_number}`);
            const data = await response.json();

            if (data.ready && data.url) {
                document.getElementById('sceneImage').src = data.url;
                clearInterval(imageCheckInterval);
            }
        } catch (error) {
            console.error('Image check failed:', error);
        }
    }, 3000); // Check every 3 seconds
}

function imageLoaded() {
    const img = document.getElementById('sceneImage');
    if (!img.src.includes('placeholder')) {
        document.getElementById('imageLoadingOverlay').style.display = 'none';
        if (imageCheckInterval) {
            clearInterval(imageCheckInterval);
        }
    }
}

function showMenu() {
    alert('Menu feature coming soon!');
}

function showHistory() {
    window.open(`history.html?story=${storyId}`, '_blank');
}

function goHome() {
    if (confirm('Are you sure you want to leave this story?')) {
        window.location.href = 'index.html';
    }
}

function toggleAudio() {
    if (audio) {
        const isEnabled = audio.toggle();
        const btn = document.getElementById('audioToggle');
        btn.textContent = isEnabled ? '🔊' : '🔇';
        btn.classList.toggle('active', isEnabled);
        
        if (isEnabled && currentStory) {
            // audio.playAmbient(currentStory.genre);
        }
    }
}

// Check for curtain reveal on load
function checkCurtainReveal() {
    console.log('🎭 Checking for curtain data...');
    const curtainData = sessionStorage.getItem('showCurtain');
    console.log('🎭 Curtain data found:', curtainData);
    if (curtainData) {
        sessionStorage.removeItem('showCurtain');
        const { genre, maturity } = JSON.parse(curtainData);
        console.log('🎭 Showing curtain for:', genre, maturity);
        showGameCurtain(genre, maturity);
    } else {
        console.log('🎭 No curtain data, removing black screen immediately');
        const blackScreen = document.getElementById('theatricalBlack');
        if (blackScreen) blackScreen.remove();
    }
}

function showGameCurtain(genre, maturity) {
    // Get genre-appropriate curtain colors
    const curtainColors = {
        fantasy: { kids: ['#ff69b4', '#9c27b0', '#e1bee7'], adult: ['#8b0000', '#ff4500', '#ffd700'] },
        scifi: { kids: ['#00ffff', '#00aaff', '#0088cc'], adult: ['#00ff00', '#00aa00', '#006600'] },
        mystery: { kids: ['#ff9800', '#ffc107', '#ffeb3b'], adult: ['#6c757d', '#495057', '#343a40'] },
        horror: { kids: ['#4a148c', '#6a1b9a', '#8e24aa'], adult: ['#8b0000', '#ff0000', '#4d0000'] },
        adventure: { kids: ['#ffc107', '#ff9800', '#f57c00'], adult: ['#795548', '#6d4c41', '#5d4037'] }
    };

    const colors = curtainColors[genre]?.[maturity] || ['#667eea', '#764ba2', '#f093fb'];

    // Stage lights gradient
    const stageLightsHTML = `
        <div id="stageLights" class="stage-lights"></div>
    `;

    // Create curtain overlay
    const curtainHTML = `
        <div class="curtain-container" data-genre="${genre}" data-maturity="${maturity}">
            <div class="curtain-inner">
                ${[...Array(10)].map(() => '<div class="curtain-strip"></div>').join('')}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', stageLightsHTML);
    document.body.insertAdjacentHTML('beforeend', curtainHTML);

    const stageLights = document.getElementById('stageLights');
    const curtainContainer = document.querySelector('.curtain-container:last-of-type');
    const strips = curtainContainer.querySelectorAll('.curtain-strip');
    const blackScreen = document.getElementById('theatricalBlack');

    // Apply genre colors to strips via inline style (dynamic colors)
    strips.forEach((strip, i) => {
        const colorIndex = i % colors.length;
        strip.style.background = `repeating-linear-gradient(to left,
            ${colors[colorIndex]} 4vw,
            ${colors[(colorIndex + 1) % colors.length]} 8vw,
            ${colors[(colorIndex + 2) % colors.length]} 10vw)`;
    });

    // Theatrical sequence
    setTimeout(() => {
        // 1. Fade in stage lights
        stageLights.classList.add('active');

        // 2. Quickly fade in curtain
        setTimeout(() => {
            curtainContainer.classList.add('visible');

            // Remove black screen once curtain is visible
            setTimeout(() => {
                if (blackScreen) blackScreen.remove();
            }, 500);
        }, 400);

        // 3. Open curtain
        setTimeout(() => {
            curtainContainer.classList.add('opening');

            // 4. Fade out stage lights as curtain opens
            stageLights.classList.remove('active');

            // Remove curtain and lights after animation completes
            setTimeout(() => {
                curtainContainer.remove();
                stageLights.remove();
            }, 2500);
        }, 1200);
    }, 100);
}

// Load story on page load
window.addEventListener('load', () => {
    // Check and create curtain FIRST (synchronously) before loading story
    checkCurtainReveal();
    // Then load story content
    loadStory();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (imageCheckInterval) {
        clearInterval(imageCheckInterval);
    }
});
