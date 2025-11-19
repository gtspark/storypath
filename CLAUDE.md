# Claude Code Reference

## Project Layout

**Two directories for one project:**
- **Frontend**: `/var/www/html/storypath/` - Static HTML/CSS/JS, served by nginx
  - Has git credentials configured
  - Use this directory for `git push`
- **Backend**: `/opt/vodbase/storypath/` - Node.js server, AI logic, database
  - No git credentials (fails to push)
  - Copy backend changes to frontend to push

**When making backend changes:**
```bash
# 1. Edit files in /opt/vodbase/storypath/
# 2. Copy to frontend
cp /opt/vodbase/storypath/server.js /var/www/html/storypath/
cp /opt/vodbase/storypath/ai/*.js /var/www/html/storypath/ai/
# 3. Commit and push from frontend
cd /var/www/html/storypath && git add -A && git commit && git push
```

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
