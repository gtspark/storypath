const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
let currentStoryToUnlock = null;

// Load stories on page load
async function loadStories() {
    try {
        const response = await fetch(`${API_URL}/stories`);
        const data = await response.json();

        const container = document.getElementById('booksContainer');
        container.innerHTML = '';

        // Add story books
        data.stories.forEach((story) => {
            const book = create3DBook(story);
            container.appendChild(book);
        });

        // Initialize GSAP animations for all books
        setTimeout(() => init3DBookAnimations(), 100);
    } catch (error) {
        console.error('Failed to load stories:', error);
    }
}

// Parse furigana for titles
function parseFurigana(text) {
    if (!text) return text;
    return text.replace(/([一-龯々]+)《([ぁ-ん]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function create3DBook(story) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'books__item';
    bookDiv.setAttribute('data-story-id', story.id);

    // Get cover URL or use placeholder
    const coverUrl = story.book_cover_url || `/storypath/images/placeholder-${story.genre}-cover.png`;
    const hasRealCover = story.book_cover_url && !story.book_cover_url.includes('placeholder');
    
    // Book status
    const isComplete = story.is_complete === 1 || story.is_complete === true;
    const bookStatus = story.book_status || 'none';
    const bookProgress = story.book_progress || 0;
    const isBookReady = bookStatus === 'ready';
    const isCompiling = bookStatus === 'compiling';
    
    // Status badge
    let statusBadge = '';
    if (isComplete && isBookReady) {
        statusBadge = '<div class="book-status-badge ready">📚</div>';
    } else if (isComplete && isCompiling) {
        statusBadge = `<div class="book-status-badge compiling"><div class="compile-spinner"></div></div>`;
    } else if (isComplete && bookStatus === 'none') {
        statusBadge = '<div class="book-status-badge pending">✨</div>';
    }

    bookDiv.innerHTML = `
        <div class="books__container">
            <div class="books__cover">
                <div class="books__back-cover"></div>
                <div class="books__inside">
                    <div class="books__page"></div>
                    <div class="books__page"></div>
                    <div class="books__page"></div>
                </div>
                <div class="books__image ${story.is_password_protected ? 'book-locked' : ''} ${!hasRealCover ? 'book-placeholder-' + story.genre : ''} ${isCompiling ? 'book-compiling' : ''}">
                    ${hasRealCover ? `<img src="${coverUrl}" alt="${story.title}" onerror="this.style.display='none'; this.parentElement.classList.add('book-placeholder-${story.genre}');">` : ''}
                    <div class="books__effect"></div>
                    <div class="books__light"></div>
                    ${statusBadge}
                    ${isCompiling ? `<div class="compile-overlay"><div class="compile-progress" style="width: ${bookProgress}%"></div></div>` : ''}
                </div>
                <div class="books__hitbox" data-book-id="${story.id}" data-complete="${isComplete}" data-book-ready="${isBookReady}"></div>
            </div>
        </div>
        <div class="books__title">
            ${parseFurigana(story.title)}${story.is_password_protected ? ' 🔒' : ''}
        </div>
    `;

    return bookDiv;
}

// Initialize GSAP 3D book animations
function init3DBookAnimations() {
    if (typeof gsap === 'undefined') {
        console.error('GSAP not loaded');
        return;
    }

    gsap.registerPlugin(CustomEase);
    CustomEase.create("bookEase", "0.25, 1, 0.5, 1");

    const books = document.querySelectorAll(".books__item");
    books.forEach((book) => {
        const hitbox = book.querySelector(".books__hitbox");
        const bookImage = book.querySelector(".books__image");
        const bookEffect = book.querySelector(".books__effect");
        const pages = book.querySelectorAll(".books__page");
        const bookLight = book.querySelector(".books__light");

        // Set initial state
        gsap.set(bookImage, {
            boxShadow: "0 10px 20px rgba(0,0,0,0.15), 0 30px 45px rgba(0,0,0,0.12), 0 60px 80px rgba(0,0,0,0.1)"
        });
        gsap.set(bookLight, { opacity: 0.1, rotateY: 0 });
        gsap.set(pages, { x: 0 });

        // Create hover timeline
        const hoverIn = gsap.timeline({ paused: true });

        hoverIn.to(bookImage, {
            duration: 0.7,
            rotateY: -12,
            translateX: -6,
            scaleX: 0.96,
            boxShadow: "10px 10px 20px rgba(0,0,0,0.25), 20px 20px 40px rgba(0,0,0,0.2), 40px 40px 60px rgba(0,0,0,0.15)",
            ease: "bookEase"
        }, 0);

        hoverIn.to(bookEffect, {
            duration: 0.7,
            marginLeft: 10,
            ease: "bookEase"
        }, 0);

        hoverIn.to(bookLight, {
            duration: 0.7,
            opacity: 0.2,
            rotateY: -12,
            ease: "bookEase"
        }, 0);

        if (pages.length) {
            hoverIn.to(pages[0], { x: "4px", duration: 0.7, ease: "power1.inOut" }, 0);
            hoverIn.to(pages[1], { x: "2px", duration: 0.7, ease: "power1.inOut" }, 0);
            hoverIn.to(pages[2], { x: "0px", duration: 0.7, ease: "power1.inOut" }, 0);
        }

        // Hover events
        hitbox.addEventListener("mouseenter", () => hoverIn.play());
        hitbox.addEventListener("mouseleave", () => hoverIn.reverse());

        // Click event
        hitbox.addEventListener("click", async () => {
            const storyId = hitbox.getAttribute('data-book-id');
            const isComplete = hitbox.getAttribute('data-complete') === 'true';
            const isBookReady = hitbox.getAttribute('data-book-ready') === 'true';
            
            if (storyId) {
                const story = { id: storyId, is_password_protected: book.querySelector('.book-locked') !== null };
                if (story.is_password_protected) {
                    // Get full story data for password modal
                    fetch(`${API_URL}/stories`)
                        .then(r => r.json())
                        .then(data => {
                            const fullStory = data.stories.find(s => s.id === storyId);
                            if (fullStory) showPasswordModal(fullStory);
                        });
                } else if (isComplete && isBookReady) {
                    // Check if book layout version is current
                    try {
                        const response = await fetch(`${API_URL}/story/${storyId}/book-layout`);
                        const data = await response.json();
                        const CURRENT_LAYOUT_VERSION = 9; // v9: Safer margins
                        
                        if (data.layout && data.layout.version >= CURRENT_LAYOUT_VERSION) {
                            // Layout is current - go to book reader
                            window.location.href = `book.html?story=${storyId}`;
                        } else {
                            // Layout outdated - recompile
                            console.log('Book layout outdated, recompiling...');
                            window.location.href = `compile-book.html?story=${storyId}`;
                        }
                    } catch (e) {
                        // Error checking - just go to compile
                        window.location.href = `compile-book.html?story=${storyId}`;
                    }
                } else if (isComplete) {
                    // Story complete but book not ready - go to compile page
                    window.location.href = `compile-book.html?story=${storyId}`;
                } else {
                    // Story in progress - continue playing
                    loadStory(storyId);
                }
            }
        });
    });
}

function formatTimeAgo(dateString) {
    // SQLite stores UTC timestamps without 'Z', so add it
    const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ${t('splash.ago')}`;
    return `${diffDays}d ${t('splash.ago')}`;
}

function showPasswordModal(story) {
    currentStoryToUnlock = story;
    document.getElementById('modalStoryTitle').textContent = story.title;
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').style.display = 'none';
    document.getElementById('passwordInput').focus();
}

function closeModal() {
    document.getElementById('passwordModal').style.display = 'none';
    currentStoryToUnlock = null;
}

async function unlockStory() {
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch(`${API_URL}/story/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                story_id: currentStoryToUnlock.id,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem(`story_token_${currentStoryToUnlock.id}`, data.token);
            closeModal();
            loadStory(currentStoryToUnlock.id);
        } else {
            document.getElementById('passwordError').textContent = t('modal.invalidPassword');
            document.getElementById('passwordError').style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to unlock story:', error);
        document.getElementById('passwordError').textContent = 'Error unlocking story';
        document.getElementById('passwordError').style.display = 'block';
    }
}

function startNewStory() {
    window.location.href = 'wizard.html';
}

function loadStory(storyId) {
    window.location.href = `game.html?story=${storyId}`;
}

function switchLanguage(lang) {
    setLanguage(lang);

    // Update active button
    document.querySelectorAll('.lang-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Reload stories to update time formatting
    loadStories();
}

// Enter key for password modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('passwordModal').style.display !== 'none') {
        unlockStory();
    }
});

// Rotate "Create New" book covers
function startCoverRotation() {
    const covers = document.querySelectorAll('.rotating-cover');
    if (covers.length === 0) return;

    let currentIndex = 0;

    setInterval(() => {
        covers[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % covers.length;
        covers[currentIndex].classList.add('active');
    }, 4000); // Change cover every 4 seconds
}

// Load stories on page load
window.addEventListener('load', () => {
    loadStories();
    startCoverRotation();
});

