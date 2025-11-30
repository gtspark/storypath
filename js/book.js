// Book Reader Logic - Uses Pre-compiled Layout
const API_URL = `${window.location.protocol}//${window.location.hostname}/storypath-api`;
const urlParams = new URLSearchParams(window.location.search);
const storyId = urlParams.get('story');

let pageFlip;
let bookLayout = null;
let audio = window.audioManager;

// Inspirational quotes for back cover
const endingQuotes = {
    triumph: [
        "And so the brave heart found its way home, carrying light for all who would follow.",
        "In the end, courage was not the absence of fear, but the triumph over it."
    ],
    bittersweet: [
        "Not all endings are happy, but all endings teach us something precious.",
        "The sweetest victories are those earned through tears."
    ],
    mystery: [
        "Some questions are better left unanswered, for in mystery lies magic.",
        "The end is but another beginning in disguise."
    ],
    default: [
        "Every ending is a new beginning waiting to unfold.",
        "And they carried this story in their heart, forever."
    ]
};

async function loadBook() {
    if (!storyId) {
        Toast.error('No story ID provided', 'Error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        // First check if book is compiled
        const statusRes = await fetch(`${API_URL}/story/${storyId}/book-status`);
        const status = await statusRes.json();
        
        if (status.status === 'compiling') {
            showCompilingStatus(status.progress);
            // Poll for completion
            pollCompilationStatus();
            return;
        }
        
        if (status.status !== 'ready') {
            // Book not compiled yet, trigger compilation
            await triggerCompilation();
            return;
        }
        
        // Load the pre-compiled layout
        const response = await fetch(`${API_URL}/story/${storyId}/book-layout`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        bookLayout = data.layout;
        
        // Initialize audio language
        if (audio) {
            audio.setLanguage(bookLayout.language);
        }

        // Set page title
        document.title = `${bookLayout.title} - StoryPath`;

        renderBook();
        document.getElementById('loadingOverlay').style.display = 'none';

    } catch (error) {
        console.error('Failed to load book:', error);
        Toast.error('Failed to load book: ' + error.message, 'Error');
    }
}

function showCompilingStatus(progress) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.innerHTML = `
        <div class="spinner">📖</div>
        <p>Binding your book...</p>
        <div class="compile-progress">
            <div class="compile-progress-bar" style="width: ${progress}%"></div>
        </div>
        <p class="compile-percent">${progress}%</p>
    `;
}

async function pollCompilationStatus() {
    const checkStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/story/${storyId}/book-status`);
            const status = await res.json();
            
            if (status.status === 'ready') {
                // Reload to show the book
                location.reload();
            } else if (status.status === 'compiling') {
                showCompilingStatus(status.progress);
                setTimeout(checkStatus, 1000);
            } else if (status.status === 'error') {
                Toast.error('Book compilation failed', 'Error');
            }
        } catch (e) {
            console.error('Poll error:', e);
            setTimeout(checkStatus, 2000);
        }
    };
    
    setTimeout(checkStatus, 1000);
}

async function triggerCompilation() {
    // Redirect to compile-book.html which does actual DOM-based compilation
    window.location.href = `compile-book.html?story=${storyId}`;
}

function getRandomQuote(endingType) {
    const quotes = endingQuotes[endingType] || endingQuotes.default;
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function formatEndingType(ending) {
    if (!ending) return 'A Tale Complete';
    const formatted = {
        'triumph': 'A Triumphant Tale',
        'bittersweet': 'A Bittersweet Journey',
        'mystery': 'A Mysterious Conclusion',
        'tragedy': 'A Poignant Story'
    };
    return formatted[ending.toLowerCase()] || 'A Tale Complete';
}

function renderBook() {
    const bookEl = document.getElementById('book');
    bookEl.innerHTML = '';
    
    const isJapanese = bookLayout.language === 'ja';
    const isKids = bookLayout.maturityLevel === 'kids';
    
    // Add maturity class to body for CSS styling
    document.body.classList.toggle('book-kids', isKids);
    document.body.classList.toggle('book-adults', !isKids);

    // Render each page from the pre-compiled layout
    bookLayout.pages.forEach((page, idx) => {
        const pageEl = document.createElement('div');
        
        switch (page.type) {
            case 'cover':
                if (page.side === 'front') {
                    pageEl.className = 'page cover front';
                    pageEl.dataset.density = 'hard';
                    pageEl.innerHTML = `<img class="cover-image-full" src="${bookLayout.coverUrl || 'images/placeholder-cover.png'}" alt="${bookLayout.title}">`;
                }
                break;
                
            case 'title':
                pageEl.className = 'page';
                pageEl.innerHTML = `
                    <div class="title-page-content">
                        <h1>${bookLayout.title}</h1>
                        <div class="title-page-divider"></div>
                        <p class="title-page-branding">A StoryPath Original</p>
                        <div class="title-page-ornament">❧</div>
                    </div>
                `;
                break;
                
            case 'content':
                if (page.layout === 'spread-text') {
                    // Text page of a spread
                    pageEl.className = `page spread-text ${isJapanese ? 'ja-vertical' : ''}`;
                    
                    const fontSize = page.fontSize || (isKids ? 20 : 17);
                    const paragraphsHtml = page.paragraphs
                        .map(p => `<p>${p.trim()}</p>`)
                        .join('');
                    
                    pageEl.innerHTML = `
                        <div class="page-content">
                            <div class="scene-text-container">
                                <div class="scene-text" style="font-size: ${fontSize}px;" data-scene="${page.sceneIndex}">
                                    ${paragraphsHtml}
                                </div>
                            </div>
                            <div class="page-number">${page.pageNumber}</div>
                        </div>
                    `;
                } else if (page.layout === 'spread-image') {
                    // Image page of a spread (full bleed)
                    pageEl.className = 'page spread-image';
                    pageEl.innerHTML = `
                        <img class="full-page-image" src="${page.imageUrl}" alt="Scene illustration" loading="lazy">
                        <div class="page-number">${page.pageNumber}</div>
                    `;
                } else {
                    // Legacy format support
                    const isContinuation = page.isContinuation;
                    pageEl.className = `page ${isJapanese ? 'ja-vertical' : ''} ${!page.hasImage ? 'page-text-only' : ''} ${isContinuation ? 'continuation' : ''}`;
                    
                    const paragraphsHtml = page.paragraphs
                        .map(p => `<p>${p.trim()}</p>`)
                        .join('');
                    
                    if (page.hasImage) {
                        pageEl.innerHTML = `
                            <div class="page-content">
                                <div class="scene-image-container position-${page.imagePosition}">
                                    <img src="${page.imageUrl}" alt="Scene illustration" loading="lazy">
                                </div>
                                <div class="scene-text-container with-image-${page.imagePosition}">
                                    <div class="scene-text" data-scene="${page.sceneIndex}">
                                        ${paragraphsHtml}
                                    </div>
                                </div>
                                <div class="page-number">${page.pageNumber}</div>
                            </div>
                        `;
                    } else {
                        pageEl.innerHTML = `
                            <div class="page-content">
                                <div class="scene-text-container">
                                    <div class="scene-text ${isContinuation ? 'continuation' : ''}" data-scene="${page.sceneIndex}">
                                        ${paragraphsHtml}
                                    </div>
                                </div>
                                <div class="page-number">${page.pageNumber}</div>
                            </div>
                        `;
                    }
                }
                break;
                
            case 'ornament':
                // Decorative page when no image available
                pageEl.className = 'page ornament-page';
                pageEl.innerHTML = `
                    <div class="ornament-content">
                        <div class="ornament-symbol">❧</div>
                    </div>
                    <div class="page-number">${page.pageNumber}</div>
                `;
                break;
                
            case 'back':
                const quote = getRandomQuote(page.endingType);
                const formattedEnding = formatEndingType(page.endingType);
                
                pageEl.className = 'page cover back';
                pageEl.dataset.density = 'hard';
                pageEl.innerHTML = `
                    <div class="back-cover-content">
                        <h2>The End</h2>
                        <p class="ending-type">${formattedEnding}</p>
                        <div class="back-ornament"></div>
                        <p class="back-quote">"${quote}"</p>
                        <button class="btn-return" onclick="window.location.href='index.html'">
                            Return Home
                        </button>
                        <p class="back-branding">StoryPath</p>
                    </div>
                `;
                break;
        }
        
        if (pageEl.className) {
            bookEl.appendChild(pageEl);
        }
    });

    initPageFlip();
}

function initPageFlip() {
    const isMobile = window.innerWidth < 768;
    const maxWidth = Math.min(window.innerWidth * 0.45, 500);
    const maxHeight = Math.min(window.innerHeight * 0.75, 680);

    pageFlip = new St.PageFlip(document.getElementById('book'), {
        width: isMobile ? Math.min(window.innerWidth - 40, 380) : maxWidth,
        height: isMobile ? Math.min(window.innerHeight - 120, 540) : maxHeight,
        size: 'stretch',
        minWidth: 280,
        maxWidth: 600,
        minHeight: 400,
        maxHeight: 800,
        maxShadowOpacity: 0.4,
        showCover: true,
        mobileScrollSupport: false,
        useMouseEvents: true,
        flippingTime: 800,
        usePortrait: isMobile,
        startPage: 0
    });

    pageFlip.loadFromHTML(document.querySelectorAll('.page'));

    pageFlip.on('flip', (e) => {
        updatePageCounter(e.data);
        playPageAudio(e.data);
    });

    updatePageCounter(0);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => location.reload(), 500);
    });
}

function updatePageCounter(pageIndex) {
    const total = pageFlip.getPageCount();
    document.getElementById('pageCounter').textContent = `Page ${pageIndex + 1} / ${total}`;
}

function playPageAudio(pageIndex) {
    if (!audio || !audio.enabled) return;
    audio.stop();

    // Find the page in layout and get its text
    const page = bookLayout.pages[pageIndex];
    if (page && page.type === 'content' && page.paragraphs) {
        // Join all paragraphs on this page for reading
        const text = page.paragraphs.join('\n\n');
        if (text) {
            audio.speak(text, true);
        }
    }
}

// Controls
document.getElementById('btnPrev').onclick = () => pageFlip?.flipPrev();
document.getElementById('btnNext').onclick = () => pageFlip?.flipNext();
document.getElementById('btnHome').onclick = () => window.location.href = 'index.html';

document.getElementById('btnAudio').onclick = () => {
    if (audio) {
        const enabled = audio.toggle();
        document.getElementById('btnAudio').textContent = enabled ? '🔊' : '🔇';
        if (enabled && pageFlip) {
            playPageAudio(pageFlip.getCurrentPageIndex());
        } else if (audio) {
            audio.stop();
        }
    }
};

document.getElementById('btnTheme').onclick = () => {
    document.body.classList.toggle('dark-theme');
};

// Initialize
window.addEventListener('load', loadBook);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft') pageFlip.flipPrev();
    if (e.key === 'ArrowRight') pageFlip.flipNext();
    if (e.key === 'Home') pageFlip.flip(0);
    if (e.key === 'End') pageFlip.flip(pageFlip.getPageCount() - 1);
});
