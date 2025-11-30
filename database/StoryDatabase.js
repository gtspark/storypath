const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

class StoryDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, async (err) => {
                if (err) {
                    reject(err);
                } else {
                    await this.createTables();
                    resolve();
                }
            });
        });
    }

    async createTables() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');

        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Helper methods
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Story CRUD operations
    async createStory(storyData) {
        const {
            id, title, genre, language, difficulty, maturity_level,
            protagonist_name, protagonist_gender, protagonist_archetype,
            story_seed, password_hash, is_password_protected
        } = storyData;

        await this.run(`
            INSERT INTO stories (
                id, title, genre, language, difficulty, maturity_level,
                protagonist_name, protagonist_gender, protagonist_archetype,
                story_seed, password_hash, is_password_protected
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, title, genre, language || 'en', difficulty || 'balanced', maturity_level || 'kids',
            protagonist_name, protagonist_gender, protagonist_archetype,
            story_seed, password_hash, is_password_protected ? 1 : 0
        ]);

        // Initialize story state
        await this.run(`
            INSERT INTO story_state (story_id) VALUES (?)
        `, [id]);

        return id;
    }

    async getStory(storyId) {
        return await this.get(`
            SELECT s.*, st.hp, st.max_hp, st.inventory, st.stats, st.custom_flags
            FROM stories s
            LEFT JOIN story_state st ON s.id = st.story_id
            WHERE s.id = ?
        `, [storyId]);
    }

    async getAllStories() {
        return await this.all(`
            SELECT
                id, title, genre, language, maturity_level, is_password_protected,
                current_scene_number, last_played, created_at, book_cover_url
            FROM stories
            ORDER BY last_played DESC
        `);
    }

    async updateLastPlayed(storyId) {
        await this.run(`
            UPDATE stories SET last_played = CURRENT_TIMESTAMP WHERE id = ?
        `, [storyId]);
    }

    async updateCurrentScene(storyId, sceneNumber) {
        await this.run(`
            UPDATE stories SET current_scene_number = ? WHERE id = ?
        `, [sceneNumber, storyId]);
    }

    // Scene operations
    async addScene(sceneData) {
        const { story_id, scene_number, narrative_text, image_prompt, image_url } = sceneData;

        const result = await this.run(`
            INSERT INTO scenes (story_id, scene_number, narrative_text, image_prompt, image_url)
            VALUES (?, ?, ?, ?, ?)
        `, [story_id, scene_number, narrative_text, image_prompt, image_url]);

        return result.id;
    }

    async getScene(sceneId) {
        return await this.get(`SELECT * FROM scenes WHERE id = ?`, [sceneId]);
    }

    async getSceneByNumber(storyId, sceneNumber) {
        return await this.get(`
            SELECT * FROM scenes WHERE story_id = ? AND scene_number = ?
        `, [storyId, sceneNumber]);
    }

    async getRecentScenes(storyId, limit = 3) {
        return await this.all(`
            SELECT * FROM scenes
            WHERE story_id = ?
            ORDER BY scene_number DESC
            LIMIT ?
        `, [storyId, limit]);
    }

    async getAllScenes(storyId) {
        return await this.all(`
            SELECT * FROM scenes WHERE story_id = ? ORDER BY scene_number ASC
        `, [storyId]);
    }

    // Choice operations
    async addChoices(sceneId, choices) {
        const stmt = this.db.prepare(`
            INSERT INTO choices (scene_id, choice_text, choice_type, ending_path)
            VALUES (?, ?, ?, ?)
        `);

        for (const choice of choices) {
            stmt.run(sceneId, choice.text, choice.type || 'action', choice.ending_path ? 1 : 0);
        }

        return new Promise((resolve, reject) => {
            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async markChoiceSelected(sceneId, choiceIndex) {
        const choices = await this.all(`
            SELECT * FROM choices WHERE scene_id = ? ORDER BY id ASC
        `, [sceneId]);

        if (choiceIndex >= 0 && choiceIndex < choices.length) {
            const choice = choices[choiceIndex];
            await this.run(`
                UPDATE choices SET was_selected = 1, selected_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [choice.id]);
            return choice.choice_text;
        }
        return null;
    }

    async getChoicesForScene(sceneId) {
        return await this.all(`SELECT * FROM choices WHERE scene_id = ? ORDER BY id ASC`, [sceneId]);
    }

    // Story state operations
    async updateStoryState(storyId, updates) {
        const { hp, inventory, stats, custom_flags } = updates;
        const fields = [];
        const values = [];

        if (hp !== undefined) {
            fields.push('hp = ?');
            values.push(hp);
        }
        if (inventory !== undefined) {
            fields.push('inventory = ?');
            values.push(JSON.stringify(inventory));
        }
        if (stats !== undefined) {
            fields.push('stats = ?');
            values.push(JSON.stringify(stats));
        }
        if (custom_flags !== undefined) {
            fields.push('custom_flags = ?');
            values.push(JSON.stringify(custom_flags));
        }

        if (fields.length > 0) {
            values.push(storyId);
            await this.run(`
                UPDATE story_state SET ${fields.join(', ')} WHERE story_id = ?
            `, values);
        }
    }

    async getStoryState(storyId) {
        const state = await this.get(`
            SELECT * FROM story_state WHERE story_id = ?
        `, [storyId]);

        if (state) {
            state.inventory = JSON.parse(state.inventory || '[]');
            state.stats = JSON.parse(state.stats || '{}');
            state.custom_flags = JSON.parse(state.custom_flags || '{}');
        }

        return state;
    }

    // Event operations (for RAG)
    async addEvent(eventData) {
        const { story_id, event_type, summary, entities, importance, scene_id } = eventData;

        return await this.run(`
            INSERT INTO story_events (story_id, event_type, summary, entities, importance, scene_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            story_id, event_type, summary,
            JSON.stringify(entities || []),
            importance || 5,
            scene_id
        ]);
    }

    async getImportantEvents(storyId, limit = 20) {
        const events = await this.all(`
            SELECT * FROM story_events
            WHERE story_id = ?
            ORDER BY importance DESC, timestamp DESC
            LIMIT ?
        `, [storyId, limit]);

        return events.map(e => ({
            ...e,
            entities: JSON.parse(e.entities || '[]')
        }));
    }

    // Inventory operations
    async addInventoryItem(storyId, itemName, description, sceneId) {
        return await this.run(`
            INSERT INTO inventory_items (story_id, item_name, description, acquired_scene_id)
            VALUES (?, ?, ?, ?)
        `, [storyId, itemName, description, sceneId]);
    }

    async getInventory(storyId) {
        return await this.all(`
            SELECT * FROM inventory_items WHERE story_id = ? ORDER BY acquired_scene_id DESC
        `, [storyId]);
    }

    async removeInventoryItem(storyId, itemName) {
        return await this.run(`
            DELETE FROM inventory_items WHERE story_id = ? AND item_name = ? LIMIT 1
        `, [storyId, itemName]);
    }

    // Relationship operations
    async updateRelationship(storyId, characterName, levelDelta, sceneId) {
        const existing = await this.get(`
            SELECT * FROM relationships WHERE story_id = ? AND character_name = ?
        `, [storyId, characterName]);

        if (existing) {
            const newLevel = Math.max(-100, Math.min(100, existing.relationship_level + levelDelta));
            await this.run(`
                UPDATE relationships SET relationship_level = ? WHERE id = ?
            `, [newLevel, existing.id]);
        } else {
            await this.run(`
                INSERT INTO relationships (story_id, character_name, relationship_level, first_met_scene_id)
                VALUES (?, ?, ?, ?)
            `, [storyId, characterName, levelDelta, sceneId]);
        }
    }

    async getRelationships(storyId) {
        return await this.all(`
            SELECT * FROM relationships WHERE story_id = ? ORDER BY first_met_scene_id DESC
        `, [storyId]);
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = StoryDatabase;
