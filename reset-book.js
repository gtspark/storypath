#!/usr/bin/env node
/**
 * Reset Book Compilation
 * 
 * Clears the cached book layout for a story so it can be recompiled
 * with the latest compiler.
 * 
 * Usage:
 *   node reset-book.js <story-id>
 *   node reset-book.js --all          # Reset ALL completed stories
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const storiesDir = path.join(__dirname, 'stories');

function resetBook(storyId) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(storiesDir, `${storyId}.db`);
        
        if (!fs.existsSync(dbPath)) {
            console.log(`❌ Story not found: ${storyId}`);
            return resolve(false);
        }
        
        const db = new sqlite3.Database(dbPath);
        
        db.run(`
            UPDATE stories 
            SET book_status = 'none', 
                book_progress = 0, 
                book_layout = NULL 
            WHERE id = ?
        `, [storyId], function(err) {
            if (err) {
                console.log(`❌ Error resetting ${storyId}: ${err.message}`);
                db.close();
                return resolve(false);
            }
            
            if (this.changes > 0) {
                console.log(`✅ Reset book for: ${storyId}`);
            } else {
                console.log(`⚠️  No story found with ID: ${storyId}`);
            }
            
            db.close();
            resolve(true);
        });
    });
}

async function resetAllBooks() {
    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.db'));
    
    console.log(`Found ${files.length} story databases\n`);
    
    let resetCount = 0;
    
    for (const file of files) {
        const storyId = file.replace('.db', '');
        const dbPath = path.join(storiesDir, file);
        
        await new Promise((resolve) => {
            const db = new sqlite3.Database(dbPath);
            
            // Check if story is complete
            db.get('SELECT id, title, is_complete, book_status FROM stories', (err, row) => {
                if (err || !row) {
                    db.close();
                    return resolve();
                }
                
                if (row.is_complete) {
                    db.run(`
                        UPDATE stories 
                        SET book_status = 'none', 
                            book_progress = 0, 
                            book_layout = NULL
                    `, function(err) {
                        if (!err && this.changes > 0) {
                            console.log(`✅ Reset: "${row.title}" (${storyId})`);
                            resetCount++;
                        }
                        db.close();
                        resolve();
                    });
                } else {
                    db.close();
                    resolve();
                }
            });
        });
    }
    
    console.log(`\n📚 Reset ${resetCount} completed books`);
    console.log(`\nTo recompile, visit each book on the splash page or go to:`);
    console.log(`  /storypath/compile-book.html?story=<story-id>`);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage:');
    console.log('  node reset-book.js <story-id>    Reset a specific story');
    console.log('  node reset-book.js --all         Reset ALL completed stories');
    process.exit(1);
}

if (args[0] === '--all') {
    resetAllBooks().then(() => process.exit(0));
} else {
    resetBook(args[0]).then(() => process.exit(0));
}

