/**
 * Book Compiler 2.0
 * 
 * Generates book layouts with two distinct modes:
 * 1. Adult Mode: Continuous flow, fixed serif font, inline images (novel style).
 * 2. Kids Mode: Fixed spreads, large sans-serif font, overlay pages for overflow.
 */

class BookCompiler {
    constructor() {
        // Page dimensions (matching PageFlip settings)
        this.pageWidth = 450;
        this.pageHeight = 620;
        
        // Layout constants
        // Increased padding for better reading experience
        this.PADDING = { top: 60, right: 50, bottom: 60, left: 50 };
        
        // Fixed Font Settings
        this.fontSettings = {
            kids: {
                size: 24,
                lineHeight: 1.8,
                fontFamily: "'Quicksand', sans-serif",
                indent: '0'
            },
            adults: {
                size: 17,
                lineHeight: 1.6,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                indent: '1.5em'
            }
        };
        
        this.measureContainer = null;
        this.maturityLevel = 'kids'; // Default
    }

    /**
     * Main entry point
     */
    async compile(storyData, scenes, onProgress = () => {}) {
        console.log('📚 Starting compilation 2.0...');
        this.maturityLevel = storyData.maturity_level || 'kids';
        this.createMeasureContainer();
        
        let layout;
        
        if (this.maturityLevel === 'kids') {
            layout = await this.compileKids(storyData, scenes, onProgress);
        } else {
            layout = await this.compileAdult(storyData, scenes, onProgress);
        }
        
        this.removeMeasureContainer();
        return layout;
    }

    /**
     * KIDS MODE: Spread-based layout
     * [Left: Text] | [Right: Image]
     * Overflow -> Overlay Page
     */
    async compileKids(storyData, scenes, onProgress) {
        const pages = [];
        let pageNumber = 0;
        
        // 1. Front Cover (Right)
        pages.push({ type: 'cover', side: 'front' });
        
        // 2. Copyright (Left)
        pages.push({ type: 'copyright', pageNumber: ++pageNumber });
        
        // 3. Title (Right)
        pages.push({ type: 'title', pageNumber: ++pageNumber });
        
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const text = scene.text || '';
            const paragraphs = text.split('\n\n').filter(p => p.trim());
            
            // Start Scene on a Left Page
            // If current page count is Odd (last was Right), next is Left. Perfect.
            // If current is Even (last was Left), we need a blank/image Right page?
            // Actually, in standard book:
            // Cover=Right.
            // Copyright=Left, Title=Right.
            // Next is Page 4 (Left). So we are aligned for Left start.
            
            if (pages.length % 2 === 0) {
                // Currently ended on Left page? No, length is total pages.
                // 1 page = End on Right (Cover)
                // 2 pages = End on Left (Copyright) -> Next is Right (Title)
                // 3 pages = End on Right (Title) -> Next is Left (Scene 1)
                // So if length is odd, next is Left. Good.
                // If length is even, next is Right. We need a filler?
                // Picture books usually force spreads.
                // Let's assume we start synced.
            }

            // --- Page 1 of Scene: Text (Left) ---
            const leftPageNumber = ++pageNumber;
            
            // Measure how much fits on the left page
            const fitResult = this.fitContentToPage(paragraphs, this.fontSettings.kids);
            
            pages.push({
                type: 'content',
                layout: 'spread-text',
                pageNumber: leftPageNumber,
                paragraphs: fitResult.fittedParagraphs,
                sceneIndex: i
            });
            
            // --- Page 2 of Scene: Image (Right) ---
            const rightPageNumber = ++pageNumber;
            const imageUrl = scene.image_url;
            
            pages.push({
                type: 'content',
                layout: 'spread-image',
                pageNumber: rightPageNumber,
                imageUrl: imageUrl,
                sceneIndex: i
            });
            
            // --- Overflow Handling (Overlay Page) ---
            if (fitResult.remainingParagraphs.length > 0) {
                // If text didn't fit, create an Overlay Page (Left)
                // We use the SAME image but darkened as background
                const overlayPageNumber = ++pageNumber;
                
                // We might need to split AGAIN if even the overlay page overflows
                // But for simplicity/kids books, let's assume it fits or truncate safely
                // Or loop? Let's loop.
                
                let remaining = fitResult.remainingParagraphs;
                
                while (remaining.length > 0) {
                    const overlayFit = this.fitContentToPage(remaining, this.fontSettings.kids);
                    
                    pages.push({
                        type: 'content',
                        layout: 'overlay', // New type
                        pageNumber: overlayPageNumber,
                        imageUrl: imageUrl, // Full bleed background
                        paragraphs: overlayFit.fittedParagraphs,
                        sceneIndex: i
                    });
                    
                    remaining = overlayFit.remainingParagraphs;
                    
                    // If we added a Left Overlay page, we need a Right page to maintain spread?
                    // Or the Overlay page IS the spread (Left)?
                    // Next page is Right.
                    // If we have more scenes, next scene starts Left.
                    // So we need a Right Filler? Or just start next scene on Right?
                    // User said "spreads".
                    // If we have [Overlay (Left)], the Right side is blank?
                    // Let's make the Right side a "Detail" or repeat image or just blank.
                    // Or... maybe we just don't enforce [Text Left] for overflow.
                    // But for consistency, let's add a Right Filler.
                    
                    pages.push({
                        type: 'ornament', // Filler
                        pageNumber: ++pageNumber
                    });
                }
            }
            
            onProgress(10 + Math.floor((i / scenes.length) * 80));
        }
        
        return this.finalizeLayout(storyData, pages, 11);
    }

    /**
     * ADULT MODE: Continuous Flow
     * Text flows page to page. Images are inserted inline.
     */
    async compileAdult(storyData, scenes, onProgress) {
        const pages = [];
        let pageNumber = 0;
        
        // 1. Cover (Right)
        pages.push({ type: 'cover', side: 'front' });
        
        // 2. Copyright (Left)
        pages.push({ type: 'copyright', pageNumber: ++pageNumber });
        
        // 3. Title (Right)
        pages.push({ type: 'title', pageNumber: ++pageNumber });
        
        // Build continuous stream of content
        // Array of { type: 'text'|'image', content: ... }
        const stream = [];
        
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            
            // Add paragraphs
            const paragraphs = (scene.text || '').split('\n\n').filter(p => p.trim());
            paragraphs.forEach(p => stream.push({ type: 'text', content: p }));
            
            // Add inline image (interspersed)
            if (scene.image_url) {
                stream.push({ type: 'image', url: scene.image_url });
            }
            
            // Add divider if not last
            if (i < scenes.length - 1) {
                stream.push({ type: 'divider' });
            }
        }
        
        // Flow content into pages
        let currentContent = [];
        let currentHeight = 0;
        const maxHeight = this.pageHeight - this.PADDING.top - this.PADDING.bottom;
        const settings = this.fontSettings.adults;
        
        // Helper to flush current page
        const flushPage = () => {
            if (currentContent.length > 0) {
                pages.push({
                    type: 'content',
                    layout: 'continuous', // New generic layout
                    pageNumber: ++pageNumber,
                    items: [...currentContent] // Copy
                });
                currentContent = [];
                currentHeight = 0;
            }
        };
        
        for (const item of stream) {
            if (item.type === 'image') {
                // Fixed height for inline images (e.g. 250px)
                const imgHeight = 250; 
                
                if (currentHeight + imgHeight > maxHeight) {
                    flushPage();
                }
                
                currentContent.push(item);
                currentHeight += imgHeight + 20; // + gap
                
            } else if (item.type === 'divider') {
                const divHeight = 40;
                if (currentHeight + divHeight > maxHeight) {
                    flushPage();
                } else {
                    currentContent.push(item);
                    currentHeight += divHeight;
                }
                
            } else if (item.type === 'text') {
                // Measure text
                // If it fits, add. If not, SPLIT.
                const remainingSpace = maxHeight - currentHeight;
                
                // If space is very small (< 2 lines), flush first
                if (remainingSpace < 40) {
                    flushPage();
                }
                
                const fit = this.fitParagraphToHeight(item.content, settings, maxHeight - currentHeight);
                
                if (fit.fits) {
                    currentContent.push({ type: 'text', content: item.content });
                    currentHeight += fit.height;
                } else {
                    // Split!
                    if (fit.part1) {
                        currentContent.push({ type: 'text', content: fit.part1 });
                    }
                    flushPage();
                    
                    // Handle remainder (might need multiple pages)
                    let remainder = fit.part2;
                    while (remainder) {
                        const nextFit = this.fitParagraphToHeight(remainder, settings, maxHeight);
                        if (nextFit.fits) {
                            currentContent.push({ type: 'text', content: remainder });
                            currentHeight += nextFit.height;
                            remainder = null;
                        } else {
                            if (nextFit.part1) currentContent.push({ type: 'text', content: nextFit.part1 });
                            flushPage();
                            remainder = nextFit.part2;
                        }
                    }
                }
            }
        }
        
        flushPage(); // Flush last page
        
        return this.finalizeLayout(storyData, pages, 11);
    }

    finalizeLayout(storyData, pages, version) {
        // Back Cover
        pages.push({ 
            type: 'back', 
            endingType: storyData.ending_type || 'default'
        });
        
        console.log(`📚 Compiled ${pages.length} pages (v${version})`);
        
        return {
            version: version,
            storyId: storyData.id,
            title: storyData.title,
            language: storyData.language,
            genre: storyData.genre,
            maturityLevel: this.maturityLevel,
            coverUrl: storyData.book_cover_url,
            endingType: storyData.ending_type,
            totalPages: pages.length,
            pages,
            compiledAt: new Date().toISOString()
        };
    }

    // --- Measurement Helpers ---

    /**
     * Fits a list of paragraphs to a page
     * Returns { fittedParagraphs, remainingParagraphs }
     */
    fitContentToPage(paragraphs, settings) {
        const fitted = [];
        const remaining = [...paragraphs]; // Copy
        const maxHeight = this.pageHeight - this.PADDING.top - this.PADDING.bottom;
        let currentHeight = 0;
        
        while (remaining.length > 0) {
            const p = remaining[0];
            const pHeight = this.measureSingleParagraph(p, settings);
            
            if (currentHeight + pHeight <= maxHeight) {
                // Whole paragraph fits
                fitted.push(p);
                currentHeight += pHeight;
                remaining.shift();
            } else {
                // Overflow!
                // Try to split the paragraph? 
                // For Kids mode, maybe just push whole paragraph to next page to keep it clean?
                // User said "not a word vomit". Splitting might be better for density.
                // Let's split if it's long (> 200 chars), otherwise push.
                
                if (p.length > 200 && currentHeight < maxHeight * 0.7) {
                    // Try to split
                    const fit = this.fitParagraphToHeight(p, settings, maxHeight - currentHeight);
                    if (fit.part1) {
                        fitted.push(fit.part1);
                        remaining[0] = fit.part2; // Update remainder
                    }
                }
                
                // Stop filling this page
                break;
            }
        }
        
        return { fittedParagraphs: fitted, remainingParagraphs: remaining };
    }

    /**
     * Binary search to find how much of a paragraph fits in given height
     */
    fitParagraphToHeight(text, settings, availableHeight) {
        // First check if whole thing fits
        const totalHeight = this.measureSingleParagraph(text, settings);
        if (totalHeight <= availableHeight) {
            return { fits: true, height: totalHeight };
        }
        
        // Binary search for split index
        let start = 0;
        let end = text.length;
        let bestIndex = 0;
        let bestHeight = 0;
        
        // Minimal chunk to prevent widows
        if (availableHeight < 30) { // Less than 1 line approx
             return { fits: false, part1: '', part2: text };
        }

        // Optimization: Estimate based on ratio
        // let guess = Math.floor((availableHeight / totalHeight) * text.length);
        
        while (start <= end) {
            const mid = Math.floor((start + end) / 2);
            // Try to break at a space near mid
            let splitPoint = text.lastIndexOf(' ', mid);
            if (splitPoint === -1 || splitPoint < start) splitPoint = mid; // Fallback
            
            const chunk = text.substring(0, splitPoint);
            const h = this.measureSingleParagraph(chunk, settings);
            
            if (h <= availableHeight) {
                bestIndex = splitPoint;
                bestHeight = h;
                start = mid + 1; // Try more
            } else {
                end = mid - 1; // Too big
            }
        }
        
        if (bestIndex === 0) {
             return { fits: false, part1: '', part2: text };
        }
        
        return {
            fits: false,
            part1: text.substring(0, bestIndex),
            part2: text.substring(bestIndex).trim(),
            height: bestHeight
        };
    }

    measureSingleParagraph(text, settings) {
        const p = document.createElement('p');
        p.style.cssText = `
            margin: 0 0 1em 0;
            font-family: ${settings.fontFamily};
            font-size: ${settings.size}px;
            line-height: ${settings.lineHeight};
            text-align: ${settings.maturityLevel === 'kids' ? 'left' : 'justify'};
            text-indent: ${settings.indent};
            width: 100%;
        `;
        p.textContent = text;
        
        this.measureContainer.appendChild(p);
        const height = p.offsetHeight;
        this.measureContainer.removeChild(p);
        return height;
    }

    createMeasureContainer() {
        // Create hidden container with exact width of text area
        const width = this.pageWidth - this.PADDING.left - this.PADDING.right;
        
        this.measureContainer = document.createElement('div');
        this.measureContainer.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: ${width}px;
            visibility: hidden;
        `;
        document.body.appendChild(this.measureContainer);
    }

    removeMeasureContainer() {
        if (this.measureContainer && this.measureContainer.parentNode) {
            this.measureContainer.parentNode.removeChild(this.measureContainer);
        }
    }
}

window.BookCompiler = BookCompiler;
