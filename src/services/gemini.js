const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config');

class GeminiClient {
    constructor() {
        this.apiKeys = config.gemini.apiKeys || [];
        this.apiUrl = config.gemini.apiUrl || 'https://generativelanguage.googleapis.com';
        this.currentKeyIndex = 0;
        this.keyFailures = new Map();
        this.keyLastFailure = new Map();
        
        // 模型映射表
        this.modelMap = {
            'models/gemini-2.0-flash': 'gemini-2.0-flash',
            'models/gemini-2.5-flash': 'gemini-2.5-flash', 
            'models/gemini-2.0-flash-thinking-exp': 'gemini-2.0-flash-thinking-exp',
            'models/gemma-3-27b-it': 'gemma-3-27b-it',
            'gemini-2.0-flash': 'gemini-2.0-flash',
            'gemini-2.5-flash': 'gemini-2.5-flash',
            'gemini-thinking': 'gemini-2.0-flash-thinking-exp',
            'gemma-27b': 'gemma-3-27b-it',
            'gemini-flash': 'gemini-2.0-flash',
            'gemini-pro': 'gemini-2.5-flash',
        };
    }
    
    getNextKey() {
        if (!this.apiKeys.length) {
            throw new Error('没有配置 Gemini API 密钥');
        }
        
        const now = Date.now();
        const cooldownPeriod = 60000; // 1分钟
        
        // 寻找可用密钥
        for (let i = 0; i < this.apiKeys.length; i++) {
            const index = (this.currentKeyIndex + i) % this.apiKeys.length;
            const key = this.apiKeys[index];
            
            if (now - (this.keyLastFailure.get(key) || 0) > cooldownPeriod) {
                this.currentKeyIndex = (index + 1) % this.apiKeys.length;
                return { key, index };
            }
        }
        
        // 全部在冷却期，返回下一个
        const index = this.currentKeyIndex;
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return { key: this.apiKeys[index], index };
    }
    
    recordKeyFailure(key) {
        this.keyFailures.set(key, (this.keyFailures.get(key) || 0) + 1);
        this.keyLastFailure.set(key, Date.now());
    }
    
    resetKeyFailure(key) {
        this.keyFailures.delete(key);
        this.keyLastFailure.delete(key);
    }
    
    convertMessages(messages) {
        const geminiMessages = [];
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                geminiMessages.push(
                    { role: 'user', parts: [{ text: `System: ${msg.content}` }] },
                    { role: 'model', parts: [{ text: '我理解了系统指令。' }] }
                );
            } else if (msg.role === 'user') {
                geminiMessages.push({ role: 'user', parts: [{ text: msg.content }] });
            } else if (msg.role === 'assistant') {
                geminiMessages.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        }
        
        return geminiMessages;
    }
    
    async chat(messages, options = {}) {
        const maxRetries = options.maxRetries || 3;
        const modelName = this.modelMap[options.model] || options.model || 'gemini-2.0-flash';
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { key, index } = this.getNextKey();
            
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 120000);
                
                const requestBody = {
                    contents: this.convertMessages(messages),
                    generationConfig: {
                        temperature: options.temperature || 0.7,
                        topK: 40,
                        topP: options.topP || 0.95,
                        maxOutputTokens: options.maxTokens || 2048,
                    },
                    safetySettings: this.getSafetySettings(options.mode)
                };
                
                const fullModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
                const url = `${this.apiUrl}/v1beta/${fullModelName}:generateContent?key=${key}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                if (!response.ok) {
                    const error = new Error(`Gemini API错误: ${response.status} ${response.statusText}`);
                    error.status = response.status;
                    
                    // Pro模型限流时降级
                    if (response.status === 429 && modelName.includes('pro')) {
                        options.model = 'gemini-2.0-flash';
                        return this.chat(messages, options);
                    }
                    
                    throw error;
                }
                
                this.resetKeyFailure(key);
                return response;
                
            } catch (error) {
                lastError = error;
                this.recordKeyFailure(key);
                
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 << attempt, 5000)));
                }
            }
        }
        
        throw lastError || new Error('所有Gemini API密钥均失败了');
    }
    
    getSafetySettings(mode) {
        const threshold = mode === 'adult' ? 'BLOCK_NONE' : 'BLOCK_MEDIUM_AND_ABOVE';
        const categories = [
            'HARM_CATEGORY_HARASSMENT',
            'HARM_CATEGORY_HATE_SPEECH',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'HARM_CATEGORY_DANGEROUS_CONTENT'
        ];
        
        return categories.map(category => ({ category, threshold }));
    }
    
    async *processStream(response) {
        const text = await response.text();
        const json = JSON.parse(text);
        
        if (json.candidates?.[0]?.content) {
            yield json.candidates[0].content.parts.map(part => part.text || '').join('');
        }
    }
    
    async chatComplete(messages, options = {}) {
        try {
            const response = await this.chat(messages, { ...options, stream: false });
            const json = await response.json();
            
            if (!json.candidates?.length) {
                throw new Error('Gemini没有返回有效响应');
            }
            
            const candidate = json.candidates[0];
            if (!candidate.content?.parts?.length) {
                throw new Error('Gemini响应格式错误');
            }
            
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('响应被安全过滤器阻止，请修改您的输入');
            }
            
            const content = candidate.content.parts.map(part => part.text || '').join('');
            if (!content) {
                throw new Error('Gemini响应内容为空');
            }
            
            return content;
            
        } catch (error) {
            logger.error('Gemini chat completion error', { error: error.message });
            throw error;
        }
    }
    
    estimateTokens(text) {
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishChars = text.length - chineseChars;
        return Math.ceil(chineseChars * 0.5 + englishChars * 0.25);
    }
    
    async healthCheck() {
        try {
            if (!this.apiKeys.length) return false;
            
            const { key } = this.getNextKey();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(
                `${this.apiUrl}/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    }),
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeout);
            return response.ok;
            
        } catch (error) {
            logger.error('Gemini health check failed', { error: error.message });
            return false;
        }
    }
    
    getAvailableModels() {
        return {
            'gemini-2.0-flash': 'Gemini 2.0 Flash',
            'gemini-2.5-flash': 'Gemini 2.5 Flash (最新)',
            'gemini-thinking': 'Gemini Thinking (实验)',
            'gemma-27b': 'Gemma 27B (开源)',
        };
    }
}

module.exports = new GeminiClient();
