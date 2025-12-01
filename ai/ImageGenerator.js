const Replicate = require('replicate');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ImageGenerator {
    constructor(config) {
        this.apiKey = config.apiKey || process.env.REPLICATE_API_TOKEN;
        this.replicate = new Replicate({ auth: this.apiKey });
        this.timeout = config.timeout || 30000;
        this.outputDir = config.outputDir || '/var/www/html/storypath/images/generated';

        // Gemini for outpainting
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        if (this.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
        }
    }

    async generateSceneImage(prompt, storyId, sceneNumber) {
        try {
            const startTime = Date.now();

            // Ensure output directory exists
            const storyDir = path.join(this.outputDir, storyId);
            await fs.mkdir(storyDir, { recursive: true });

            // Enhance prompt with style
            const enhancedPrompt = this.enhancePrompt(prompt);

            console.log(`🎨 [FLUX] Generating image for scene ${sceneNumber}...`);
            console.log(`📝 Prompt: ${enhancedPrompt.substring(0, 100)}...`);

            // Use FLUX 1.1 Pro via Replicate (much faster than Stability AI)
            const output = await this.replicate.run(
                "black-forest-labs/flux-1.1-pro",
                {
                    input: {
                        prompt: enhancedPrompt,
                        aspect_ratio: "16:9",
                        output_format: "png",
                        safety_tolerance: 2
                    }
                }
            );

            // Download the image
            const imageUrl = output;
            const response = await fetch(imageUrl);

            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.status}`);
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const filename = `scene-${sceneNumber}.png`;
            const filepath = path.join(storyDir, filename);

            await fs.writeFile(filepath, imageBuffer);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ [FLUX] Image saved in ${duration}s: ${filepath}`);

            // Fire async outpainting for book view (don't await)
            this.outpaintForBook(filepath, prompt, storyId, sceneNumber)
                .then(() => console.log(`✅ [GEMINI] Portrait version ready for scene ${sceneNumber}`))
                .catch(err => console.log(`⚠️ [GEMINI] Outpaint failed for scene ${sceneNumber}: ${err.message}`));

            // Return URL path immediately
            return `/storypath/images/generated/${storyId}/${filename}`;

        } catch (error) {
            console.error('❌ [FLUX] Image generation failed:', error.message);
            console.error('Error details:', error);

            // Return placeholder
            return this.getPlaceholderImage();
        }
    }

    enhancePrompt(basePrompt) {
        return `${basePrompt}, storybook illustration style, whimsical colorful digital art, detailed vibrant colors, friendly atmosphere, high quality fantasy art, children's book style, soft magical lighting, no text`;
    }

    async generateBookCover(title, genre, maturity_level, storyId, narrative = '') {
        try {
            const startTime = Date.now();

            // Ensure output directory exists
            const coverDir = path.join(this.outputDir, storyId);
            await fs.mkdir(coverDir, { recursive: true });

            // Create book cover prompt based on genre, maturity, and narrative
            const coverPrompt = this.createBookCoverPrompt(title, genre, maturity_level, narrative);

            console.log(`📚 [FLUX] Generating book cover for "${title}"...`);
            console.log(`📝 Prompt: ${coverPrompt.substring(0, 100)}...`);

            // Use FLUX Pro for book cover (highest quality, slower but worth it)
            const output = await this.replicate.run(
                "black-forest-labs/flux-pro",
                {
                    input: {
                        prompt: coverPrompt,
                        aspect_ratio: "2:3",  // Book cover aspect ratio
                        output_format: "png",
                        safety_tolerance: 2,
                        steps: 25  // More steps = higher quality
                    }
                }
            );

            // Download the image
            const imageUrl = output;
            const response = await fetch(imageUrl);

            if (!response.ok) {
                throw new Error(`Failed to download book cover: ${response.status}`);
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const filename = `cover.png`;
            const filepath = path.join(coverDir, filename);

            await fs.writeFile(filepath, imageBuffer);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ [FLUX] Book cover saved in ${duration}s: ${filepath}`);

            // Return URL path
            return `/storypath/images/generated/${storyId}/${filename}`;

        } catch (error) {
            console.error('❌ [FLUX] Book cover generation failed:', error.message);
            console.error('Error details:', error);

            // Return genre-specific placeholder
            return this.getPlaceholderCover(genre);
        }
    }

    createBookCoverPrompt(title, genre, maturity_level, narrative = '') {
        const isKids = maturity_level === 'kids';

        const genreStyles = {
            fantasy: isKids
                ? 'magical fantasy book cover, whimsical unicorns and castles, bright rainbow colors, sparkles and stars, friendly dragons, animated film style'
                : 'epic dark fantasy book cover, dramatic sword and sorcery, ancient ruins, mystical runes, moody atmosphere, epic medieval fantasy aesthetic',
            scifi: isKids
                ? 'colorful sci-fi book cover, friendly robots and spaceships, bright planets and stars, fun technology, animated futuristic style'
                : 'cyberpunk book cover, dark futuristic cityscape, neon lights, advanced technology, digital dystopian aesthetic',
            horror: isKids
                ? 'spooky but cute book cover, friendly ghosts, cartoonish monsters, Halloween vibes, purple and orange colors, children horror illustration'
                : 'horror book cover, dark ominous atmosphere, shadows and mist, gothic horror aesthetic, haunting terror mood, unsettling darkness',
            mystery: isKids
                ? 'mystery detective book cover, magnifying glass and clues, bright detective office, young sleuth adventure style, colorful investigation theme'
                : 'noir mystery book cover, dark detective aesthetic, rain and shadows, classic noir cinematography, mysterious atmosphere, crime thriller',
            adventure: isKids
                ? 'adventure book cover, treasure maps and exploration, bright jungle or ocean, pirates and explorers, classic adventure story style'
                : 'rugged adventure book cover, epic exploration, dangerous terrain, survival theme, dramatic landscape, action adventure aesthetic'
        };

        const style = genreStyles[genre] || genreStyles.adventure;

        // Extract key visual elements from narrative
        let narrativeDetails = '';
        if (narrative && narrative.length > 0) {
            // Extract key nouns and visual elements (simple keyword extraction)
            const keywords = this.extractVisualKeywords(narrative);
            if (keywords.length > 0) {
                narrativeDetails = `, featuring ${keywords.slice(0, 3).join(', ')}`;
            }
        }

        return `Professional book cover design, ${style}${narrativeDetails}, high quality digital art, detailed illustration, the ONLY text visible anywhere on the cover is the title "${title}" at the top in elegant typography, ABSOLUTELY NO AUTHOR NAMES ANYWHERE, NO "Stephen King", NO "Nancy Drew", NO "by [anyone]", NO byline text, NO author credits, NO names of any kind except the title, DO NOT add any celebrity names, DO NOT add any famous author names, FORBIDDEN to include any text other than the exact title "${title}", just pure artwork and imagery with the single title text, professional publishing quality, completely anonymous cover with no author attribution`;
    }

    extractVisualKeywords(text) {
        // Extract visual nouns from the narrative text
        const visualNouns = [
            'lighthouse', 'tower', 'castle', 'forest', 'mountain', 'ocean', 'river', 'cave', 'temple', 'ruins',
            'dragon', 'wolf', 'bird', 'creature', 'monster', 'robot', 'ship', 'spaceship', 'portal', 'gate',
            'sword', 'crown', 'amulet', 'crystal', 'stone', 'gem', 'book', 'scroll', 'map', 'compass',
            'village', 'city', 'town', 'school', 'library', 'laboratory', 'arena', 'stadium', 'garden',
            'moon', 'sun', 'stars', 'clouds', 'storm', 'mist', 'fog', 'shadow', 'light', 'fire', 'water',
            'tree', 'flower', 'rose', 'oak', 'willow', 'bridge', 'path', 'road', 'door', 'window',
            'mascot', 'statue', 'monument', 'fountain', 'well', 'lake', 'pond', 'stream'
        ];

        const found = [];
        const lowerText = text.toLowerCase();

        for (const noun of visualNouns) {
            if (lowerText.includes(noun) && !found.includes(noun)) {
                found.push(noun);
                if (found.length >= 5) break;  // Max 5 keywords
            }
        }

        return found;
    }

    getPlaceholderCover(genre) {
        // Return genre-specific placeholder covers
        return `/storypath/images/placeholder-${genre}-cover.png`;
    }

    getPlaceholderImage() {
        // Return path to a placeholder/loading image
        return '/storypath/images/placeholder-scene.png';
    }

    /**
     * Outpaint a 16:9 landscape image to 2:3 portrait for book view
     * Uses Gemini (Nano Banana) for reliable outpainting
     */
    async outpaintForBook(inputPath, prompt, storyId, sceneNumber) {
        if (!this.genAI) {
            throw new Error('Gemini API not configured');
        }

        const fsSync = require('fs');
        const startTime = Date.now();

        // Read original image
        const metadata = await sharp(inputPath).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;

        // Calculate target portrait dimensions (2:3 ratio)
        const targetHeight = Math.round(originalWidth * 1.5);

        // Skip if already portrait
        if (originalHeight >= targetHeight) {
            console.log(`⏭️ [GEMINI] Scene ${sceneNumber} already portrait, skipping`);
            return;
        }

        const paddingTop = Math.floor((targetHeight - originalHeight) / 2);
        const paddingBottom = targetHeight - originalHeight - paddingTop;

        console.log(`🖼️ [GEMINI] Outpainting scene ${sceneNumber}: ${originalWidth}x${originalHeight} → ${originalWidth}x${targetHeight}`);

        // Create extended canvas with gray padding (shows Gemini where to fill)
        const extendedImage = await sharp(inputPath)
            .extend({
                top: paddingTop,
                bottom: paddingBottom,
                left: 0,
                right: 0,
                background: { r: 200, g: 200, b: 200, alpha: 1 }
            })
            .png()
            .toBuffer();

        // Call Gemini for image editing
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                responseModalities: ['image', 'text']
            }
        });

        const editPrompt = `Edit this image: The gray areas at the top and bottom need to be filled in naturally.

- TOP gray area: Fill with sky, clouds, atmospheric continuation matching the scene
- BOTTOM gray area: Fill with ground, grass, flowers, path continuation matching the scene

The CENTER of the image should remain UNCHANGED.
Create ONE seamless vertical landscape. Match the existing art style perfectly.
Scene context: ${prompt}`;

        const result = await model.generateContent([
            editPrompt,
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: extendedImage.toString('base64')
                }
            }
        ]);

        // Extract image from response
        if (result.response.candidates && result.response.candidates[0]) {
            for (const part of result.response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const imageData = Buffer.from(part.inlineData.data, 'base64');

                    // Save as portrait version
                    const storyDir = path.join(this.outputDir, storyId);
                    const portraitPath = path.join(storyDir, `scene-${sceneNumber}-portrait.png`);

                    await sharp(imageData).png().toFile(portraitPath);

                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`✅ [GEMINI] Saved portrait in ${duration}s: ${portraitPath}`);
                    return;
                }
            }
        }

        throw new Error('No image in Gemini response');
    }
}

module.exports = ImageGenerator;
