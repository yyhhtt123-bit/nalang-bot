// src/services/modelManager.js
const logger = require('../utils/logger');
const modelsConfig = require('../config/models');

class ModelManager {
    constructor() {
        this.providers = new Map();
        this.initializeProviders();
    }
    
    initializeProviders() {
        // 初始化Nalang提供者
        if (process.env.NALANG_API_KEY) {
            this.providers.set('nalang', {
                client: require('./providers/nalangProvider'),
                models: ['nalang-xl', 'nalang-turbo']
            });
        }
        
        // 初始化Gemini提供者
        if (process.env.GEMINI_API_KEY) {
            this.providers.set('gemini', {
                client: require('./providers/geminiProvider'),
                models: ['gemini-2.0-flash', 'gemini-2.0-pro']
            });
        }
        
        // 初始化OpenAI提供者
        if (process.env.OPENAI_API_KEY) {
            this.providers.set('openai', {
                client: require('./providers/openaiProvider'),
                models: ['gpt-4']
            });
        }
    }
    
    // 获取所有可用模型
    getAvailableModels(mode = null) {
        const availableModels = [];
        
        for (const [modelId, modelConfig] of Object.entries(modelsConfig.models)) {
            // 检查模型是否支持指定模式
            if (mode && !modelConfig.supportedModes.includes(mode)) {
                continue;
            }
            
            // 检查是否有对应的provider
            const provider = this.providers.get(modelConfig.provider);
            if (!provider) {
                continue;
            }
            
            // 检查API密钥
            if (modelConfig.requiresKey && !process.env[modelConfig.requiresKey]) {
                continue;
            }
            
            availableModels.push({
                ...modelConfig,
                available: true
            });
        }
        
        return availableModels;
    }
    
    // 调用指定模型
    async chat(modelId, messages, options = {}) {
        const modelConfig = modelsConfig.models[modelId];
        if (!modelConfig) {
            throw new Error(`Model ${modelId} not found`);
        }
        
        const provider = this.providers.get(modelConfig.provider);
        if (!provider) {
            throw new Error(`Provider ${modelConfig.provider} not available`);
        }
        
        try {
            logger.info('Calling model', { 
                modelId, 
                provider: modelConfig.provider,
                apiModel: modelConfig.apiModel 
            });
            
            return await provider.client.chat(messages, {
                ...options,
                model: modelConfig.apiModel,
                maxTokens: Math.min(
                    options.maxTokens || modelConfig.features.maxTokens,
                    modelConfig.features.maxTokens
                )
            });
            
        } catch (error) {
            logger.error('Model call failed', { 
                modelId, 
                error: error.message 
            });
            throw error;
        }
    }
    
    // 流式调用
    async *chatStream(modelId, messages, options = {}) {
        const modelConfig = modelsConfig.models[modelId];
        if (!modelConfig || !modelConfig.features.supportStreaming) {
            throw new Error(`Model ${modelId} does not support streaming`);
        }
        
        const provider = this.providers.get(modelConfig.provider);
        if (!provider) {
            throw new Error(`Provider ${modelConfig.provider} not available`);
        }
        
        try {
            const stream = await provider.client.chatStream(messages, {
                ...options,
                model: modelConfig.apiModel,
                maxTokens: Math.min(
                    options.maxTokens || modelConfig.features.maxTokens,
                    modelConfig.features.maxTokens
                )
            });
            
            for await (const chunk of stream) {
                yield chunk;
            }
            
        } catch (error) {
            logger.error('Model stream failed', { 
                modelId, 
                error: error.message 
            });
            throw error;
        }
    }
}

module.exports = new ModelManager();
