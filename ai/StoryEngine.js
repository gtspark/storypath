const Anthropic = require('@anthropic-ai/sdk');

class StoryEngine {
    constructor(apiKey, model = 'claude-sonnet-4-5-20250929') {
        this.anthropic = new Anthropic({ apiKey });
        this.model = model;
    }

    async generateStoryTitle(storyConfig) {
        const { genre, language, protagonist_name, story_seed, story_arc, opening_narrative } = storyConfig;

        if (language === 'ja') {
            const prompt = `${genre}小説の魅力的なタイトルを生成してください。

主人公: ${protagonist_name || '名前なし'}
${story_seed ? `ストーリーコンセプト: ${story_seed}` : ''}
${story_arc ? `ストーリーアーク:\n${story_arc}` : ''}
${opening_narrative ? `オープニングシーン（最初の200文字）:\n${opening_narrative.substring(0, 200)}...` : ''}

要件:
- 実際の日本の小説のような本のタイトルにする
- 短く印象的（2-6単語）
- 命令形を使わない（「追え」「探せ」など禁止）
- 「の謎」「の秘密」などの説明的な言葉を避ける
- 良い例: 「容疑者Xの献身」「告白」「白夜行」「砂の女」「人間失格」「模倣犯」
- 悪い例: 「宝物を探せ」「犯人を追え」「謎を解け」
- ふりがなは不要

タイトルのみを返してください。説明や引用符は不要です。`;

            const response = await this.callClaude('あなたは小説のタイトル作成の専門家です。実際の日本の推理小説のような、文学的で洗練されたタイトルを作ります。', prompt, null, 'ja');
            return response.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
        }

        const prompt = `Generate a compelling title for a ${genre} novel.

Protagonist: ${protagonist_name || 'unnamed protagonist'}
${story_seed ? `Story concept: ${story_seed}` : ''}
${story_arc ? `Story arc:\n${story_arc}` : ''}
${opening_narrative ? `Opening scene (first 200 chars):\n${opening_narrative.substring(0, 200)}...` : ''}

Requirements:
- Sound like an actual published fiction novel
- Short and evocative (2-6 words)
- NO imperative verbs (no "Find...", "Chase...", "Catch...", "Solve...")
- NO descriptive phrases like "The Quest for..." or "The Mystery of..."
- Good examples: "Gone Girl", "The Silent Patient", "The Goldfinch", "Rebecca", "In Cold Blood", "The Secret History", "Sharp Objects"
- Bad examples: "Find the Killer", "Chase the Crystal", "Solve the Mystery", "The Quest for Gold"
- Think literary novel, not video game quest

Return ONLY the title. No explanations or quotes.`;

        const response = await this.callClaude('You are an expert at creating literary fiction titles. You create sophisticated, evocative titles like those found in real published novels.', prompt, null, 'en');
        return response.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
    }

    async generateStoryArc(storyConfig) {
        const { genre, language, difficulty, maturity_level, protagonist_name, story_seed, avoidThemes } = storyConfig;

        if (language === 'ja') {
            const prompt = `${genre}ストーリーの内部ガイドを作成してください。
${maturity_level === 'kids' ? '子供向け（6-8歳） - 絵本のような単純な物語。とても簡単で短い言葉を使う。怖くない、優しく楽しい冒険。' : '大人向け（18歳以上） - 暗い瞬間や深刻な危険もあり、実際の危機、道徳的なジレンマ、本当の結果（死も含む）。'}

主人公: ${protagonist_name || '名前なし'}
${story_seed ? `ストーリーコンセプト: ${story_seed}` : ''}

${avoidThemes && avoidThemes.length > 0 ? `⚠️ 重要: 以下のテーマや概念は既に他の物語で使用されているため、完全に避けてください：
${avoidThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

代わりに、完全に異なる設定、キャラクター、謎を探索してください。創造性を発揮し、陳腐な表現や過度に使用されたトロープを避けてください。
` : ''}

以下を定義してください：
1. **核心的な秘密**: ${genre === 'mystery' ? '真犯人、動機、隠されたつながり' : '重要な真実や謎（まだプレイヤーには知らされていない）'}
2. **理想的な結末**: ストーリーがどう解決するべきか（プレイヤーが正しい選択をした場合）${maturity_level === 'kids' ? ' - ハッピーエンドで、主人公は安全' : ' - 選択に応じて勝利または悲劇的な結末'}
3. **進行のヒートマップ**: プレイヤーが真実に近づいているか遠ざかっているかを判断する方法
4. **誤った道**: プレイヤーが取れる袋小路や誤った道（${maturity_level === 'kids' ? 'NPCや友達が優しくリダイレクトし、安全に戻る' : '実際の失敗、深刻な後退、または死につながる可能性がある'}）

重要: これはタイムラインではなく、内部知識です。シーン数を指定しないでください。ストーリーは必要に応じて展開します。`;

            const response = await this.callClaude('あなたは秘密を守るストーリープランナーです。このガイドはAIのみが見ます。', prompt, null, 'ja');
            return response.trim();
        }

        const prompt = `Create an internal guide for a ${genre} story.
${maturity_level === 'kids' ? 'For young children (ages 6-8) - Like a picture book for 2nd graders. Very simple language, short sentences. Gentle, safe, and fun.' : 'For mature adults (18+) - Can have dark moments, serious danger, real stakes, moral dilemmas, and genuine consequences including death.'}

Protagonist: ${protagonist_name || 'unnamed protagonist'}
${story_seed ? `Story concept: ${story_seed}` : ''}

${avoidThemes && avoidThemes.length > 0 ? `⚠️ CRITICAL: The following themes/concepts have already been used in other stories. You MUST completely avoid these:
${avoidThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Explore a COMPLETELY DIFFERENT setting, characters, and mysteries instead. Be creative and avoid clichés or overused tropes.
` : ''}

Define:
1. **Core secrets**: ${genre === 'mystery' ? 'Who the real culprit is, their motive, hidden connections' : 'The key truths or mysteries (not yet revealed to player)'}
2. **Intended ending**: How the story should resolve if player makes good choices${maturity_level === 'kids' ? ' - happy ending where protagonist is safe' : ' - can be triumphant or tragic depending on choices'}
3. **Progress heat map**: How to tell if player is getting warmer or colder to the truth
4. **Dead-end paths**: False leads or mistakes the player can make (${maturity_level === 'kids' ? 'NPCs or friends gently redirect them back to safety' : 'can lead to real failure, serious setbacks, or death'})

IMPORTANT: This is NOT a timeline. Don't specify scene numbers. The story unfolds as long as it needs to.`;

        const response = await this.callClaude('You are a story planner keeping secrets. This guide is for AI eyes only.', prompt, null, 'en');
        return response.trim();
    }

    async generateStoryOpening(storyConfig) {
        const { genre, language, difficulty, maturity_level, protagonist_name, protagonist_gender, protagonist_archetype, story_seed } = storyConfig;

        const systemPrompt = this.buildSystemPrompt(genre, language, difficulty, maturity_level);
        const userPrompt = this.buildOpeningPrompt(protagonist_name, protagonist_gender, protagonist_archetype, story_seed, language, maturity_level);

        const response = await this.callClaude(systemPrompt, userPrompt, null, language);
        return this.parseStoryResponse(response);
    }

    async generateNextScene(storyContext, playerChoice) {
        const { story, recentScenes, importantEvents, inventory, relationships } = storyContext;

        const systemPrompt = this.buildSystemPrompt(story.genre, story.language, story.difficulty, story.maturity_level);

        // Build cacheable context (story arc - doesn't change)
        const cacheableContext = this.buildCacheableContext(story);

        // Build dynamic prompt (changes each scene)
        const userPrompt = this.buildNextScenePrompt(story, recentScenes, importantEvents, inventory, relationships, playerChoice);

        const response = await this.callClaude(systemPrompt, userPrompt, cacheableContext, story.language);
        return this.parseStoryResponse(response);
    }

    async generateNextSceneStreaming(storyContext, playerChoice, onParagraph) {
        const { story, recentScenes, importantEvents, inventory, relationships } = storyContext;

        const systemPrompt = this.buildSystemPrompt(story.genre, story.language, story.difficulty, story.maturity_level);
        const cacheableContext = this.buildCacheableContext(story);
        const userPrompt = this.buildNextScenePrompt(story, recentScenes, importantEvents, inventory, relationships, playerChoice);

        console.log(`🔵 Claude API streaming call starting...`);
        const startTime = Date.now();

        const maxTokens = story.language === 'ja' ? 2500 : 1500;

        let systemContent;
        if (cacheableContext) {
            systemContent = [
                { type: 'text', text: systemPrompt },
                { type: 'text', text: cacheableContext, cache_control: { type: 'ephemeral' } }
            ];
        } else {
            systemContent = systemPrompt;
        }

        const stream = this.anthropic.messages.stream({
            model: this.model,
            max_tokens: maxTokens,
            temperature: 0.8,
            system: systemContent,
            messages: [{ role: 'user', content: userPrompt }]
        });

        let buffer = '';
        let inNarrative = false;
        let isNarrativeComplete = false;

        stream.on('text', (text) => {
            buffer += text;

            // 1. Detect start of narrative field
            if (!inNarrative && !isNarrativeComplete) {
                const narrativeMatch = buffer.match(/"narrative"\s*:\s*"/);
                if (narrativeMatch) {
                    inNarrative = true;
                    // Discard everything before the narrative value starts
                    const valueStartIndex = narrativeMatch.index + narrativeMatch[0].length;
                    buffer = buffer.substring(valueStartIndex);
                }
            }

            // 2. Process narrative content
            if (inNarrative) {
                // Check for end of narrative field (un-escaped quote)
                // We look for a quote that is NOT preceded by a backslash
                const endMatch = buffer.match(/(?<!\\)"/);

                let processableText = buffer;
                if (endMatch) {
                    processableText = buffer.substring(0, endMatch.index);
                    inNarrative = false;
                    isNarrativeComplete = true;
                }

                // 3. Scan for sentences in processableText
                // We will consume text from the start of 'buffer' (which is 'processableText' + remainder)

                const delimiters = /[.!?。](?:['"」』])?(?=\s|\\n|$)/g;
                let match;
                let lastSplitIndex = 0;

                // Search ONLY within the valid narrative range
                const searchLimit = isNarrativeComplete ? processableText.length : buffer.length;
                const searchRegion = buffer.substring(0, searchLimit);

                while ((match = delimiters.exec(searchRegion)) !== null) {
                    const relativeSplitPoint = match.index + match[0].length;

                    // Extract and send the sentence
                    const chunk = searchRegion.substring(lastSplitIndex, relativeSplitPoint);

                    if (chunk.trim()) {
                        const cleaned = chunk
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\')
                            .trim();

                        if (cleaned) {
                            const isParaBreak = chunk.includes('\\n\\n');
                            // console.log(`📤 Sent chunk: ${cleaned.substring(0, 20)}...`);
                            try {
                                onParagraph(cleaned, isParaBreak);
                            } catch (e) {
                                console.error('Error in streaming callback:', e);
                            }
                        }
                    }

                    lastSplitIndex = relativeSplitPoint;
                }

                // 4. Remove processed text from buffer
                if (lastSplitIndex > 0) {
                    buffer = buffer.substring(lastSplitIndex);
                }

                // 5. If narrative is complete, send any remaining text
                if (isNarrativeComplete && buffer.length > 0) {
                    // We need to find where the narrative ENDS in the CURRENT buffer.
                    // Since we shifted buffer, the quote position shifted too.
                    const finalEndMatch = buffer.match(/(?<!\\)"/);
                    if (finalEndMatch) {
                        const remainder = buffer.substring(0, finalEndMatch.index);
                        if (remainder.trim()) {
                            const cleaned = remainder
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\')
                                .trim();
                            if (cleaned) {
                                // console.log(`📤 Sent final chunk: ${cleaned.substring(0, 20)}...`);
                                try {
                                    onParagraph(cleaned, true);
                                } catch (e) { console.error('Error in streaming callback:', e); }
                            }
                        }
                        // Clear buffer to stop processing
                        buffer = '';
                    }
                }
            }
        });

        // Wait for the full response
        const message = await stream.finalMessage();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Claude API streamed in ${duration}s`);

        // Parse the complete response
        return this.parseStoryResponse(message.content[0].text);
    }

    buildCacheableContext(story) {
        // This content doesn't change during the story, so it can be cached
        const isJapanese = story.language === 'ja';

        if (isJapanese) {
            return `# 内部ストーリーガイド（プレイヤーには見えません）
${story.story_arc || 'ガイドなし'}

# 主人公
- 名前: ${story.protagonist_name || '名前なし'}
- 性別: ${story.protagonist_gender}
- アーキタイプ: ${story.protagonist_archetype}`;
        }

        return `# Internal Story Guide (Player cannot see this)
${story.story_arc || 'No guide defined'}

# Protagonist
- Name: ${story.protagonist_name || 'Unnamed'}
- Gender: ${story.protagonist_gender}
- Archetype: ${story.protagonist_archetype}`;
    }

    buildSystemPrompt(genre, language, difficulty, maturity_level) {
        const isJapanese = language === 'ja';

        if (isJapanese) {
            return this.buildJapaneseSystemPrompt(genre, difficulty, maturity_level);
        }

        // English system prompt
        const maturityGuidelines = maturity_level === 'adult'
            ? `# Maturity Level: ADULTS
- Real consequences: bad choices can lead to serious injury or DEATH
- If HP reaches 0 or player makes catastrophically bad choices, END THE STORY with a game over
- Dark themes, moral dilemmas, and genuine danger are appropriate
- Violence and peril should feel real and consequential
- When player dies, respond with: {"narrative": "...(describe death)", "game_over": true, "ending": "death", "choices": []}`
            : `# Maturity Level: KIDS (Ages 6-8)
- Write like a simple picture book for 2nd graders
- Use VERY simple vocabulary and short sentences
- Keep paragraphs short (2-3 sentences max)
- Never kill the player character - even at 0 HP, they get rescued or wake up safely
- Scary moments should be silly or very mild (like a grumpy squirrel)
- Focus on wonder, friendship, and helping others`;

        return `# Role
You are a fun, creative storyteller creating an interactive choose-your-own-adventure story in the ${genre} genre.

# Audience & Tone
${maturity_level === 'kids' ? 'For young children ages 6-8. Write like a picture book for 2nd graders. Very simple sentences, wholesome, and gentle.' : 'For mature adults (18+). Create genuine tension, real stakes, complex themes, and meaningful consequences.'}

${maturity_level === 'kids' ? `# Tone for Kids
- VERY simple language (2nd grade reading level)
- Short sentences and simple words
- Gentle and safe - no real danger
- Positive and uplifting - good always wins
- Whimsical and cute
- NO complex themes, NO violence` : `# Tone for Adults
- Serious and engaging with real emotional weight
- Suspenseful with genuine danger and consequences
- Mature themes appropriate for adults (death, moral dilemmas, real stakes)
- Player actions have lasting consequences - including death`}

${maturityGuidelines}

# Story Difficulty: ${difficulty}
${this.getDifficultyGuidelines(difficulty, maturity_level)}

# Your Task
Generate the next scene in JSON format:

{
  "narrative": "2-4 engaging paragraphs of story text (written in ${language === 'ja' ? 'Japanese' : 'English'})",
  "image_prompt": "Detailed Stable Diffusion prompt for scene illustration (ALWAYS in English, even for Japanese stories)",
  "choices": [
    {"text": "Choice 1 in ${language === 'ja' ? 'Japanese' : 'English'}", "type": "action", "emoji": "🏃"},
    {"text": "Choice 2", "type": "dialogue", "emoji": "💬"},
    {"text": "Choice 3", "type": "investigate", "emoji": "🔍"}
  ],
  "state_changes": {
    "hp_delta": 0,
    "items_gained": [],
    "items_lost": [],
    "relationships_changed": {},
    "custom_flags": {}
  },
  "important_events": [
    "Brief summary of any major plot points, character introductions, or discoveries"
  ]
}

# Guidelines
1. Keep narrative concise and exciting (2-4 paragraphs)
2. Provide 2-5 meaningful choices that feel different from each other
3. Each choice should include an appropriate emoji (🏰🗡️⚔️🛡️💬🔍🏃🌲🏕️🗺️✨🎭💎🔑📜🎒)
4. Track consequences - choices matter!
5. Balance challenge with fun (difficulty: ${difficulty})
6. Maintain story consistency using provided memories
7. Image prompts: vivid, detailed, whimsical style (50-100 words, ALWAYS in English)
8. Endings should feel earned, not abrupt - build to satisfying conclusions
9. Make the player feel like their choices shape the adventure!

# Image Prompt Guidelines
- Focus ONLY on ENVIRONMENT, SETTING, and ATMOSPHERE
- NEVER include people, characters, or humanoid figures in the image
- The protagonist is implied through POV - they are never shown
- Good: "A mysterious laboratory filled with glowing equipment, flickering monitors, quantum computers humming"
- Bad: "A Japanese male engineer standing in a laboratory" (NO PEOPLE!)
- Even if meeting NPCs, show the environment/location, not the people

# Long-Form Storytelling
- Stories can span 50, 100, even 200+ scenes - there's NO RUSH
- The RAG system (important_events) lets you reference events from far back in the story
- Don't compress plot - let characters develop, mysteries breathe, red herrings play out
- Think of each scene as ~1 page in a novel - pace accordingly
- Even kids' stories can be long adventures with many characters and subplots

# Image Style
For image prompts, use this style direction:
"${this.getImageStyleForGenre(genre)}, storybook illustration, whimsical and colorful, digital art, detailed, vibrant colors, friendly atmosphere, high quality"

IMPORTANT: Narrative and choices must be in ${language === 'ja' ? 'Japanese (日本語)' : 'English'}, but image_prompt must ALWAYS be in English.`;
    }

    buildJapaneseSystemPrompt(genre, difficulty, maturity_level) {
        const maturityGuidelines = maturity_level === 'adult'
            ? `# 成熟度レベル: 大人向け
- 本当の結果：悪い選択は重傷または死につながる可能性がある
- HPが0になるか、致命的な選択をした場合、ゲームオーバーで物語を終わらせる
- ダークなテーマ、道徳的ジレンマ、本物の危険が適切
- 暴力と危険は現実的で重大な結果をもたらす
- プレイヤーが死んだら: {"narrative": "...(死の描写)", "game_over": true, "ending": "death", "choices": []}`
            : `# 成熟度レベル: 子供向け（6-8歳）
- 絵本のような、小学2年生向けの簡単な日本語
- 難しい言葉は使わず、短い文章で書く
- プレイヤーキャラクターを絶対に殺さない
- 怖くない、優しく楽しい冒険
- 暴力的な表現は一切禁止
- テーマ: 友情、やさしさ、発見`;

        return `# 役割
あなたは${this.getGenreDescriptionJa(genre)}ジャンルのインタラクティブな「選択式アドベンチャー」物語を作成する、楽しくて創造的なストーリーテラーです。

# 対象読者とトーン
${maturity_level === 'kids' ? '6歳から8歳の低学年向けです。絵本のように、とても簡単な言葉で書いてください。優しく、安全で、楽しく！' : '大人の読者（18歳以上）向けです。本物の緊張感、本当のリスク、複雑なテーマ、意味のある結果を作り出してください。'}

${maturity_level === 'kids' ? `# 子供向けトーン
- 小学2年生でも読める簡単な言葉（絵本の文体）
- 短い文章、わかりやすい表現
- 怖くない、楽しくて優しい雰囲気
- 暴力や難しいテーマは禁止
- 前向きで、ハッピーな展開` : `# 大人向けトーン
- 真剣で、感情的な重みがある魅力的な内容
- 本物の危険と結果がある緊張感
- 大人に適した成熟したテーマ（死、道徳的ジレンマ、本当のリスク）
- プレイヤーの行動には永続的な結果がある - 死を含む`}

${maturityGuidelines}

# ストーリー難易度: ${difficulty}
${this.getDifficultyGuidelinesJa(difficulty, maturity_level)}

# あなたのタスク
次のシーンを**有効なJSON形式のみ**で生成してください。JSON以外のテキストは含めないでください。

**絶対に守ること：ふりがなは必ず 漢字《かんじ》 形式のみを使用。<ruby>や<rt>タグは絶対に使用禁止。**

{
  "narrative": "2-4段落の魅力的なストーリーテキスト。すべての漢字にふりがなマーク（例：図書館《としょかん》）を付ける。",
  "image_prompt": "Current scene visual description in English, including story context and character details",
  "choices": [
    {"text": "図書館《としょかん》に行《い》く", "type": "action", "emoji": "🏃"},
    {"text": "友達《ともだち》に話《はな》しかける", "type": "dialogue", "emoji": "💬"},
    {"text": "手《て》がかりを探《さが》す", "type": "investigate", "emoji": "🔍"}
  ],
  "state_changes": {
    "hp_delta": 0,
    "items_gained": [],
    "items_lost": [],
    "relationships_changed": {},
    "custom_flags": {}
  },
  "important_events": [
    "主要なプロットポイントの要約"
  ]
}

重要：
1. 有効なJSONのみを返す - コメントや説明なし
2. すべての漢字に 漢字《かんじ》 形式でふりがなを付ける。HTMLのrubyタグは使用しないこと。
3. image_promptは現在のシーンの環境と雰囲気を詳しく英語で説明する（人物は含めない）

# ガイドライン
1. 物語は簡潔でワクワクする内容に（2-4段落）
2. 2-5個の意味のある選択肢を提供し、それぞれ異なる感じを持たせる
3. 各選択肢には適切な絵文字を含める（🏰🗡️⚔️🛡️💬🔍🏃🌲🏕️🗺️✨🎭💎🔑📜🎒）
4. 結果を追跡 - 選択は重要！
5. チャレンジと楽しさのバランス（難易度: ${difficulty}）
6. 提供された記憶を使用してストーリーの一貫性を保つ
7. 画像プロンプト：鮮やかで詳細、魔法的なスタイル（50-100単語、必ず英語で）
8. 結末は自然に感じさせる - 満足感のある結論に向かって構築する
9. プレイヤーの選択が冒険を形作ると感じさせる！

# 画像プロンプトガイドライン
- 環境、設定、雰囲気のみに焦点を当てる
- 絶対に人物、キャラクター、人型の姿を含めない
- 主人公は視点を通じて暗示される - 決して表示されない
- 良い例：「輝く装置、点滅するモニター、唸る量子コンピュータで満たされた神秘的な研究室」
- 悪い例：「研究室に立つ日本人男性エンジニア」（人物禁止！）
- NPCと会う場合でも、環境や場所を示し、人物は示さない
- 人物が画像に含まれていると、物語の没入感が損なわれます

# 長編ストーリーテリング
- ストーリーは50、100、さらに200以上のシーンに及ぶことができます - 急ぐ必要はありません
- RAGシステム（important_events）により、ストーリーのはるか前の出来事を参照できます
- プロットを圧縮しないでください - キャラクター開発、謎の深まり、レッドヘリングを展開させてください
- 各シーンを小説の約1ページと考え、それに応じてペース配分してください
- 子供向けのストーリーでも、多くのキャラクターやサブプロットを持つ長い冒険になることができます

# 画像スタイル
画像プロンプトには、このスタイル指示を使用してください：
"${this.getImageStyleForGenre(genre)}, storybook illustration, whimsical and colorful, digital art, detailed, vibrant colors, friendly atmosphere, high quality"

重要：物語と選択肢は日本語で、image_promptは必ず英語で書いてください。`;
    }

    getGenreDescription(genre) {
        const descriptions = {
            fantasy: 'high fantasy with magic, dragons, and epic quests',
            scifi: 'science fiction with space adventures and futuristic technology',
            mystery: 'mystery and detective work with puzzles to solve',
            adventure: 'exciting adventures with exploration and discovery',
            horror: 'spooky (but not too scary!) mystery and supernatural events'
        };
        return descriptions[genre] || 'adventure';
    }

    getGenreDescriptionJa(genre) {
        const descriptions = {
            fantasy: '魔法、ドラゴン、壮大なクエストを含むハイファンタジー',
            scifi: '宇宙の冒険と未来技術を含むSF',
            mystery: 'パズルを解く謎と探偵作業',
            adventure: '探検と発見を伴うエキサイティングな冒険',
            horror: '怖すぎない！不気味なミステリーと超自然的な出来事'
        };
        return descriptions[genre] || '冒険';
    }

    getDifficultyGuidelines(difficulty, maturity_level) {
        if (maturity_level === 'adult') {
            const guidelines = {
                casual: '- Forgiving but real - mistakes cost resources or time, not life\n- Focus on story choices and character development\n- HP can decrease but death is unlikely',
                balanced: '- Meaningful consequences - poor choices can injure or kill\n- Player needs strategic thinking\n- HP management matters - death is possible but avoidable',
                hardcore: '- Brutal difficulty - many choices can lead to death\n- ONE major mistake can end the story\n- Combat is lethal, traps are deadly, trust is dangerous'
            };
            return guidelines[difficulty] || guidelines.balanced;
        }

        const guidelines = {
            casual: '- Very forgiving, choices rarely have negative consequences\n- Focus on story and fun\n- HP rarely decreases',
            balanced: '- Moderate challenge, some choices have setbacks\n- Player learns from mistakes safely\n- HP can decrease but player always recovers',
            hardcore: '- Challenging but safe, choices have consequences\n- Resource management important\n- HP can get low but player never dies'
        };
        return guidelines[difficulty] || guidelines.balanced;
    }

    getDifficultyGuidelinesJa(difficulty, maturity_level) {
        if (maturity_level === 'adult') {
            const guidelines = {
                casual: '- 寛容だが現実的 - ミスはリソースや時間を失うが、命は失わない\n- ストーリーの選択とキャラクター開発に焦点\n- HPは減少するが死ぬことは少ない',
                balanced: '- 意味のある結果 - 悪い選択は怪我や死につながる可能性\n- プレイヤーは戦略的思考が必要\n- HP管理が重要 - 死は可能だが回避可能',
                hardcore: '- 残酷な難易度 - 多くの選択が死につながる可能性\n- 一つの大きなミスが物語を終わらせる\n- 戦闘は致命的、罠は危険、信頼は危ない'
            };
            return guidelines[difficulty] || guidelines.balanced;
        }

        const guidelines = {
            casual: '- とても寛容で、選択が否定的な結果をもたらすことはほとんどない\n- ストーリーと楽しさに焦点\n- HPはほとんど減少しない',
            balanced: '- 適度な挑戦、いくつかの選択には失敗がある\n- プレイヤーは安全に失敗から学ぶ\n- HPは減少するが常に回復する',
            hardcore: '- 挑戦的だが安全、選択には結果がある\n- リソース管理が重要\n- HPは低くなることもあるがプレイヤーは死なない'
        };
        return guidelines[difficulty] || guidelines.balanced;
    }

    getImageStyleForGenre(genre) {
        const styles = {
            fantasy: 'magical fantasy landscape with castles and mystical creatures',
            scifi: 'futuristic sci-fi environment with spaceships and advanced technology',
            mystery: 'mysterious atmospheric scene with shadows and clues',
            adventure: 'exciting adventure scene with exploration and discovery',
            horror: 'spooky but kid-friendly scene with mild supernatural elements'
        };
        return styles[genre] || styles.adventure;
    }

    buildOpeningPrompt(name, gender, archetype, seed, language, maturityLevel) {
        const isJapanese = language === 'ja';

        // Generate random variety hints to avoid repetitive tropes
        // Different hints for kids vs adults
        const mysteryVariantsKids = [
            'a missing pet',
            'strange happenings at school',
            'a mysterious treasure map',
            'a haunted house rumor',
            'disappearing items',
            'a secret club mystery',
            'ancient ruins discovery',
            'cryptic messages in the library',
            'a lost artifact',
            'peculiar events at summer camp',
            'a friendship puzzle',
            'neighborhood mysteries'
        ];

        const mysteryVariantsAdults = [
            'a missing person case',
            'a murder investigation',
            'corporate espionage',
            'a conspiracy uncovered',
            'blackmail and secrets',
            'a locked room puzzle',
            'archaeological mystery',
            'cryptic messages',
            'witness protection gone wrong',
            'art forgery ring',
            'cold case reopened',
            'strange occurrences in a small town'
        ];

        const settingVariantsKids = [
            'school campus',
            'neighborhood',
            'summer camp',
            'small town',
            'beach town',
            'mountain village',
            'amusement park',
            'museum',
            'old mansion',
            'forest cabin',
            'local library',
            'community center'
        ];

        const settingVariantsAdults = [
            'bustling city',
            'quiet suburb',
            'remote mountain village',
            'coastal town',
            'university campus',
            'corporate office',
            'research facility',
            'historic district',
            'train station',
            'hotel',
            'theater',
            'art gallery'
        ];

        const mysteryVariants = maturityLevel === 'kids' ? mysteryVariantsKids : mysteryVariantsAdults;
        const settingVariants = maturityLevel === 'kids' ? settingVariantsKids : settingVariantsAdults;

        const randomMysteryHint = mysteryVariants[Math.floor(Math.random() * mysteryVariants.length)];
        const randomSettingHint = settingVariants[Math.floor(Math.random() * settingVariants.length)];

        if (isJapanese) {
            return `新しいストーリーを始めてください！

主人公:
- 名前: ${name || '（AIが選ぶ）'}
- 性別: ${gender || '中性'}
- アーキタイプ: ${archetype || '冒険者'}

${seed ? `ストーリーアイデア: ${seed}` : `バラエティのヒント（使用しても無視してもよい）: ${randomMysteryHint}、舞台は${randomSettingHint}`}

${maturityLevel === 'kids' && gender === 'male' ? `
ビジュアル美学の好み: 男の子の主人公には、アクション重視で冒険的なイメージを優先してください - ロボット、宇宙船、乗り物、かっこいいテクノロジー、探検、ダイナミックな環境を考えてください。ストーリーアイデアが特に要求しない限り、過度に可愛らしい美学は避けてください。` : ''}

最初のシーンを生成してください。主人公を紹介し、冒険の舞台を設定し、最初の重要な選択を提示してください。${maturityLevel === 'kids' && gender === 'male' ? 'ワクワクして、アクション満載で' : 'ワクワクして、魔法的で'}、魅力的なオープニングにしましょう！

重要: 一般的な比喩を避けてください。宝石の盗難や月のモチーフなどの使い古された要素ではなく、新鮮で予想外のひねりを加えてください。`;
        }

        return `Start a new story!

Protagonist:
- Name: ${name || '(your choice)'}
- Gender: ${gender || 'non-binary'}
- Archetype: ${archetype || 'adventurer'}

${seed ? `Story idea: ${seed}` : `Variety hint (use or ignore): ${randomMysteryHint} in a ${randomSettingHint}`}

${maturityLevel === 'kids' && gender === 'male' ? `
Visual aesthetic preference: For a young boy protagonist, lean toward action-focused and adventurous imagery - think robots, spaceships, vehicles, cool technology, exploration, and dynamic environments. Avoid overly whimsical or cutesy aesthetics unless the story idea specifically calls for it.` : ''}

Generate the opening scene. Introduce the protagonist, set the stage for adventure, and present the first meaningful choice. Make it exciting${maturityLevel === 'kids' && gender === 'male' ? ' and action-packed' : ', whimsical, and engaging'}!

IMPORTANT: Avoid common tropes. Instead of overused elements like stolen jewels or moon motifs, bring fresh and unexpected twists.`;
    }

    extractLocation(narrativeText) {
        // Simple heuristic: extract first location-sounding phrase
        const locationPatterns = [
            /(?:in|at|inside|within|outside)\s+(?:the\s+)?([^,.;]+(?:room|alley|street|building|inn|house|chamber|hall|forest|cave|field|dungeon|tower|castle|shop|tavern|market|plaza|courtyard|garden))/i,
            /(?:standing|sitting|lying|walking|running)\s+(?:in|on|at|near)\s+(?:the\s+)?([^,.;]+)/i
        ];

        for (const pattern of locationPatterns) {
            const match = narrativeText.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return 'current location (infer from recent scenes)';
    }

    buildNextScenePrompt(story, recentScenes, importantEvents, inventory, relationships, playerChoice) {
        const isJapanese = story.language === 'ja';
        const currentScene = story.current_scene_number + 1;

        const context = {
            protagonist: {
                name: story.protagonist_name,
                gender: story.protagonist_gender,
                archetype: story.protagonist_archetype
            },
            current_hp: story.hp,
            max_hp: story.max_hp,
            inventory: inventory.map(i => i.item_name),
            relationships: relationships.map(r => `${r.character_name} (${r.relationship_level > 0 ? 'friendly' : 'unfriendly'})`),
            current_location: recentScenes.length > 0 ? this.extractLocation(recentScenes[0].narrative_text) : 'unknown',
            recent_scenes: recentScenes.map(s => ({
                scene_number: s.scene_number,
                narrative: s.narrative_text.substring(0, 400) + '...'
            })),
            important_events: importantEvents.map(e => e.summary)
        };

        if (isJapanese) {
            return `# 現在のシーン番号: ${currentScene}

# ストーリーコンテキスト
${JSON.stringify(context, null, 2)}

# プレイヤーの最後の選択
"${playerChoice}"

この選択に基づいて次のシーンを生成してください。

重要なガイドライン:
- ヒートマップを使用して、プレイヤーが真実に近づいているか遠ざかっているかを評価してください
- 選択肢に${story.maturity_level === 'kids' ? '優しい袋小路を含めてください（NPCがリダイレクト）' : '本当の袋小路や間違いを含めてください'}
- ${story.maturity_level === 'kids' ? '各袋小路は1シーンを消費しますが、NPCは思いやりをもってプレイヤーを正しい方向に導きます' : '袋小路はプレイヤーを後退させ、複数のシーンを消費する可能性があります'}
- 核心的な秘密を早く明かしすぎないでください - ストーリーに呼吸する余地を与えてください

**重要：繰り返しを避ける**
- recent_scenesを注意深く確認 - 物語のビートがすでに探索されている場合、繰り返さないでください
- 新しい角度、新しい発見を見つけるか、プロットを前進させてください
- 各シーンは理解を深めるか、異なる側面を探索する必要があります

**プレイヤー主導のペース配分（重要）**

プレイヤーがストーリーの長さをコントロールします。あなたの仕事は、終わりに向かう選択肢を常に提供しつつ、プレイヤーが望む限り探索を続けられるようにすることです。

${currentScene < 20 ? `
シーン${currentScene} - 序盤（シーン1-19）:
- 世界観構築、キャラクター開発、謎の設定に集中
- まだ「結末への道」の選択肢は提供しないでください - 早すぎます
- ストーリーを自然に展開させてください
- すべての3-4つの選択肢は冒険の異なる側面を探索するものにしてください
` : currentScene < 40 ? `
シーン${currentScene} - 中盤（シーン20-39）:
- ストーリーが確立され、プレイヤーは解決に向かい始めたいかもしれません
- 必須: 正確に1つの選択肢は「結末への道」で、ストーリーアークの意図された結末に向かうものにしてください
- 🏁絵文字でマークし、メインプロットを進めることが明確にわかるようにしてください
- 他の2-3つの選択肢はサイドアドベンチャー、探索、またはキャラクターの瞬間を提供してください
- プレイヤーは結末への道を無視して、好きなだけ探索できます
` : `
シーン${currentScene} - 終盤（シーン40以上）:
- プレイヤーは広範囲に探索しています - ペースを尊重しつつ、解決をアクセス可能にしてください
- 必須: 正確に1つの選択肢は「結末への道」（🏁でマーク）にしてください
- この選択肢は「真実の瞬間」のように感じさせてください - 核心的な対立に直面する
- 他の選択肢はまだ探索を提供できますが、結末への道はますます重要に感じさせてください
`}

**結末への道の選択肢フォーマット**（シーン20以上）:
必須の結末への道の選択肢を含める場合、次のようにフォーマットしてください:
{"text": "[解決に向けてメインプロットを進めるアクション]", "type": "action", "emoji": "🏁", "ending_path": true}

**フィナーレのトリガー**

プレイヤーが結末への道の選択肢を選び、ストーリーアークの解決条件が満たされたとき:
1. 劇的な最終選択を1つ生成: {"is_final_choice": true, "text": "...", "type": "action", "emoji": "⚡"}
2. 最終選択後、長い満足感のある結論を生成（6-10段落）
3. 終了: {"story_complete": true, "ending_type": "triumph|tragedy|bittersweet|mystery"}

忘れないで: プレイヤーは終わることを強制されません。100シーン以上探索したい場合はそれでOKです。あなたの仕事は結末への道を利用可能にすることで、強制することではありません。`;
        }

        return `# Current scene number: ${currentScene}

# Story Context
${JSON.stringify(context, null, 2)}

# Player's Last Choice
"${playerChoice}"

Generate the next scene based on this choice.

Important guidelines:
- Use the heat map to assess if player is getting warmer or colder to the truth
- Include ${story.maturity_level === 'kids' ? 'gentle dead-ends in choices (NPCs redirect)' : 'real dead-ends and mistakes in choices'}
- ${story.maturity_level === 'kids' ? 'Each dead-end burns one scene, but NPCs kindly guide player back on track' : 'Dead-ends can set player back and burn multiple scenes'}
- Don't reveal core secrets too early - let the story breathe

**CRITICAL: Avoid repetition**
- Review recent_scenes carefully - if a narrative beat has already been explored (e.g., examining reflection, noticing physical disconnects, specific reveals), DO NOT repeat it
- Find NEW angles, NEW discoveries, or move the plot forward
- Each scene should advance understanding or explore different aspects
- Repeating the same revelatory moment kills engagement in long stories

**PLAYER-CONTROLLED PACING (READ CAREFULLY)**

The player controls how long the story runs. Your job is to ALWAYS give them the option to move toward ending, while also letting them explore indefinitely if they prefer.

${currentScene < 20 ? `
SCENE ${currentScene} - EARLY STORY (scenes 1-19):
- Focus on world-building, character development, and mystery setup
- Do NOT offer ending-path choices yet - it's too early
- Let the story breathe and develop naturally
- All 3-4 choices should explore different aspects of the adventure
` : currentScene < 40 ? `
SCENE ${currentScene} - MID STORY (scenes 20-39):
- Story is established, player may want to start moving toward resolution
- REQUIRED: Exactly ONE choice must be an "ending path" choice that moves toward the story arc's intended ending
- Mark it with 🏁 emoji and make it clearly about progressing the main plot
- The other 2-3 choices should offer side adventures, exploration, or character moments
- Player can ignore the ending path and explore for as long as they want
` : `
SCENE ${currentScene} - LATE STORY (scenes 40+):
- Player has been exploring extensively - respect their pace but make resolution accessible
- REQUIRED: Exactly ONE choice must be an "ending path" choice (marked with 🏁)
- This choice should feel like "the moment of truth" - confronting the core conflict
- Other choices can still offer exploration, but the ending path should feel increasingly significant
- If player keeps avoiding ending paths, that's fine - they're enjoying the journey
`}

**ENDING PATH CHOICE FORMAT** (for scenes 20+):
When including the required ending-path choice, format it as:
{"text": "[Action that advances main plot toward resolution]", "type": "action", "emoji": "🏁", "ending_path": true}

**TRIGGERING THE FINALE**

When the player selects an ending-path choice AND the story arc's resolution conditions are met:
1. Generate ONE dramatic final choice: {"is_final_choice": true, "text": "...", "type": "action", "emoji": "⚡"}
2. After they select the final choice, generate a LONG satisfying conclusion (6-10 paragraphs)
3. End with: {"story_complete": true, "ending_type": "triumph|tragedy|bittersweet|mystery"}

Remember: The player is NEVER forced to end. They can explore for 100+ scenes if they want. Your job is to make the ending path AVAILABLE, not mandatory.`;
    }

    async callClaudeStreaming(systemPrompt, userPrompt, cacheableContext = null, language = 'en', onChunk = null) {
        // Same as callClaude but calls onChunk with text deltas
        console.log(`🔵 Claude API call starting...`);
        const startTime = Date.now();

        try {
            const maxTokens = language === 'ja' ? 4096 : 1500;

            let systemContent;
            if (cacheableContext) {
                systemContent = [
                    {
                        type: 'text',
                        text: systemPrompt
                    },
                    {
                        type: 'text',
                        text: cacheableContext,
                        cache_control: { type: 'ephemeral' }
                    }
                ];
            } else {
                systemContent = systemPrompt;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 180000);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: maxTokens,
                    temperature: 0.8,
                    system: systemContent,
                    messages: [
                        { role: 'user', content: userPrompt }
                    ],
                    stream: true
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            let fullText = '';
            let usage = null;

            const reader = response.body;
            const decoder = new TextDecoder();

            for await (const chunk of reader) {
                const text = decoder.decode(chunk);
                const lines = text.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                fullText += parsed.delta.text;
                                if (onChunk) {
                                    console.log(`🔤 Sending chunk to callback: ${parsed.delta.text.length} chars`);
                                    onChunk(parsed.delta.text);
                                } else {
                                    console.log(`⚠️ No onChunk callback provided`);
                                }
                            }

                            if (parsed.type === 'message_delta' && parsed.usage) {
                                usage = parsed.usage;
                            }
                        } catch (e) {
                            // Skip unparseable lines
                        }
                    }
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (usage) {
                console.log(`✅ Claude API streamed in ${duration}s`);
                console.log(`📊 Output tokens: ${usage.output_tokens || 'unknown'}`);
            } else {
                console.log(`✅ Claude API streamed in ${duration}s`);
            }

            return fullText;
        } catch (error) {
            clearTimeout(timeout);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`❌ Claude API failed after ${duration}s:`, error.message);
            if (error.name === 'AbortError') {
                throw new Error('Claude API request timed out after 3 minutes');
            }
            throw error;
        }
    }

    async callClaude(systemPrompt, userPrompt, cacheableContext = null, language = 'en') {
        console.log(`🔵 Claude API call starting...`);
        const startTime = Date.now();

        try {
            const maxTokens = language === 'ja' ? 4096 : 1500;

            // Build system array with optional caching
            let systemContent;
            if (cacheableContext) {
                systemContent = [
                    {
                        type: 'text',
                        text: systemPrompt
                    },
                    {
                        type: 'text',
                        text: cacheableContext,
                        cache_control: { type: 'ephemeral' }
                    }
                ];
            } else {
                systemContent = systemPrompt;
            }

            const message = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: maxTokens,
                temperature: 0.8,
                system: systemContent,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Claude API completed in ${duration}s`);
            console.log(`📊 Output tokens: ${message.usage.output_tokens}`);

            return message.content[0].text;
        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`❌ Claude API failed after ${duration}s:`, error.message);
            if (error.name === 'AbortError') {
                throw new Error('Claude API request timed out after 3 minutes');
            }
            throw error;
        }
    }

    parseStoryResponse(response) {
        try {
            // Remove markdown code fences if present
            let cleaned = response.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            // Try to extract JSON from response
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonStr = jsonMatch[0];

                // Try to fix common JSON errors before parsing
                // Remove trailing commas before } or ]
                jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

                // Fix incomplete string values (missing closing quote)
                // This happens when Claude hits token limit mid-string
                jsonStr = jsonStr.replace(/:\s*"([^"]*?)$/m, ':"$1"');

                // If JSON ends abruptly, try to close it properly
                if (!jsonStr.trim().endsWith('}')) {
                    // Count unclosed braces/brackets
                    const openBraces = (jsonStr.match(/\{/g) || []).length;
                    const closeBraces = (jsonStr.match(/\}/g) || []).length;
                    const openBrackets = (jsonStr.match(/\[/g) || []).length;
                    const closeBrackets = (jsonStr.match(/\]/g) || []).length;

                    // Add missing closing brackets/braces
                    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
                        jsonStr += ']';
                    }
                    for (let i = 0; i < (openBraces - closeBraces); i++) {
                        jsonStr += '}';
                    }
                }

                const parsed = JSON.parse(jsonStr);

                // Log the parsed choices to debug furigana issues
                if (parsed.choices) {
                    console.log('🔍 PARSED CHOICES FROM CLAUDE:');
                    parsed.choices.forEach((choice, i) => {
                        const endingFlag = choice.ending_path ? ' [ENDING PATH]' : '';
                        console.log(`  Choice ${i+1}: ${choice.text}${endingFlag}`);
                    });
                }

                // Validate required fields
                if (!parsed.narrative || !parsed.choices) {
                    throw new Error('Missing required fields in response');
                }

                return parsed;
            }
            throw new Error('No JSON found in response');
        } catch (error) {
            console.error('Failed to parse Claude response:', error);
            console.error('Raw response length:', response.length);
            // Log the problematic JSON section
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                const errorPos = error.message.match(/position (\d+)/);
                if (errorPos) {
                    const pos = parseInt(errorPos[1]);
                    const snippet = jsonStr.substring(Math.max(0, pos - 100), Math.min(jsonStr.length, pos + 100));
                    console.error('Error near position', pos, ':', snippet);
                }
            }

            // Fallback response
            return {
                narrative: response,
                image_prompt: 'A whimsical storybook scene with magical atmosphere',
                choices: [
                    { text: 'Continue the adventure', type: 'action', emoji: '✨' },
                    { text: 'Look around', type: 'investigate', emoji: '🔍' }
                ],
                state_changes: {},
                important_events: []
            };
        }
    }
}

module.exports = StoryEngine;
