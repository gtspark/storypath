-- StoryPath Database Schema
-- Simple, story-focused design for choose-your-own-adventure games

-- Stories metadata
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    genre TEXT NOT NULL,  -- fantasy, scifi, mystery, adventure, horror
    language TEXT DEFAULT 'en',  -- en or ja
    difficulty TEXT DEFAULT 'balanced',  -- casual, balanced, hardcore
    maturity_level TEXT DEFAULT 'kids',  -- kids, adults
    protagonist_name TEXT,
    protagonist_gender TEXT,
    protagonist_archetype TEXT,
    story_seed TEXT,  -- Custom story idea from user
    story_arc TEXT,  -- AI-generated story outline: key secrets, ending, and guidance (NOT a rigid timeline)
    book_cover_url TEXT,  -- FLUX-generated book cover image for shelf display
    password_hash TEXT,  -- bcrypt hash, null if no password
    is_password_protected BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_played DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_complete BOOLEAN DEFAULT 0,
    ending_reached TEXT,
    current_scene_number INTEGER DEFAULT 0
);

-- Current story state (one per story)
CREATE TABLE IF NOT EXISTS story_state (
    story_id TEXT PRIMARY KEY,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    inventory TEXT DEFAULT '[]',  -- JSON array of items
    stats TEXT DEFAULT '{}',  -- JSON object: karma, relationships, etc.
    custom_flags TEXT DEFAULT '{}',  -- JSON for story-specific tracking
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Story progression (all scenes)
CREATE TABLE IF NOT EXISTS scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    scene_number INTEGER NOT NULL,
    narrative_text TEXT NOT NULL,
    image_prompt TEXT,
    image_url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Player choices for each scene
CREATE TABLE IF NOT EXISTS choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id INTEGER NOT NULL,
    choice_text TEXT NOT NULL,
    choice_type TEXT DEFAULT 'action',  -- action, dialogue, investigate
    ending_path BOOLEAN DEFAULT 0,  -- marks choice as moving toward story conclusion
    was_selected BOOLEAN DEFAULT 0,
    selected_at DATETIME,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

-- Story events for RAG (retrieval augmented generation)
CREATE TABLE IF NOT EXISTS story_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- choice, item_gained, character_met, plot_point, etc.
    summary TEXT NOT NULL,
    entities TEXT DEFAULT '[]',  -- JSON: characters, locations, items involved
    importance INTEGER DEFAULT 5,  -- 1-10 for RAG retrieval weighting
    embedding_vector TEXT,  -- JSON array (optional for now, can add later)
    scene_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL
);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    acquired_scene_id INTEGER,
    is_equipped BOOLEAN DEFAULT 0,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- NPC relationships
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    relationship_level INTEGER DEFAULT 0,  -- -100 to 100
    first_met_scene_id INTEGER,
    notes TEXT,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_scenes_story ON scenes(story_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_choices_scene ON choices(scene_id);
CREATE INDEX IF NOT EXISTS idx_events_story ON story_events(story_id, importance);
CREATE INDEX IF NOT EXISTS idx_inventory_story ON inventory_items(story_id);
CREATE INDEX IF NOT EXISTS idx_relationships_story ON relationships(story_id);
