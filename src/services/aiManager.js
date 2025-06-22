const nalangClient = require('./nalang');
const geminiClient = require('./gemini');
const chutesClient = require('./chutes');
const logger = require('../utils/logger');

class AIManager {
    constructor() {
        // 初始化客户端映射
        this.clients = {
            'nalang-xl': nalangClient,
            'nalang-turbo': nalangClient,
            'models/gemini-2.0-flash': geminiClient,  // 添加 models/ 前缀
            'models/gemini-2.5-flash': geminiClient,  // 添加 models/ 前缀
            'models/gemini-2.0-flash-thinking-exp': geminiClient,  // 完整路径
            'models/gemma-3-27b-it': geminiClient,  // 完整路径
            'deepseek-v3': chutesClient,
            'deepseek-r1': chutesClient
        };
        
        // 模型到提供商的映射
        this.modelProviders = {
            'nalang-xl': 'nalang',
            'nalang-turbo': 'nalang',
            'models/gemini-2.0-flash': 'gemini',  // 添加 models/ 前缀
            'models/gemini-2.5-flash': 'gemini',  // 添加 models/ 前缀
            'models/gemini-2.0-flash-thinking-exp': 'gemini',  // 完整路径
            'models/gemma-3-27b-it': 'gemini',  // 完整路径
            'deepseek-v3': 'chutes',
            'deepseek-r1': 'chutes'
        };
        
        // 默认模型
        this.defaultModel = 'nalang-xl';
        
        // 模型使用统计
        this.modelUsageStats = new Map();
        
        // 验证客户端
        logger.info('AI Manager initialized', {
            availableModels: Object.keys(this.clients),
            providers: [...new Set(Object.values(this.modelProviders))]
        });
    }
    
    // 获取可用的模型列表
    getAvailableModels() {
        return Object.keys(this.clients);
    }
    
    // 获取模型的提供商
    getModelProvider(model) {
        return this.modelProviders[model];
    }
    
    // 获取模型的显示名称
getModelDisplayName(model) {
    const displayNames = {
        'nalang-xl': 'NaLang-XL',
        'nalang-turbo': 'NaLang-Turbo',
        'models/gemini-2.0-flash': 'Gemini 2.0 Flash',
        'models/gemini-2.5-flash': 'Gemini 2.5 Flash',
        'models/gemini-2.0-flash-thinking-exp': 'Gemini Thinking',
        'models/gemma-3-27b-it': 'Gemma 27B',
        'deepseek-v3': 'DeepSeek V3',
        'deepseek-r1': 'DeepSeek R1'
    };
    return displayNames[model] || model;
}
    
    // 记录模型使用
    recordModelUsage(model, success = true) {
        const stats = this.modelUsageStats.get(model) || { 
            total: 0, 
            success: 0, 
            failure: 0,
            lastUsed: null 
        };
        
        stats.total++;
        if (success) {
            stats.success++;
        } else {
            stats.failure++;
        }
        stats.lastUsed = new Date();
        
        this.modelUsageStats.set(model, stats);
    }
    
    // 获取模型统计信息
    getModelStats(model) {
        return this.modelUsageStats.get(model) || { 
            total: 0, 
            success: 0, 
            failure: 0,
            lastUsed: null 
        };
    }
    
    // 主要的聊天方法
    async chat(messages, options = {}) {
        const model = options.model || this.defaultModel;
        const provider = this.modelProviders[model];
        const client = this.clients[model];
        
        logger.debug('AIManager chat called', {
            model,
            provider,
            messagesCount: messages.length,
            options: { ...options, model }
        });
        
        if (!client) {
            this.recordModelUsage(model, false);
            throw new Error(`不支持的模型: ${model}`);
        }
        
        if (typeof client.chat !== 'function') {
            this.recordModelUsage(model, false);
            logger.error('Client missing chat method', {
                provider,
                model,
                clientType: typeof client
            });
            throw new Error(`客户端 ${provider} 没有 chat 方法`);
        }
        
        try {
            // 根据不同的提供商调整选项
            const adjustedOptions = this.adjustOptionsForProvider(provider, options);
            adjustedOptions.model = model;
            
            // 添加模式信息
            if (options.mode) {
                adjustedOptions.mode = options.mode;
            }
            
            const response = await client.chat(messages, adjustedOptions);
            this.recordModelUsage(model, true);
            return response;
            
        } catch (error) {
            this.recordModelUsage(model, false);
            logger.error('AI chat failed', {
                model,
                provider,
                error: error.message,
                status: error.status
            });
            
            // 如果是特定错误，尝试降级到备用模型
            if (this.shouldFallback(error, model)) {
                logger.info('Attempting fallback to default model');
                return this.chat(messages, { ...options, model: this.defaultModel });
            }
            
            throw error;
        }
    }
    
    // 调整不同提供商的选项
    adjustOptionsForProvider(provider, options) {
        const adjusted = { ...options };
        
        switch (provider) {
            case 'nalang':
                // NaLang 特定调整
                adjusted.temperature = options.temperature || 0.8;
                adjusted.maxTokens = options.maxTokens || 2000;
                break;
                
            case 'gemini':
                // Gemini 特定调整
                adjusted.temperature = Math.min(options.temperature || 0.7, 1.0);
                adjusted.maxTokens = options.maxTokens || 2048;
                adjusted.topP = options.topP || 0.95;
                break;
                
            case 'chutes':
                // DeepSeek 特定调整
                adjusted.temperature = options.temperature || 0.7;
                adjusted.maxTokens = options.maxTokens || 2000;
                break;
        }
        
        return adjusted;
    }
    
    // 判断是否应该降级到备用模型
    shouldFallback(error, currentModel) {
        // 不要无限循环降级
        if (currentModel === this.defaultModel) {
            return false;
        }
        
        // 特定错误码触发降级
        const fallbackErrors = [502, 503, 504, 429];
        return error.status && fallbackErrors.includes(error.status);
    }
    
    // 流式聊天
    async *chatStream(messages, options = {}) {
        const model = options.model || this.defaultModel;
        const provider = this.modelProviders[model];
        const client = this.clients[model];
        
        if (!client) {
            throw new Error(`不支持的模型: ${model}`);
        }
        
        try {
            const adjustedOptions = this.adjustOptionsForProvider(provider, options);
            adjustedOptions.model = model;
            adjustedOptions.stream = true;
            
            if (options.mode) {
                adjustedOptions.mode = options.mode;
            }
            
            const response = await client.chat(messages, adjustedOptions);
            
            // 使用客户端的流处理方法
            if (client.processStream) {
                yield* client.processStream(response, model);
            } else {
                // 如果客户端没有流处理，降级为完整响应
                const text = await response.text();
                yield text;
            }
            
            this.recordModelUsage(model, true);
            
        } catch (error) {
            this.recordModelUsage(model, false);
            throw error;
        }
    }
    
    // 完整响应（非流式）
    async chatComplete(messages, options = {}) {
        const model = options.model || this.defaultModel;
        const provider = this.modelProviders[model];
        const client = this.clients[model];
        
        if (!client) {
            throw new Error(`不支持的模型: ${model}`);
        }
        
        try {
            const adjustedOptions = this.adjustOptionsForProvider(provider, options);
            adjustedOptions.model = model;
            adjustedOptions.stream = false;
            
            if (options.mode) {
                adjustedOptions.mode = options.mode;
            }
            
            // 优先使用客户端的 chatComplete 方法
            if (client.chatComplete) {
                return await client.chatComplete(messages, adjustedOptions);
            }
            
            // 否则收集流式响应
            let fullResponse = '';
            const response = await client.chat(messages, adjustedOptions);
            
            if (client.processStream) {
                for await (const chunk of client.processStream(response, model)) {
                    fullResponse += chunk;
                }
            } else {
                fullResponse = await response.text();
            }
            
            this.recordModelUsage(model, true);
            return fullResponse;
            
        } catch (error) {
            this.recordModelUsage(model, false);
            throw error;
        }
    }
    
    // 估算文本的 token 数量
    estimateTokens(text, model = null) {
        model = model || this.defaultModel;
        const client = this.clients[model];
        
        if (client && client.estimateTokens) {
            return client.estimateTokens(text);
        }
        
        // 默认估算方法
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishChars = text.length - chineseChars;
        return Math.ceil(chineseChars * 0.5 + englishChars * 0.25);
    }
    
    // 健康检查
    async healthCheck() {
        const results = {};
        
        for (const [model, client] of Object.entries(this.clients)) {
            try {
                if (client.healthCheck) {
                    results[model] = await client.healthCheck();
                } else {
                    // 简单测试
                    await this.chatComplete([
                        { role: 'user', content: 'Hi' }
                    ], { model, maxTokens: 10 });
                    results[model] = true;
                }
            } catch (error) {
                results[model] = false;
                logger.error('Health check failed', { model, error: error.message });
            }
        }
        
        return results;
    }
    
    // 获取所有模型的使用统计
    getAllStats() {
        const stats = {};
        for (const model of this.getAvailableModels()) {
            stats[model] = this.getModelStats(model);
        }
        return stats;
    }
}

// 导出单例
module.exports = new AIManager();
