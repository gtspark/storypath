# Claude Code Reference

## Git Workflow (IMPORTANT!)

**ONLY work in `/opt/vodbase/storypath/` - it's the single source of truth.**

```bash
# Make all edits in backend directory
cd /opt/vodbase/storypath

# Edit any files (backend OR frontend)
vim server.js
vim js/game.js
vim css/main.css

# Commit and push (auto-syncs frontend files to /var/www/html/storypath/)
git add -A
git commit -m "Your message"
git push origin master
```

**DO NOT edit files in `/var/www/html/storypath/` - they are auto-synced and will be overwritten!**

The post-commit hook automatically copies frontend files (HTML/CSS/JS/images) to the web directory.

## Cache Busting

When making changes to CSS/JS files that aren't showing up in the browser:

```bash
# Run the cache bust script
cd /var/www/html/storypath
./bump-version.sh

# Restart nginx
sudo systemctl restart nginx

# Commit and push
git add -A
git commit -m "Bump version for cache bust"
git push
```

The `bump-version.sh` script:
- Automatically increments version numbers across all HTML files
- Updates `?v=XX` parameters on CSS and JS file references
- Covers: index.html, wizard.html, preview.html, game.html

## Project Structure

- `index.html` - Home page
- `wizard.html` - Story creation wizard
- `preview.html` - Story preview with title animations
- `game.html` - Main game/story viewer with SSE streaming
- `css/` - Stylesheets
  - `main.css` - Global styles
  - `game.css` - Game page specific styles
- `js/` - JavaScript files
  - `i18n.js` - Internationalization

## Japanese Language Support

### Furigana Handling

The `parseFurigana()` function in game.html handles two formats:
1. **Legacy format**: `漢字《かんじ》` → converts to HTML ruby tags
2. **HTML format**: `<ruby>漢字<rt>かんじ</rt></ruby>` → uses directly

If text contains HTML ruby tags, the function strips `《》` brackets to prevent double furigana.

### Typography Normalization

`normalizeJapaneseTypography()` in game.html:
- Removes stray spaces between Japanese characters
- Replaces ASCII hyphens with vertical dash `︱` when surrounded by Japanese
- Removes accidental slashes (す/る → する)

### Vertical Text CSS

For Japanese vertical text (`.ja-vertical` class):
- Uses `writing-mode: vertical-rl`
- `text-orientation: upright`
- `line-break: strict` - proper Japanese line breaking
- `word-break: keep-all` - prevents splitting words
- `overflow-wrap: normal` - no forced wrapping

Applied to:
- `.story-view.ja-vertical .narrative-panel`
- `.story-view.ja-vertical .narrative-text`
- `.story-view.ja-vertical .choice-button`

## Common Issues

### Browser Not Showing Changes
1. Run `./bump-version.sh`
2. Restart nginx: `sudo systemctl restart nginx`
3. Hard refresh in browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

### Double Furigana
Make sure `parseFurigana()` is called on all text:
- Choice buttons (line ~270 in game.html)
- Narrative formatting (line ~247 in game.html)
- SSE streaming paragraphs (line ~335 in game.html)

### Image Box Collapsing
Scene-frame uses `width: fit-content` for Japanese to wrap tightly around images.
Has `min-width: 400px` to prevent collapse during image load.

### Skeleton Loading Not Showing
Japanese vertical mode uses vertical skeleton bars:
- Width: 60px
- Height: 70vh (max 800px)
- Vertical shimmer animation
- CSS in game.css around line ~994
