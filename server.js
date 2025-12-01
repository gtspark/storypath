const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');

// Stranger detection & lockdown
const { notifyIfStranger, getClientIP, checkLockdown } = require('/home/admin/shared/notify.js');

const StoryDatabase = require('./database/StoryDatabase');
const StoryEngine = require('./ai/StoryEngine');
const ImageGenerator = require('./ai/ImageGenerator');
const EmbeddingHelper = require('./ai/EmbeddingHelper');
const furiganaHelper = require('./utils/FuriganaHelper');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('/var/www/html/storypath'));

// Initialize AI services
console.log('🔑 Claude API Key length:', process.env.ANTHROPIC_API_KEY?.length);
console.log('🔑 Claude API Key preview:', process.env.ANTHROPIC_API_KEY?.substring(0, 25) + '...');
const storyEngine = new StoryEngine(process.env.ANTHROPIC_API_KEY);
const imageGenerator = new ImageGenerator({
    apiKey: process.env.REPLICATE_API_TOKEN,
    outputDir: '/var/www/html/storypath/images/generated'
});
const embeddingHelper = new EmbeddingHelper(process.env.OPENAI_API_KEY);

// Initialize furigana helper
furiganaHelper.init().catch(err => console.error('Failed to init furigana:', err));

// Database helper
function getDatabase(storyId) {
    const dbPath = path.join(__dirname, 'stories', `${storyId}.db`);
    const db = new StoryDatabase(dbPath);
    return db;
}

// Parse Claude's furigana format: 漢字《かんじ》 -> keep as-is for frontend to convert
function parseFurigana(text) {
    if (!text) return text;

    // Claude keeps generating ruby tags with WRONG readings (compound words in single tag)
    // Example: <ruby>刑事<rt>たなかけいじ</rt></ruby> should be just <ruby>刑事<rt>けいじ</rt></ruby>
    // Strip ALL ruby tags since they're unreliable, keep only bracket notation
    let result = text;

    // Remove all ruby tags and their rt contents
    result = result.replace(/<ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby>/g, '$1');

    // Handle nested ruby tags
    result = result.replace(/<ruby><ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby><rt>[^<]*<\/rt><\/ruby>/g, '$1');

    console.log('[parseFurigana] Stripped ruby tags from:', text.substring(0, 100));
    console.log('[parseFurigana] Result:', result.substring(0, 100));

    return result;
}

// Add furigana to narrative if Japanese (kept for backwards compatibility)
async function processFurigana(narrative, language) {
    if (language === 'ja') {
        // First try Claude's built-in furigana format
        const parsed = parseFurigana(narrative);

        // Check if text already has bracket notation (Claude's format)
        const hasBracketNotation = /《[^》]+》/.test(parsed);

        // If no furigana markers found AND no brackets, fall back to kuromoji
        if (!hasBracketNotation && parsed === narrative && narrative.match(/[一-龯]/)) {
            return await furiganaHelper.addFurigana(narrative);
        }
        return parsed;
    }
    return narrative;
}

// ===== API ROUTES =====

// Get all stories (for splash page)
app.get('/api/stories', async (req, res) => {
    try {
        const storiesDir = path.join(__dirname, 'stories');

        // Ensure directory exists
        await fsPromises.mkdir(storiesDir, { recursive: true });

        const files = await fsPromises.readdir(storiesDir);
        const dbFiles = files.filter(f => f.endsWith('.db'));

        const allStories = [];

        for (const file of dbFiles) {
            const storyId = file.replace('.db', '');
            const db = getDatabase(storyId);
            await db.init();

            const stories = await db.getAllStories();
            allStories.push(...stories);

            db.close();
        }

        res.json({ stories: allStories });
    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// Create new story
app.post('/api/story/create', checkLockdown('storypath'), async (req, res) => {
    try {
        const {
            genre, language, difficulty, maturity_level,
            protagonist_name, protagonist_gender, protagonist_archetype,
            story_seed, password
        } = req.body;

        // Alert if stranger is creating a story
        notifyIfStranger(req, `📖 StoryPath: Creating "${genre}" story as "${protagonist_name}"`);

        console.log('📥 Story creation request:', {
            genre, language, difficulty, maturity_level,
            protagonist_name, protagonist_gender, protagonist_archetype
        });

        // Generate story ID
        const storyId = uuidv4();

        // Hash password if provided
        let passwordHash = null;
        let isPasswordProtected = false;
        if (password && password.trim()) {
            passwordHash = await bcrypt.hash(password, 10);
            isPasswordProtected = true;
        }

        // Initialize database
        const db = getDatabase(storyId);
        await db.init();

        // We'll generate the title AFTER we have the story arc and opening, so it knows what it's about
        const tempTitle = `${genre.charAt(0).toUpperCase() + genre.slice(1)} Story`;

        // Create story in database with 'generating' status
        const storyData = {
            id: storyId,
            title: tempTitle,
            genre,
            language: language || 'en',
            difficulty: difficulty || 'balanced',
            maturity_level: maturity_level || 'kids',
            protagonist_name: protagonist_name || 'Adventurer',
            protagonist_gender,
            protagonist_archetype,
            story_seed,
            password_hash: passwordHash,
            is_password_protected: isPasswordProtected
        };

        await db.createStory(storyData);

        // Add generation_status column if it doesn't exist
        await db.run(`ALTER TABLE stories ADD COLUMN generation_status TEXT DEFAULT 'generating'`).catch(() => {});
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['generating', storyId]);

        db.close();

        // Return immediately with story ID
        res.json({
            success: true,
            story_id: storyId,
            status: 'generating'
        });

        // Generate story content in background (don't await)
        generateStoryContent(storyId, {
            genre, language, difficulty, maturity_level,
            protagonist_name, protagonist_gender, protagonist_archetype,
            story_seed
        }).catch(err => {
            console.error('Background story generation failed:', err);
            // Mark as failed
            const dbFail = getDatabase(storyId);
            dbFail.init().then(() => {
                dbFail.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['error', storyId]);
                dbFail.close();
            });
        });

    } catch (error) {
        console.error('Error creating story:', error);
        res.status(500).json({ error: 'Failed to create story: ' + error.message });
    }
});

// Background story generation function
async function generateStoryContent(storyId, params) {
    const {
        genre, language, difficulty, maturity_level,
        protagonist_name, protagonist_gender, protagonist_archetype,
        story_seed
    } = params;

    const db = getDatabase(storyId);
    await db.init();

    try {
        // Generate story arc with uniqueness checking
        console.log(`📖 [${storyId}] Generating story arc...`);
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['arc', storyId]);

        let storyArc;
        let attempt = 0;
        const maxAttempts = 5;
        const avoidThemes = [];

        while (attempt < maxAttempts) {
            attempt++;
            console.log(`📖 [${storyId}] Story arc generation attempt ${attempt}/${maxAttempts}...`);

            storyArc = await storyEngine.generateStoryArc({
                genre, language, difficulty, maturity_level,
                protagonist_name, story_seed,
                avoidThemes: avoidThemes.length > 0 ? avoidThemes : null
            });

            // Check similarity to existing stories
            const conceptSummary = `Genre: ${genre}, Maturity: ${maturity_level}\nSeed: ${story_seed || ''}\nArc: ${storyArc.substring(0, 500)}`;
            const similarityCheck = await embeddingHelper.checkSimilarity(genre, maturity_level, conceptSummary, 0.35);

            if (!similarityCheck.isTooSimilar) {
                console.log(`✅ [${storyId}] ${similarityCheck.message}`);
                break;
            }

            console.log(`⚠️ [${storyId}] ${similarityCheck.message}`);

            // Extract themes to avoid from similar stories
            if (similarityCheck.similarStories && similarityCheck.similarStories.length > 0) {
                for (const story of similarityCheck.similarStories) {
                    // Extract key words/themes from the title and concept
                    const themeText = `"${story.title}" (${story.concept || 'no concept'})`;
                    if (!avoidThemes.includes(themeText)) {
                        avoidThemes.push(themeText);
                    }
                }
                console.log(`🚫 [${storyId}] Now avoiding ${avoidThemes.length} overused themes`);
            }

            if (attempt < maxAttempts) {
                console.log(`🔄 [${storyId}] Regenerating with theme avoidance...`);
            }
        }

        await db.run('UPDATE stories SET story_arc = ? WHERE id = ?', [storyArc, storyId]);
        console.log(`📖 [${storyId}] Story arc complete`);

        // Generate opening scene
        console.log(`🎭 [${storyId}] Generating opening scene...`);
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['opening', storyId]);

        const opening = await storyEngine.generateStoryOpening({
            genre, language, difficulty, maturity_level,
            protagonist_name, protagonist_gender, protagonist_archetype,
            story_seed
        });

        // Add opening scene to database
        const sceneId = await db.addScene({
            story_id: storyId,
            scene_number: 1,
            narrative_text: opening.narrative,
            image_prompt: opening.image_prompt,
            image_url: null  // Will generate async
        });

        // Add choices
        await db.addChoices(sceneId, opening.choices);

        // Update current scene
        await db.updateCurrentScene(storyId, 1);

        // Add opening events
        if (opening.important_events && opening.important_events.length > 0) {
            for (const event of opening.important_events) {
                await db.addEvent({
                    story_id: storyId,
                    event_type: 'plot_point',
                    summary: event,
                    importance: 8,
                    scene_id: sceneId
                });
            }
        }

        // Mark as complete
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['complete', storyId]);
        console.log(`✅ [${storyId}] Story generation complete`);

        db.close();

        // Generate title based on actual story content (asynchronously)
        storyEngine.generateStoryTitle({
            genre, language, protagonist_name, story_seed,
            story_arc: storyArc,
            opening_narrative: opening.narrative
        })
            .then(async (storyTitle) => {
                const db2 = getDatabase(storyId);
                await db2.init();
                await db2.run('UPDATE stories SET title = ? WHERE id = ?', [storyTitle, storyId]);
                db2.close();
                console.log(`📚 [${storyId}] Title generated:`, storyTitle);

                // Store embedding for this story
                embeddingHelper.addStory(storyId, genre, maturity_level, storyTitle, story_seed, storyArc)
                    .catch(err => console.error(`Failed to store embedding for ${storyId}:`, err));

                // Generate book cover AFTER title is ready
                imageGenerator.generateBookCover(storyTitle, genre, maturity_level, storyId, opening.narrative)
                    .then(async (coverUrl) => {
                        const db3 = getDatabase(storyId);
                        await db3.init();
                        await db3.run('UPDATE stories SET book_cover_url = ? WHERE id = ?', [coverUrl, storyId]);
                        db3.close();
                        console.log(`✅ [${storyId}] Book cover generated`);
                    })
                    .catch(err => console.error(`Book cover generation failed for ${storyId}:`, err));
            })
            .catch(err => console.error(`Title generation failed for ${storyId}:`, err));

        // Generate image asynchronously
        imageGenerator.generateSceneImage(opening.image_prompt, storyId, 1)
            .then(async (imageUrl) => {
                const db2 = getDatabase(storyId);
                await db2.init();
                await db2.run('UPDATE scenes SET image_url = ? WHERE id = ?', [imageUrl, sceneId]);
                db2.close();
                console.log(`✅ [${storyId}] Opening image generated`);
            })
            .catch(err => console.error(`Image generation failed for ${storyId}:`, err));

    } catch (error) {
        console.error(`❌ [${storyId}] Story generation failed:`, error);
        await db.run('UPDATE stories SET generation_status = ? WHERE id = ?', ['error', storyId]);
        db.close();
        throw error;
    }
}

// Check story generation status
app.get('/api/story/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        const story = await db.get('SELECT generation_status FROM stories WHERE id = ?', [id]);
        db.close();

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        const status = story.generation_status || 'generating';
        res.json({
            status,
            ready: status === 'complete',
            error: status === 'error'
        });

    } catch (error) {
        console.error('Error checking story status:', error);
        res.json({ status: 'error', ready: false, error: true });
    }
});

// Get story details
app.get('/api/story/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        const story = await db.getStory(id);

        if (!story) {
            db.close();
            return res.status(404).json({ error: 'Story not found' });
        }

        // Get current scene
        const currentScene = await db.getSceneByNumber(id, story.current_scene_number);
        const choices = currentScene ? await db.getChoicesForScene(currentScene.id) : [];

        // Add furigana to narrative and choices if Japanese
        if (currentScene && story.language === 'ja') {
            currentScene.narrative_text = await processFurigana(currentScene.narrative_text, story.language);

            // Add furigana to choice text
            for (const choice of choices) {
                choice.choice_text = await processFurigana(choice.choice_text, story.language);
            }
        }

        db.close();

        res.json({
            story,
            current_scene: currentScene,
            choices
        });

    } catch (error) {
        console.error('Error fetching story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// Get complete story for book reader (all scenes)
app.get('/api/story/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        const story = await db.getStory(id);

        if (!story) {
            db.close();
            return res.status(404).json({ error: 'Story not found' });
        }

        // Get all scenes in order
        const scenes = await db.all(
            'SELECT * FROM scenes WHERE story_id = ? ORDER BY scene_number ASC',
            [id]
        );

        // Build pages - check for portrait versions of images
        const pages = [];
        for (const scene of scenes) {
            // Narrative
            if (scene.narrative_text) {
                // Check if portrait version exists for book view
                let bookImageUrl = scene.image_url;
                if (scene.image_url && scene.image_url.includes('/scene-')) {
                    const portraitUrl = scene.image_url.replace(/\/scene-(\d+)\.png$/, '/scene-$1-portrait.png');
                    const portraitPath = '/var/www/html' + portraitUrl;
                    try {
                        if (require('fs').existsSync(portraitPath)) {
                            bookImageUrl = portraitUrl;
                        }
                    } catch (e) {
                        // Keep original
                    }
                }

                pages.push({
                    type: 'narrative',
                    scene_number: scene.scene_number,
                    text: scene.narrative_text,
                    image_url: bookImageUrl,
                    image_prompt: scene.image_prompt
                });
            }
        }

        // Add furigana if Japanese
        if (story.language === 'ja') {
            for (const page of pages) {
                if (page.text) {
                    page.text = await processFurigana(page.text, story.language);
                }
            }
        }

        db.close();

        res.json({
            story: {
                id: story.id,
                title: story.title,
                genre: story.genre,
                language: story.language,
                maturity_level: story.maturity_level,
                book_cover_url: story.book_cover_url,
                ending_type: story.ending_reached,
                is_complete: story.is_complete
            },
            pages
        });

    } catch (error) {
        console.error('Error fetching complete story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// Make a choice and advance story (supports both GET with query param and POST with body for SSE)
app.get('/api/story/:id/choice', checkLockdown('storypath'), handleChoice);
app.post('/api/story/:id/choice', checkLockdown('storypath'), handleChoice);

async function handleChoice(req, res) {
    try {
        const { id } = req.params;
        const choice_index = req.body?.choice_index || parseInt(req.query?.choice_index);

        const db = getDatabase(id);
        await db.init();

        // Get story and current scene
        const story = await db.getStory(id);

        // Alert if stranger is advancing a story
        notifyIfStranger(req, `📖 StoryPath: Choice made in "${story?.title || id}"`);

        const currentScene = await db.getSceneByNumber(id, story.current_scene_number);

        // Mark choice as selected
        const selectedChoice = await db.markChoiceSelected(currentScene.id, choice_index);

        // Get context for next scene
        const recentScenes = await db.getRecentScenes(id, 10);
        const importantEvents = await db.getImportantEvents(id, 15);
        const inventory = await db.getInventory(id);
        const relationships = await db.getRelationships(id);

        // Set up SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders(); // Send headers immediately

        // Generate next scene with REAL streaming from Claude SDK
        console.log(`🎭 Generating scene ${story.current_scene_number + 1}...`);

        const nextScene = await storyEngine.generateNextSceneStreaming({
            story,
            recentScenes,
            importantEvents,
            inventory,
            relationships
        }, selectedChoice, (text, isParagraphBreak) => {
            // Callback fires when a chunk is ready
            // Strip ruby tags from text
            let cleanText = text.replace(/<ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby>/g, '$1');
            cleanText = cleanText.replace(/<ruby><ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby><rt>[^<]*<\/rt><\/ruby>/g, '$1');
            res.write(`data: ${JSON.stringify({ type: 'text_fragment', text: cleanText, is_new_paragraph: isParagraphBreak })}\n\n`);
        });

        console.log(`✅ Claude API streaming complete`);

        const nextSceneNumber = story.current_scene_number + 1;

        // Add furigana to choices if Japanese (do this NOW before sending metadata)
        const choicesWithFurigana = nextScene.choices;
        if (story.language === 'ja') {
            const fs = require('fs');
            fs.appendFileSync('/tmp/furigana-debug.log', '\n=== BEFORE STRIPPING ===\n');
            for (const choice of choicesWithFurigana) {
                fs.appendFileSync('/tmp/furigana-debug.log', `ORIGINAL: ${choice.text}\n`);
                // Strip ruby tags because Claude generates them incorrectly
                choice.text = choice.text.replace(/<ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby>/g, '$1');
                choice.text = choice.text.replace(/<ruby><ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby><rt>[^<]*<\/rt><\/ruby>/g, '$1');
                fs.appendFileSync('/tmp/furigana-debug.log', `AFTER STRIP: ${choice.text}\n`);
                choice.text = await processFurigana(choice.text, story.language);
                fs.appendFileSync('/tmp/furigana-debug.log', `AFTER PROCESS: ${choice.text}\n`);
            }
        }

        // Send metadata IMMEDIATELY - don't wait for database work
        res.write(`data: ${JSON.stringify({
            type: 'metadata',
            data: {
                scene_number: nextSceneNumber,
                choices: choicesWithFurigana,
                image_url: '/storypath/images/placeholder-scene.png',
                state_changes: nextScene.state_changes,
                story_complete: nextScene.story_complete || false,
                ending_type: nextScene.ending_type || null
            }
        })}\n\n`);

        res.end();

        // Do database work asynchronously AFTER response is sent
        (async () => {
            try {
                // Strip ruby tags from narrative before saving
                let cleanNarrative = nextScene.narrative;
                cleanNarrative = cleanNarrative.replace(/<ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby>/g, '$1');
                cleanNarrative = cleanNarrative.replace(/<ruby><ruby>([^<]+)<rt>[^<]*<\/rt><\/ruby><rt>[^<]*<\/rt><\/ruby>/g, '$1');

                const sceneId = await db.addScene({
                    story_id: id,
                    scene_number: nextSceneNumber,
                    narrative_text: cleanNarrative,
                    image_prompt: nextScene.image_prompt,
                    image_url: null
                });

                await db.addChoices(sceneId, choicesWithFurigana);
                await db.updateCurrentScene(id, nextSceneNumber);
                await db.updateLastPlayed(id);

                // Process state changes
                if (nextScene.state_changes) {
                    const stateUpdates = {};

                    if (nextScene.state_changes.hp_delta) {
                        stateUpdates.hp = Math.max(0, story.hp + nextScene.state_changes.hp_delta);
                    }

                    if (Object.keys(stateUpdates).length > 0) {
                        await db.updateStoryState(id, stateUpdates);
                    }

                    // Add items
                    if (nextScene.state_changes.items_gained) {
                        for (const item of nextScene.state_changes.items_gained) {
                            await db.addInventoryItem(id, item, '', sceneId);
                        }
                    }

                    // Update relationships
                    if (nextScene.state_changes.relationships_changed) {
                        for (const [character, delta] of Object.entries(nextScene.state_changes.relationships_changed)) {
                            await db.updateRelationship(id, character, delta, sceneId);
                        }
                    }
                }

                // Add events
                if (nextScene.important_events && nextScene.important_events.length > 0) {
                    for (const event of nextScene.important_events) {
                        await db.addEvent({
                            story_id: id,
                            event_type: 'plot_point',
                            summary: event,
                            importance: 7,
                            scene_id: sceneId
                        });
                    }
                }

                // Add choice event
                await db.addEvent({
                    story_id: id,
                    event_type: 'choice',
                    summary: `Player chose: ${selectedChoice}`,
                    importance: 6,
                    scene_id: currentScene.id
                });

                // Mark story as complete if ending reached
                if (nextScene.story_complete) {
                    await db.run(
                        'UPDATE stories SET is_complete = 1, ending_reached = ? WHERE id = ?',
                        [nextScene.ending_type || 'complete', id]
                    );
                    console.log(`📚 Story completed with ending: ${nextScene.ending_type || 'complete'}`);
                }

                db.close();

                // Generate image asynchronously
                imageGenerator.generateSceneImage(nextScene.image_prompt, id, nextSceneNumber)
                    .then(async (imageUrl) => {
                        const db2 = getDatabase(id);
                        await db2.init();
                        await db2.run('UPDATE scenes SET image_url = ? WHERE id = ?', [imageUrl, sceneId]);
                        db2.close();
                        console.log(`✅ Scene ${nextSceneNumber} image generated`);
                    })
                    .catch(err => console.error('Image generation failed:', err));
            } catch (err) {
                console.error('Error saving scene to database:', err);
            }
        })();

    } catch (error) {
        console.error('Error processing choice:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
}

// Check image status
app.get('/api/story/:id/image/:sceneNumber', async (req, res) => {
    try {
        const { id, sceneNumber } = req.params;
        const db = getDatabase(id);
        await db.init();

        const scene = await db.getSceneByNumber(id, parseInt(sceneNumber));
        db.close();

        if (scene && scene.image_url && scene.image_url !== '/storypath/images/placeholder-scene.png') {
            res.json({ ready: true, url: scene.image_url });
        } else {
            res.json({ ready: false });
        }
    } catch (error) {
        res.json({ ready: false });
    }
});

// Password verification
app.post('/api/story/unlock', async (req, res) => {
    try {
        const { story_id, password } = req.body;
        const db = getDatabase(story_id);
        await db.init();

        const story = await db.get('SELECT password_hash FROM stories WHERE id = ?', [story_id]);
        db.close();

        if (!story || !story.password_hash) {
            return res.json({ success: true }); // No password protection
        }

        const isValid = await bcrypt.compare(password, story.password_hash);

        if (isValid) {
            // Generate simple token (in production, use JWT)
            const token = Buffer.from(`${story_id}:${Date.now()}`).toString('base64');
            res.json({ success: true, token });
        } else {
            res.json({ success: false, error: 'Invalid password' });
        }
    } catch (error) {
        console.error('Error unlocking story:', error);
        res.status(500).json({ error: 'Failed to verify password' });
    }
});

// Story history (all scenes)
app.get('/api/story/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        const scenes = await db.getAllScenes(id);

        // Get choices for each scene
        for (const scene of scenes) {
            scene.choices = await db.getChoicesForScene(scene.id);
        }

        db.close();
        res.json({ scenes });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});


// ===== BOOK COMPILATION ENDPOINTS =====

// Get book compilation status
app.get('/api/story/:id/book-status', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        // Add columns if they don't exist (migration)
        await db.run('ALTER TABLE stories ADD COLUMN book_status TEXT DEFAULT "none"').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_progress INTEGER DEFAULT 0').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_layout TEXT').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_compiled_at DATETIME').catch(() => {});

        const story = await db.get(
            'SELECT book_status, book_progress FROM stories WHERE id = ?', 
            [id]
        );
        db.close();

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        res.json({
            status: story.book_status || 'none',
            progress: story.book_progress || 0
        });
    } catch (error) {
        console.error('Error getting book status:', error);
        res.status(500).json({ error: 'Failed to get book status' });
    }
});

// Get pre-compiled book layout
app.get('/api/story/:id/book-layout', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        const story = await db.get(
            'SELECT book_status, book_layout, title, language, genre, book_cover_url, ending_reached FROM stories WHERE id = ?',
            [id]
        );
        db.close();

        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        if (story.book_status !== 'ready' || !story.book_layout) {
            return res.status(400).json({ error: 'Book not compiled yet' });
        }

        res.json({
            layout: JSON.parse(story.book_layout)
        });
    } catch (error) {
        console.error('Error getting book layout:', error);
        res.status(500).json({ error: 'Failed to get book layout' });
    }
});

// Trigger book compilation (client-side compilation, stores result)
app.post('/api/story/:id/compile-book', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase(id);
        await db.init();

        // Mark as compiling
        await db.run('ALTER TABLE stories ADD COLUMN book_status TEXT DEFAULT "none"').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_progress INTEGER DEFAULT 0').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_layout TEXT').catch(() => {});
        await db.run('ALTER TABLE stories ADD COLUMN book_compiled_at DATETIME').catch(() => {});
        
        await db.run(
            'UPDATE stories SET book_status = ?, book_progress = ? WHERE id = ?',
            ['compiling', 0, id]
        );

        db.close();
        res.json({ success: true, message: 'Compilation started' });

    } catch (error) {
        console.error('Error starting compilation:', error);
        res.status(500).json({ error: 'Failed to start compilation' });
    }
});

// Save compiled book layout (called by client after compilation)
app.post('/api/story/:id/book-layout', async (req, res) => {
    try {
        const { id } = req.params;
        const { layout } = req.body;

        if (!layout) {
            return res.status(400).json({ error: 'Layout is required' });
        }

        const db = getDatabase(id);
        await db.init();

        await db.run(
            'UPDATE stories SET book_status = ?, book_progress = ?, book_layout = ?, book_compiled_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['ready', 100, JSON.stringify(layout), id]
        );

        db.close();
        res.json({ success: true });

    } catch (error) {
        console.error('Error saving book layout:', error);
        res.status(500).json({ error: 'Failed to save book layout' });
    }
});

// Update compilation progress
app.post('/api/story/:id/book-progress', async (req, res) => {
    try {
        const { id } = req.params;
        const { progress } = req.body;

        const db = getDatabase(id);
        await db.init();

        await db.run(
            'UPDATE stories SET book_progress = ? WHERE id = ?',
            [progress, id]
        );

        db.close();
        res.json({ success: true });

    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Generate TTS audio
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voice } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Create cache key from text and voice
        const cacheKey = crypto.createHash('md5').update(`${text}-${voice}`).digest('hex');
        const cachePath = path.join(__dirname, 'audio', 'cache', `${cacheKey}.mp3`);

        // Check cache first
        try {
            await fsPromises.access(cachePath);
            const cachedAudio = await fsPromises.readFile(cachePath);
            res.set('Content-Type', 'audio/mpeg');
            res.set('X-Cache', 'HIT');
            return res.send(cachedAudio);
        } catch (e) {
            // Cache miss, continue to generate
        }

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const mp3 = await openai.audio.speech.create({
            model: "tts-1-hd",
            voice: voice || "alloy",
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        
        // Save to cache
        try {
            await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
            await fsPromises.writeFile(cachePath, buffer);
        } catch (e) {
            console.error('Failed to cache audio:', e);
        }
        
        res.set('Content-Type', 'audio/mpeg');
        res.set('X-Cache', 'MISS');
        res.send(buffer);

    } catch (error) {
        console.error('TTS generation failed:', error);
        res.status(500).json({ error: 'TTS generation failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'StoryPath' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎭 StoryPath server running on port ${PORT}`);
    console.log(`📖 Frontend: http://localhost:${PORT}`);
    console.log(`🎨 Image API: FLUX 1.1 Pro via Replicate`);
});
