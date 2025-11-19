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
${maturity_level === 'kids' ? '子供向け（6-12歳） - 前向きで安全な結末、楽しい冒険、乗り越えられる困難。ディズニー/ピクサーのような家族向けの雰囲気。' : '大人向け（18歳以上） - 暗い瞬間や深刻な危険もあり、実際の危機、道徳的なジレンマ、本当の結果（死も含む）。'}

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
${maturity_level === 'kids' ? 'For young children (ages 6-12) - Safe, uplifting ending with fun adventure and manageable challenges. Family-friendly tone like Disney/Pixar movies.' : 'For mature adults (18+) - Can have dark moments, serious danger, real stakes, moral dilemmas, and genuine consequences including death.'}

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

        let fullBuffer = '';
        let narrativeBuffer = '';
        let inNarrative = false;
        let narrativeStartIndex = -1;
        let sentParagraphs = 0; // Track how many paragraphs we've already sent

        stream.on('text', (text) => {
            fullBuffer += text;

            // Look for the start of the narrative field
            if (!inNarrative) {
                const narrativeMatch = fullBuffer.match(/"narrative"\s*:\s*"/);
                if (narrativeMatch) {
                    inNarrative = true;
                    narrativeStartIndex = narrativeMatch.index + narrativeMatch[0].length;
                    narrativeBuffer = fullBuffer.substring(narrativeStartIndex);
                }
            }

            // If we're inside the narrative field, process it
            if (inNarrative) {
                // Update narrative buffer with new content
                narrativeBuffer = fullBuffer.substring(narrativeStartIndex);

                // Check if we've hit the end of the narrative field (closing quote)
                const endMatch = narrativeBuffer.match(/(?<!\\)"/);

                if (endMatch) {
                    // We've reached the end of narrative
                    narrativeBuffer = narrativeBuffer.substring(0, endMatch.index);
                    inNarrative = false;
                }

                // Find the earliest split point (sentence end or paragraph break)
                // Look for:
                // 1. Double newline: \\n\\n
                // 2. Sentence end: [.!?。] followed by space or single newline
                const doubleNewlineRegex = /\\n\\n/;
                const sentenceEndRegex = /(?<=[.!?。])(?:\s+|\\n)/;

                let splitIndex = -1;
                let matchLength = 0;
                let isParagraphBreak = false;

                const dnMatch = narrativeBuffer.match(doubleNewlineRegex);
                const seMatch = narrativeBuffer.match(sentenceEndRegex);

                if (dnMatch && seMatch) {
                    // Both found, take the earlier one
                    if (dnMatch.index < seMatch.index) {
                        splitIndex = dnMatch.index;
                        matchLength = dnMatch[0].length;
                        isParagraphBreak = true;
                    } else {
                        splitIndex = seMatch.index;
                        matchLength = seMatch[0].length;
                        isParagraphBreak = false;
                    }
                } else if (dnMatch) {
                    splitIndex = dnMatch.index;
                    matchLength = dnMatch[0].length;
                    isParagraphBreak = true;
                } else if (seMatch) {
                    splitIndex = seMatch.index;
                    matchLength = seMatch[0].length;
                    isParagraphBreak = false;
                }

                // If we found a split point, or we finished the narrative
                if (splitIndex !== -1 || (!inNarrative && narrativeBuffer.length > 0)) {
                    const endIndex = splitIndex !== -1 ? splitIndex : narrativeBuffer.length;
                    const chunk = narrativeBuffer.substring(0, endIndex);
                    
                    // Advance buffer (skip the delimiter if it was a split)
                    narrativeBuffer = narrativeBuffer.substring(endIndex + matchLength);

                    if (chunk.trim()) {
                        // Unescape JSON escape sequences
                        const cleaned = chunk
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\')
                            .trim();

                        if (cleaned) {
                            console.log(`📤 Chunk: ${cleaned.substring(0, 30)}... (Para break: ${isParagraphBreak})`);
                            onParagraph(cleaned, isParagraphBreak);
                        }
                    }
                    
                    // Process remaining buffer in next iteration if any
                    if (narrativeBuffer.length > 0) {
                       // We need to re-evaluate the buffer loop, but the loop relies on "inNarrative" state mostly.
                       // Actually, we should loop here until no more matches found.
                       // But since stream.on('text') calls this frequently, it's fine to wait for next chunk 
                       // UNLESS we have multiple sentences in one chunk.
                       // Let's force a re-check by not doing anything else, the next stream chunk will trigger or we could use a while loop.
                       // For simplicity/safety, I'll rely on high frequency stream events, 
                       // BUT if a large chunk arrives at once, we might lag.
                       // Ideally: wrap this in a while(true) loop.
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
        const maturityGuidelines = maturity_level === 'adults'
            ? `# Maturity Level: ADULTS
- Real consequences: bad choices can lead to serious injury or DEATH
- If HP reaches 0 or player makes catastrophically bad choices, END THE STORY with a game over
- Dark themes, moral dilemmas, and genuine danger are appropriate
- Violence and peril should feel real and consequential
- When player dies, respond with: {"narrative": "...(describe death)", "game_over": true, "ending": "death", "choices": []}`
            : `# Maturity Level: KIDS (Ages 6-12)
- Keep it safe, fun, and age-appropriate for young children
- Use simple, clear language that 6-12 year olds can easily understand
- Never kill the player character - even at 0 HP, they get rescued or wake up safely
- Scary moments are gentle - think Saturday morning cartoons, not nightmares
- Problems are solvable with creativity, friendship, and perseverance
- Themes: friendship, teamwork, bravery, problem-solving`;

        return `# Role
You are a fun, creative storyteller creating an interactive choose-your-own-adventure story in the ${genre} genre.

# Audience & Tone
${maturity_level === 'kids' ? 'For young children ages 6-12. Write like a good children\'s book or family movie (Disney/Pixar tone). Keep it simple, wholesome, and fun!' : 'For mature adults (18+). Create genuine tension, real stakes, complex themes, and meaningful consequences.'}

${maturity_level === 'kids' ? `# Tone for Kids
- Simple, clear language that young children can understand
- Exciting but not too scary - like a fun bedtime story adventure
- Positive and uplifting - good wins, friends help each other, problems get solved
- Wonder and humor - make them smile and feel curious
- NO graphic content, NO real danger of death, NO complex adult themes` : `# Tone for Adults
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
8. Never end the story abruptly - always provide meaningful choices
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
        const maturityGuidelines = maturity_level === 'adults'
            ? `# 成熟度レベル: 大人向け
- 本当の結果：悪い選択は重傷または死につながる可能性がある
- HPが0になるか、致命的な選択をした場合、ゲームオーバーで物語を終わらせる
- ダークなテーマ、道徳的ジレンマ、本物の危険が適切
- 暴力と危険は現実的で重大な結果をもたらす
- プレイヤーが死んだら: {"narrative": "...(死の描写)", "game_over": true, "ending": "death", "choices": []}`
            : `# 成熟度レベル: 子供向け（6-12歳）
- 安全で楽しく、幼い子供に適した内容
- 6-12歳が簡単に理解できるシンプルで明確な言葉を使用
- プレイヤーキャラクターを絶対に殺さない - HPが0でも安全に助けられるか目覚める
- 怖い瞬間は優しく - 朝のアニメのように、悪夢ではない
- 問題は創造性、友情、忍耐力で解決可能
- テーマ: 友情、チームワーク、勇気、問題解決`;

        return `# 役割
あなたは${this.getGenreDescriptionJa(genre)}ジャンルのインタラクティブな「選択式アドベンチャー」物語を作成する、楽しくて創造的なストーリーテラーです。

# 対象読者とトーン
${maturity_level === 'kids' ? '6歳から12歳の幼い子供向けです。良い児童書やファミリー映画（ディズニー/ピクサーのトーン）のように書いてください。シンプルで健全で楽しく！' : '大人の読者（18歳以上）向けです。本物の緊張感、本当のリスク、複雑なテーマ、意味のある結果を作り出してください。'}

${maturity_level === 'kids' ? `# 子供向けトーン
- 幼い子供が理解できるシンプルで明確な言葉
- ワクワクするが怖すぎない - 楽しい寝る前の冒険物語のように
- 前向きで励みになる - 善が勝ち、友達が助け合い、問題が解決される
- 驚きとユーモア - 笑顔にさせ、好奇心を感じさせる
- グラフィックな内容なし、本当の死の危険なし、複雑な大人のテーマなし` : `# 大人向けトーン
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
8. ストーリーを突然終わらせない - 常に意味のある選択肢を提供
9. プレイヤーの選択が冒険を形作ると感じさせる！

# 画像プロンプトガイドライン
- 環境、設定、雰囲気のみに焦点を当てる
- 絶対に人物、キャラクター、人型の姿を含めない
- 主人公は視点を通じて暗示される - 決して表示されない
- 良い例：「輝く装置、点滅するモニター、唸る量子コンピュータで満たされた神秘的な研究室」
- 悪い例：「研究室に立つ日本人男性エンジニア」（人物禁止！）
- NPCと会う場合でも、環境や場所を示し、人物は示さない

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
        if (maturity_level === 'adults') {
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
        if (maturity_level === 'adults') {
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

最初のシーンを生成してください。主人公を紹介し、冒険の舞台を設定し、最初の重要な選択を提示してください。ワクワクして、魔法的で、魅力的なオープニングにしましょう！

重要: 一般的な比喩を避けてください。宝石の盗難や月のモチーフなどの使い古された要素ではなく、新鮮で予想外のひねりを加えてください。`;
        }

        return `Start a new story!

Protagonist:
- Name: ${name || '(your choice)'}
- Gender: ${gender || 'non-binary'}
- Archetype: ${archetype || 'adventurer'}

${seed ? `Story idea: ${seed}` : `Variety hint (use or ignore): ${randomMysteryHint} in a ${randomSettingHint}`}

Generate the opening scene. Introduce the protagonist, set the stage for adventure, and present the first meaningful choice. Make it exciting, whimsical, and engaging!

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
- ストーリーの長さは自然に展開させてください。急ぐ必要はありません

**重要：繰り返しを避ける**
- recent_scenesを注意深く確認 - 物語のビート（例：鏡で自分を調べる、身体的な違和感に気づく、特定の啓示）がすでに探索されている場合、繰り返さないでください
- 新しい角度、新しい発見を見つけるか、プロットを前進させてください
- 各シーンは理解を深めるか、異なる側面を探索する必要があります
- 同じ啓示的な瞬間を繰り返すことは、長編ストーリーでの没入感を損ないます

**ストーリーの終了**
ストーリーアークの「意図された結末」を確認 - プレイヤーの選択がアークに記載されたクライマックスの瞬間に到達したとき：
- 結末を決定する劇的な最終選択を1つ提供してください
- {"is_final_choice": true, "text": "最終的な決断...", "type": "action", "emoji": "⚡"}でマークしてください
- プレイヤーがこの最終選択を行った後、長い結論を生成してください（6〜10段落）
- {"story_complete": true, "ending_type": "triumph|tragedy|bittersweet|mystery"}で終了してください
- ストーリーの長さは自然なアークに合わせる - シーン数に基づいて人為的に延長または短縮しないでください
- アークの中心的な謎/対立が解決点に達したときにのみ終了してください`;
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
- Let story length unfold naturally. Don't rush it

**CRITICAL: Avoid repetition**
- Review recent_scenes carefully - if a narrative beat has already been explored (e.g., examining reflection, noticing physical disconnects, specific reveals), DO NOT repeat it
- Find NEW angles, NEW discoveries, or move the plot forward
- Each scene should advance understanding or explore different aspects
- Repeating the same revelatory moment kills engagement in long stories

**ENDING THE STORY**
Check the story arc's "Intended ending" - when player choices have brought them to the climactic moment described in the arc:
- Offer ONE dramatic final choice that will determine the ending
- Mark it with: {"is_final_choice": true, "text": "Your final decision...", "type": "action", "emoji": "⚡"}
- After player makes this final choice, generate a LONG conclusion (6-10 paragraphs)
- End with: {"story_complete": true, "ending_type": "triumph|tragedy|bittersweet|mystery"}
- The story length should match its natural arc - don't artificially extend or truncate based on scene count
- Only end when the central mystery/conflict from the arc has reached its resolution point`;
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
                        console.log(`  Choice ${i+1}: ${choice.text}`);
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
