const config = require('../config');
const logger = require('../utils/logger');
const nalangClient = require('./nalang');
const SYSTEM_PROMPTS = require('../prompts'); // 引入提示词

class ModelClient {
    async chat(messages, options = {}) {
        try {
            const userSettings = options.userSettings || {};
            const modelKey = userSettings.preferredModel || config.defaultModel;
            const modelConfig = config.models[modelKey];
            
            if (!modelConfig) {
                throw new Error(`Model ${modelKey} not found`);
            }
            
            logger.info('Using model', { model: modelKey, provider: modelConfig.provider });
            
            // 动态加载提示词
            const systemPrompt = this.getSystemPrompt(options.mode, modelConfig.provider);
            if (systemPrompt) {
                const systemMessage = { role: 'system', content: systemPrompt };
                messages.unshift(systemMessage); // 将提示词插入到消息开头
            }

            // 确保消息以用户角色结尾
            if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
                messages.push({
                    role: 'user',
                    content: ' ' // 添加一条空白用户消息作为结束
                });
            }

            // 仅处理 Nalang 模型
            if (modelConfig.provider === 'nalang') {
                return await this.callNalang(messages, options, modelConfig);
            } else {
                throw new Error(`Unknown provider: ${modelConfig.provider}`);
            }
        } catch (error) {
            logger.error('Chat processing error', { error: error.message });
            throw error;
        }
    }

    // 动态获取系统提示词
    getSystemPrompt(mode, provider) {
        if (!mode || !provider) return null;
        const prompts = SYSTEM_PROMPTS[mode];
        if (!prompts) return null;

        return prompts[provider] || prompts.general || null; // 按优先级加载提示词
    }
    
    async callNalang(messages, options, modelConfig) {
        try {
            if (modelConfig.apiModel === 'gpt-3.5-turbo') {
                // Nalang Turbo
                return await nalangClient.chat(messages, {
                    ...options,
                    model: 'gpt-3.5-turbo',
                    stream: options.stream
                });
            }
            
            // Nalang XL
            return await nalangClient.chat(messages, {
                ...options,
                model: 'gpt-4',
                stream: options.stream
            });
        } catch (error) {
            logger.error('Nalang API error', { error: error.message });
            throw error;
        }
    }

    // 统一的流处理
    async *processStream(stream) {
        try {
            for await (const chunk of nalangClient.processStream(stream)) {
                yield chunk;
            }
        } catch (error) {
            logger.error('Stream processing error', { error: error.message });
            throw error;
        }
    }
}

module.exports = new ModelClient();
