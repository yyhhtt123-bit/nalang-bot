// src/services/geminiClient.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiClient {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async chat(messages, options = {}) {
        const model = this.genAI.getGenerativeModel({ model: options.model || 'gemini-2.5-flash' });
        
        try {
            const result = await model.generateContent({
                contents: this.convertMessages(messages),
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.maxTokens || 2048,
                },
            });
            return result.response.text();
        } catch (error) {
            logger.error('Gemini API error', { error: error.message });
            throw error;
        }
    }

    convertMessages(messages) {
        return messages.map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
            parts: [{ text: msg.content }]
        }));
    }
}

module.exports = GeminiClient;
