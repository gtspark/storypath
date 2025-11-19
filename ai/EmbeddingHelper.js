const { ChromaClient } = require('chromadb');
const OpenAI = require('openai');

class EmbeddingHelper {
    constructor(openaiApiKey) {
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        this.client = new ChromaClient({
            path: 'http://localhost:8000'
        });
        this.collectionName = 'story_concepts';
        this.collection = null;
    }

    async initialize() {
        try {
            this.collection = await this.client.getOrCreateCollection({
                name: this.collectionName,
                metadata: { description: 'Story concept embeddings for uniqueness checking' }
            });
            console.log('📊 Embedding collection initialized');
        } catch (error) {
            console.error('Failed to initialize embedding collection:', error);
            throw error;
        }
    }

    async getEmbedding(text) {
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });
        return response.data[0].embedding;
    }

    async addStory(storyId, genre, maturityLevel, title, storySeed, storyArc) {
        if (!this.collection) await this.initialize();

        // Create a concept summary
        const conceptText = `Genre: ${genre}, Maturity: ${maturityLevel}\nTitle: ${title}\nConcept: ${storySeed || ''}\nArc: ${storyArc.substring(0, 500)}`;

        const embedding = await this.getEmbedding(conceptText);

        await this.collection.add({
            ids: [storyId],
            embeddings: [embedding],
            metadatas: [{
                genre,
                maturity_level: maturityLevel,
                title,
                concept: storySeed || ''
            }],
            documents: [conceptText]
        });

        console.log(`📊 Added embedding for story: ${title}`);
    }

    async checkSimilarity(genre, maturityLevel, proposedConcept, similarityThreshold = 0.8) {
        if (!this.collection) await this.initialize();

        const embedding = await this.getEmbedding(proposedConcept);

        // Query for similar stories in same genre/maturity
        const results = await this.collection.query({
            queryEmbeddings: [embedding],
            nResults: 5,
            where: {
                $and: [
                    { genre: { $eq: genre } },
                    { maturity_level: { $eq: maturityLevel } }
                ]
            }
        });

        if (results.distances && results.distances[0]) {
            const distances = results.distances[0];
            const similarities = distances.map(d => 1 - d); // Convert distance to similarity
            const maxSimilarity = Math.max(...similarities);

            // Collect all similar stories (not just the most similar)
            const similarStories = similarities
                .map((sim, idx) => ({
                    title: results.metadatas[0][idx].title,
                    concept: results.metadatas[0][idx].concept,
                    document: results.documents[0][idx],
                    similarity: sim
                }))
                .filter(s => s.similarity > 0.7) // Include anything over 70% similar
                .sort((a, b) => b.similarity - a.similarity);

            if (maxSimilarity > similarityThreshold) {
                const mostSimilarIdx = similarities.indexOf(maxSimilarity);
                const similarTitle = results.metadatas[0][mostSimilarIdx].title;

                return {
                    isTooSimilar: true,
                    similarity: maxSimilarity,
                    similarTo: similarTitle,
                    similarStories: similarStories,
                    message: `Concept too similar (${(maxSimilarity * 100).toFixed(1)}%) to existing story: "${similarTitle}"`
                };
            }
        }

        return {
            isTooSimilar: false,
            similarity: 0,
            similarStories: [],
            message: 'Concept is unique enough'
        };
    }

    async removeStory(storyId) {
        if (!this.collection) await this.initialize();

        try {
            await this.collection.delete({ ids: [storyId] });
            console.log(`📊 Removed embedding for story: ${storyId}`);
        } catch (error) {
            // Story might not exist in collection, that's ok
            console.log(`📊 No embedding found for story: ${storyId}`);
        }
    }
}

module.exports = EmbeddingHelper;
