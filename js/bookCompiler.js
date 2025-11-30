/**
 * Book Compiler - Picture Book Edition
 * 
 * Creates a picture book layout where:
 * - Each scene is a SPREAD (2 facing pages): text on left, image on right
 * - Text fills the page with appropriate font sizing
 * - No blank or nearly-empty pages
 * - Kids mode uses larger, friendlier fonts
 */

class BookCompiler {
    constructor() {
        // Page dimensions (matching PageFlip settings)
        this.pageWidth = 450;
        this.pageHeight = 620;
        
        // Layout constants
        this.PADDING = { top: 40, right: 40, bottom: 50, left: 40 };
        
        // Font settings by maturity level
        this.fontSettings = {
            kids: {
                baseSize: 20,      // 1.25rem
                minSize: 16,       // Won't go smaller than this
                maxSize: 28,       // Won't go larger than this
                lineHeight: 1.9,
                fontFamily: "'Quicksand', sans-serif"
            },
            adults: {
                baseSize: 17,      // 1.05rem
                minSize: 14,
                maxSize: 22,
                lineHeight: 1.75,
                fontFamily: "'Cormorant Garamond', Georgia, serif"
            }
        };
        
        this.measureContainer = null;
        this.maturityLevel = 'kids'; // Default
    }

    /**
     * Compile a complete story into a picture book layout
     */
    async compile(storyData, scenes, onProgress = () => {}) {
        console.log('📚 Starting picture book compilation...');
        
        this.maturityLevel = storyData.maturity_level || 'kids';
        this.createMeasureContainer();
        
        const pages = [];
        let pageNumber = 0;
        
        // 1. Front Cover (Right page)
        pages.push({ type: 'cover', side: 'front' });
        
        // 2. Inner Left (Copyright/Dedication) - This pushes Title to the Right
        pages.push({ 
            type: 'copyright', 
            pageNumber: ++pageNumber 
        });

        // 3. Title Page (Right page)
        pages.push({ type: 'title', pageNumber: ++pageNumber });
        
        onProgress(5);
        
        // 4. Process scenes (Text on Left, Image on Right)
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
            const scene = scenes[sceneIndex];
            const narrativeText = scene.text || '';
            const hasImage = !!scene.image_url;
            
            if (!narrativeText.trim()) continue;
            
            // Calculate optimal font size to fill the text page
            const paragraphs = narrativeText.split('\n\n').filter(p => p.trim());
            const optimalFontSize = this.calculateOptimalFontSize(paragraphs);
            
            // LEFT PAGE: Text
            pages.push({
                type: 'content',
                pageNumber: ++pageNumber,
                layout: 'spread-text',
                paragraphs: paragraphs,
                sceneIndex,
                fontSize: optimalFontSize,
                isFirstPageOfScene: true
            });
            
            // RIGHT PAGE: Image (or decorative page if no image)
            if (hasImage) {
                pages.push({
                    type: 'content',
                    pageNumber: ++pageNumber,
                    layout: 'spread-image',
                    imageUrl: scene.image_url,
                    sceneIndex
                });
            } else {
                // No image - could add a decorative divider page or skip
                // For now, we'll add a simple ornamental page
                pages.push({
                    type: 'ornament',
                    pageNumber: ++pageNumber,
                    sceneIndex
                });
            }
            
            // Progress update
            const progress = 5 + Math.floor(((sceneIndex + 1) / scenes.length) * 90);
            onProgress(progress);
        }
        
        // 4. Back Cover
        pages.push({ 
            type: 'back', 
            endingType: storyData.ending_type || 'default'
        });
        
        this.removeMeasureContainer();
        onProgress(100);
        
        const layout = {
            version: 9,  // v9: Safer margins and measurement
            storyId: storyData.id,
            title: storyData.title,
            language: storyData.language,
            genre: storyData.genre,
            maturityLevel: this.maturityLevel,
            coverUrl: storyData.book_cover_url,
            endingType: storyData.ending_type,
            totalPages: pageNumber + 1,
            pages,
            compiledAt: new Date().toISOString()
        };
        
        console.log(`📚 Picture book compiled: ${layout.totalPages} pages (${scenes.length} spreads)`);
        return layout;
    }

    /**
     * Calculate optimal font size to fill the text page nicely
     * Aims for 60-85% page fill (reduced from 95% to avoid overflow/crowding)
     */
    calculateOptimalFontSize(paragraphs) {
        const settings = this.fontSettings[this.maturityLevel];
        // Use reduced height for calculation to ensure bottom margin safety
        const availableHeight = (this.pageHeight - this.PADDING.top - this.PADDING.bottom) * 0.9;
        const targetFillMin = 0.50;
        const targetFillMax = 0.85;
        
        // Binary search for optimal font size
        let minSize = settings.minSize;
        let maxSize = settings.maxSize;
        let optimalSize = settings.baseSize;
        
        for (let i = 0; i < 8; i++) { // 8 iterations is enough precision
            const testSize = (minSize + maxSize) / 2;
            const height = this.measureTextHeight(paragraphs, testSize);
            const fillRatio = height / availableHeight;
            
            if (fillRatio < targetFillMin) {
                // Text too small, increase size
                minSize = testSize;
            } else if (fillRatio > targetFillMax) {
                // Text too big, decrease size
                maxSize = testSize;
            } else {
                // Good fit!
                optimalSize = testSize;
                break;
            }
            
            optimalSize = testSize;
        }
        
        // Clamp to valid range
        return Math.max(settings.minSize, Math.min(settings.maxSize, Math.round(optimalSize)));
    }

    /**
     * Measure total height of paragraphs at a given font size
     */
    measureTextHeight(paragraphs, fontSize) {
        const settings = this.fontSettings[this.maturityLevel];
        let totalHeight = 0;
        
        // Update container width to match new padding + safety buffer
        // Real padding is 50px left/right = 100px total
        // Safety buffer = 10px
        const measureWidth = this.pageWidth - 110; 
        this.measureContainer.style.width = `${measureWidth}px`;
        
        paragraphs.forEach((para, idx) => {
            const p = document.createElement('p');
            p.style.cssText = `
                margin: 0 0 ${idx < paragraphs.length - 1 ? '1em' : '0'} 0;
                font-family: ${settings.fontFamily};
                font-size: ${fontSize}px;
                line-height: ${settings.lineHeight};
                text-align: left;
            `;
            p.textContent = para;
            
            this.measureContainer.style.fontSize = `${fontSize}px`;
            this.measureContainer.appendChild(p);
            totalHeight += p.offsetHeight;
            this.measureContainer.removeChild(p);
        });
        
        return totalHeight;
    }

    /**
     * Create hidden container for DOM measurements
     */
    createMeasureContainer() {
        const settings = this.fontSettings[this.maturityLevel];
        this.measureContainer = document.createElement('div');
        this.measureContainer.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: ${this.pageWidth - this.PADDING.left - this.PADDING.right}px;
            visibility: hidden;
            font-family: ${settings.fontFamily};
            font-size: ${settings.baseSize}px;
            line-height: ${settings.lineHeight};
        `;
        document.body.appendChild(this.measureContainer);
    }

    /**
     * Remove measurement container
     */
    removeMeasureContainer() {
        if (this.measureContainer && this.measureContainer.parentNode) {
            this.measureContainer.parentNode.removeChild(this.measureContainer);
        }
        this.measureContainer = null;
    }
}

// Export for use
window.BookCompiler = BookCompiler;
