# StoryPath Improvement Plan

## Executive Summary

After a thorough review of the StoryPath codebase, I've identified **15 improvements** across 4 categories, prioritized by impact and effort. The most critical issue is that **stories don't naturally end** - Claude ignores the ending instructions despite them existing in the prompt.

---

## CRITICAL: Stories Don't End (The #1 Bug)

### Problem
When I played through 23 scenes of "The Fractured Compass", the story never ended. Claude keeps generating scenes indefinitely despite having explicit ending instructions.

### Root Cause Analysis

**StoryEngine.js** has conflicting instructions:

1. **Line 375** says:
   ```
   8. Never end the story abruptly - always provide meaningful choices
   ```

2. **Lines 773-793** describe ending logic:
   ```
   **ENDING THE STORY** (Evaluate after EVERY scene)
   After generating each scene, review the story arc's "Intended ending"...
   → Generate ONE final choice that will determine the specific ending type
   → Mark it: {"is_final_choice": true, ...}
   → End with: {"story_complete": true, "ending_type": "..."}
   ```

3. **Line 765** says:
   ```
   Let story length unfold naturally. Don't rush it
   ```

### The Conflict
Claude interprets "Never end the story abruptly" + "Don't rush it" as **never** presenting the final choice. The ending instructions are buried at the bottom and the "don't end" instruction comes first.

### Proposed Fix

**Option A: Restructure the prompt hierarchy**
- Move ending evaluation to the TOP of the dynamic prompt (buildNextScenePrompt)
- Add explicit scene counting: "After ~20-30 scenes, evaluate if story arc is complete"
- Change "Never end the story abruptly" to "Ensure endings feel earned, not abrupt"

**Option B: Add explicit triggers**
- Count scenes in the prompt: "Current scene: 23 of approximately 25-40"
- If scene > 25 AND player is near resolution path → must include one choice that leads to ending
- If scene > 40 → one choice MUST be marked `is_final_choice: true`

**Option C: Two-phase generation**
- After each scene, make a separate Claude call asking: "Based on the story arc and current state, is this the climax moment? Answer YES or NO"
- If YES, regenerate the scene with mandatory `is_final_choice` flag

**Recommendation**: Option A (prompt restructuring) - simplest, no additional API calls

---

## Priority 1: High Impact, Low Effort

### 1. Fix Story Ending (see above)
- **Effort**: 1 hour
- **Impact**: Critical - stories are currently infinite

### 2. Replace `alert()` with Toast Notifications
- **Location**: 9 instances across app (game.js, index.js, wizard.js)
- **Effort**: 30 minutes
- **Impact**: Professional UX, non-blocking feedback
- **How**: Create simple toast component with CSS animations

### 3. Add Exponential Backoff to Wizard Polling
- **Location**: `wizard.js` and `preview.js`
- **Current**: Fixed 2-second intervals
- **Proposed**: Start at 1s, double up to 8s max
- **Effort**: 15 minutes
- **Impact**: 50% reduction in API calls during generation

### 4. Add Exponential Backoff to Image Polling
- **Location**: `game.js:477-495`
- **Current**: Fixed 3-second intervals forever
- **Proposed**: Start at 2s, max 10s, timeout after 60s
- **Effort**: 15 minutes
- **Impact**: 60% reduction in requests, proper timeout

---

## Priority 2: Medium Impact, Medium Effort

### 5. Add Story Completion UI
- **Problem**: When `story_complete: true` is returned, there's no special handling
- **Location**: `game.js:389-430` and `server.js:579-585`
- **Proposed**:
  - Detect `story_complete` in metadata handler
  - Show special "THE END" screen with ending type
  - Add "Read as Book" and "Start New Story" buttons
  - Trigger celebration animation/confetti
- **Effort**: 2 hours
- **Impact**: Satisfying story conclusions

### 6. Add `/api/story/:id/title` Endpoint
- **Problem**: `preview.html` polls the entire story object just to check title
- **Location**: `server.js` - new endpoint needed
- **Effort**: 30 minutes
- **Impact**: 95% bandwidth reduction on title polling

### 7. Fix Furigana Inconsistency
- **Problem**: Multiple competing furigana systems causing bugs
- **Locations**:
  - `server.js:46-82` - parseFurigana (strips ruby tags)
  - `game.js:14-36` - parseFurigana (converts brackets)
  - `utils/FuriganaHelper.js` - kuromoji fallback
- **Proposed**: Standardize on bracket notation `漢字《かんじ》` throughout
  - Claude generates brackets (already configured)
  - Server strips all ruby tags, keeps brackets
  - Frontend converts brackets to ruby tags
  - Remove kuromoji fallback (adds latency, often wrong)
- **Effort**: 1 hour
- **Impact**: Consistent Japanese text rendering

### 8. Store Story Data in DOM/LocalStorage
- **Problem**: `index.js` re-fetches all stories when opening password modal
- **Location**: `index.js` story list rendering
- **Proposed**: Store story data as `data-*` attributes or localStorage
- **Effort**: 45 minutes
- **Impact**: Instant modal opens, -95% data transfer

---

## Priority 3: Lower Impact, Higher Effort

### 9. Add Loading States to Password Unlock
- **Location**: Password modal in `index.js`
- **Effort**: 20 minutes
- **Impact**: Better UX (spinner/disabled state)

### 10. Add Auto-Retry with Exponential Backoff
- **Problem**: Network errors just show `alert()` and fail
- **Location**: All fetch calls in frontend
- **Proposed**: Utility function with 3 retries, exponential delay
- **Effort**: 1 hour
- **Impact**: Better resilience on flaky connections

### 11. Implement Optimistic UI for Choice Selection
- **Problem**: Choices feel laggy because we wait for API
- **Location**: `game.js:285-454`
- **Proposed**:
  - Immediately highlight selected choice
  - Start skeleton loading before API responds
  - Roll back if API fails
- **Effort**: 1.5 hours
- **Impact**: +200-300ms perceived speed

### 12. Add Story Deletion from UI
- **Problem**: No way to delete stories from the UI
- **Location**: `index.html`, `index.js`, `server.js`
- **Proposed**: Add delete button with confirmation
- **Effort**: 1 hour
- **Impact**: User story management

---

## Priority 4: Quality of Life

### 13. Add Scene Counter to Game UI
- **Problem**: Users don't know how far into the story they are
- **Location**: `game.html` stats bar
- **Proposed**: Show "Scene 15" or "Chapter 15"
- **Effort**: 10 minutes
- **Impact**: Better progress awareness

### 14. Add "Continue from Scene X" for Completed Stories
- **Problem**: Can only read completed stories as book, not continue playing
- **Location**: `index.js`, `game.js`
- **Proposed**: Allow jumping to any previous scene and making different choices
- **Effort**: 3 hours
- **Impact**: Replayability, branching exploration

### 15. Add Story Export (PDF/EPUB)
- **Problem**: No way to save completed stories offline
- **Location**: New feature in `server.js` + frontend
- **Proposed**: Export as PDF or EPUB with images
- **Effort**: 4+ hours
- **Impact**: Keepsake stories, sharing

---

## Implementation Order

### Week 1 (Critical Path)
1. **Fix story ending mechanism** (1 hour) - THE critical bug
2. Replace alerts with toasts (30 min)
3. Add exponential backoff to polling (30 min)
4. Add story completion UI (2 hours)

### Week 2 (Polish)
5. Add `/api/story/:id/title` endpoint (30 min)
6. Fix furigana consistency (1 hour)
7. Store story data in DOM (45 min)
8. Add loading states (20 min)

### Week 3+ (Nice to Have)
9. Auto-retry with backoff
10. Optimistic UI
11. Story deletion
12. Scene counter
13. Continue from scene X
14. Story export

---

## Technical Debt Notes

### Things NOT to Fix (Over-engineering)
- WebSockets for story generation - SSE works fine, story generation is one-time
- Service workers - requires online APIs (Claude, FLUX, OpenAI)
- PostgreSQL migration - SQLite is fine for single-user instance
- JWT tokens - Base64 tokens are fine for personal use

### Security Notes (For Reference)
The explore agent flagged these, but for a personal/family app they're acceptable:
- API keys in .env (normal for Node.js apps)
- Base64 tokens (fine for personal use, would need JWT for multi-user)
- No rate limiting (fine for single household)

---

## Ending Instructions Fix (Detailed)

Replace StoryEngine.js lines 750-795 with:

```javascript
return `# Current scene number: ${currentScene}

# STORY ENDING EVALUATION (CHECK FIRST!)
Current progress: Scene ${currentScene}
Story arc resolution criteria from story_arc's "Intended ending":
- Review if player has reached a resolution path
- If scene >= 20 AND near climax → MUST include at least one choice leading to finale
- If scene >= 35 → At least one choice MUST be marked {"is_final_choice": true}

When conditions are met:
→ Generate ONE final choice: {"is_final_choice": true, "text": "...", "type": "action", "emoji": "⚡"}
→ After player selects final choice: generate LONG conclusion (6-10 paragraphs)
→ End with: {"story_complete": true, "ending_type": "triumph|tragedy|bittersweet|mystery"}

# Story Context
${JSON.stringify(context, null, 2)}

# Player's Last Choice
"${playerChoice}"

Generate the next scene. Guidelines:
- Use heat map to assess player progress toward truth
- Include ${story.maturity_level === 'kids' ? 'gentle dead-ends' : 'real dead-ends'} in choices
- Don't reveal core secrets too early
- Avoid repeating narrative beats from recent_scenes
- Ensure endings feel earned (not abrupt), but DO end when arc is complete`;
```

Key changes:
1. **Moved ending evaluation to TOP** of the prompt
2. **Added explicit scene thresholds** (20 for hints, 35 for required)
3. **Removed "Never end the story abruptly"** - replaced with "ensure endings feel earned"
4. **Removed "Don't rush it"** - replaced with "DO end when arc is complete"

---

## Files to Modify

| File | Changes |
|------|---------|
| `ai/StoryEngine.js` | Fix ending instructions (Priority 1) |
| `js/game.js` | Toasts, backoff, completion UI, optimistic UI |
| `js/index.js` | Toasts, DOM storage, delete stories |
| `js/wizard.js` | Toasts, exponential backoff |
| `server.js` | /title endpoint, delete endpoint |
| `css/game.css` | Toast styles, completion screen |

---

*Plan created by Opus 4.5 - November 2025*
