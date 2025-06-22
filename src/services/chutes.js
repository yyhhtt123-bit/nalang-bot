const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config');

class ChutesClient {
    constructor() {
        this.apiToken = config.chutes.apiToken;
        this.apiUrl = config.chutes.apiUrl;
    }

    // 新增：模型映射方法
    getApiModelName(model) {
        const modelMapping = {
            'deepseek-v3': 'deepseek-ai/DeepSeek-V3',
            'deepseek-r1': 'deepseek-ai/DeepSeek-R1',
            'deepseek-chat': 'deepseek-ai/DeepSeek-Chat',
            'deepseek-coder': 'deepseek-ai/DeepSeek-Coder'
        };
        
        const apiModel = modelMapping[model] || model;
        if (modelMapping[model]) {
            logger.info(`Model name mapped: ${model} -> ${apiModel}`);
        }
        
        return apiModel;
    }

    // 新增：用于移除 <think>... </think> 代码块的私有方法
    _stripThinkBlock(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const endTag = '</think>';
        const startIndex = text.indexOf(endTag);

        if (startIndex !== -1) {
            return text.substring(startIndex + endTag.length).trim();
        }
        
        return text;
    }
    
    // 将消息格式转换为 Chutes/DeepSeek 格式
    convertMessages(messages) {
        return messages;
    }
    
    async chat(messages, options = {}) {
        const maxRetries = options.maxRetries || 3;
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                logger.debug('Attempting Chutes API call', { 
                    attempt: attempt + 1,
                    model: options.model
                });
                
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 120000); // 120秒超时
                
                const requestBody = {
                    model: this.getApiModelName(options.model || 'deepseek-v3'),  // 使用映射后的模型名
                    messages: this.convertMessages(messages),
                    stream: options.stream !== false,
                    max_tokens: options.maxTokens || 2048,
                    temperature: options.temperature || 0.7
                };
                
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiToken}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    logger.error('Chutes API error response', {
                        status: response.status,
                        statusText: response.statusText,
                        errorText: errorText.substring(0, 500)
                    });
                    
                    const error = new Error(`Chutes API错误: ${response.status} ${response.statusText}`);
                    error.status = response.status;
                    throw error;
                }
                
                logger.info('Chutes API call successful', { 
                    status: response.status 
                });
                
                return response;
                
            } catch (error) {
                lastError = error;
                
                logger.error('Chutes API call failed', {
                    attempt: attempt + 1,
                    error: error.message,
                    status: error.status
                });
                
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('Chutes API调用失败');
    }
    
    // 处理流式响应
    async *processStream(response) {
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
            for await (const chunk of response.body) {
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(5).trim();
                        
                        if (data === '[DONE]') {
                            return;
                        }
                        
                        if (data) {
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    yield content;
                                }
                            } catch (e) {
                                logger.debug('Failed to parse stream data', { data, error: e.message });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Stream processing error', { error: error.message });
            throw error;
        }
    }

    async chatComplete(messages, options = {}) {
        let fullContent = '';
        
        try {
            // 调用 chat 方法，model 字段已映射，无需额外修改
            const response = await this.chat(messages, { ...options, stream: true });
            
            for await (const chunk of this.processStream(response)) {
                fullContent += chunk;
            }
            
            // 调用净化函数，去除 <think> 标签内容
            const finalContent = this._stripThinkBlock(fullContent);

            if (!finalContent || finalContent.trim() === '') {
                logger.warn('Empty response after stripping think block', { originalLength: fullContent.length });
                throw new Error('AI响应内容为空');
            }
            
            return finalContent;
            
        } catch (error) {
            logger.error('Chutes chat completion error', { error: error.message });
            throw error;
        }
    }

    // ... (其他函数保持不变)
}

module.exports = new ChutesClient();
