const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config');

class NalangAIClient {
    constructor() {
        this.apiKeys = config.nalang.apiKeys;
        this.apiUrl = config.nalang.apiUrl;
        this.currentKeyIndex = 0;
        this.keyFailures = new Map();
        this.keyLastFailure = new Map();
    }
    
    getNextKey() {
        const now = Date.now();
        const cooldownPeriod = 1 * 60 * 1000; // 私人使用，冷却期减少到1分钟
        
        for (let i = 0; i < this.apiKeys.length; i++) {
            const index = (this.currentKeyIndex + i) % this.apiKeys.length;
            const key = this.apiKeys[index];
            const lastFailure = this.keyLastFailure.get(key) || 0;
            
            if (now - lastFailure > cooldownPeriod) {
                this.currentKeyIndex = (index + 1) % this.apiKeys.length;
                return { key, index };
            }
        }
        
        // 私人使用，直接返回下一个密钥
        const index = this.currentKeyIndex;
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return { key: this.apiKeys[index], index };
    }
    
    recordKeyFailure(key) {
        const failures = (this.keyFailures.get(key) || 0) + 1;
        this.keyFailures.set(key, failures);
        this.keyLastFailure.set(key, Date.now());
        
        logger.warn('API key failure recorded', { 
            keyIndex: this.apiKeys.indexOf(key) + 1,
            failures,
            totalKeys: this.apiKeys.length 
        });
    }
    
    resetKeyFailure(key) {
        this.keyFailures.delete(key);
        this.keyLastFailure.delete(key);
    }
    
    async chat(messages, options = {}) {
        const maxRetries = options.maxRetries || 5; // 私人使用，增加重试次数
        let lastError = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { key, index } = this.getNextKey();
            
            try {
                logger.debug('Attempting API call', { 
                    attempt: attempt + 1,
                    keyIndex: index + 1,
                    model: options.model || 'nalang-xl'
                });
                
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 120000); // 私人使用，超时改为120秒
                
                const requestBody = {
                    model: options.model || 'nalang-xl',
                    messages,
                    stream: options.stream !== false,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 2000, // 私人使用，增加最大token
                    top_p: options.topP || 0.35,
                    repetition_penalty: options.repetitionPenalty || 1.05
                };
                
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                // 不在这里检查response.ok，因为即使是错误响应也可能是200状态码
                // 让后续处理来判断
                
                this.resetKeyFailure(key);
                
                logger.info('API response received', { 
                    keyIndex: index + 1,
                    status: response.status 
                });
                
                return response;
                
            } catch (error) {
                lastError = error;
                
                // 如果是超时错误，不记录为密钥失败
                if (error.name === 'AbortError' || error.message.includes('aborted')) {
                    logger.warn('Request timeout, trying next key', {
                        attempt: attempt + 1,
                        keyIndex: index + 1
                    });
                    // 超时不算密钥失败，直接尝试下一个
                    continue;
                } else {
                    this.recordKeyFailure(key);
                }
                
                logger.error('API call failed', {
                    attempt: attempt + 1,
                    keyIndex: index + 1,
                    error: error.message,
                    status: error.status
                });
                
                // 私人使用，减少等待时间
                if (attempt < maxRetries - 1) {
                    const delay = 1000; // 固定1秒延迟
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('所有API密钥均失败了');
    }
    
    // 解析SSE格式的文本响应，包括错误处理
    parseSSEText(text) {
        const lines = text.split('\n');
        let fullContent = '';
        let errorFound = null;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') continue;
            
            if (trimmedLine.startsWith('data:')) {
                const data = trimmedLine.slice(5).trim();
                
                if (data === '[DONE]') {
                    break;
                }
                
                if (data) {
                    try {
                        const json = JSON.parse(data);
                        
                        // 检查是否是错误响应
                        if (json.error) {
                            errorFound = json.error;
                            break;
                        }
                        
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) {
                            fullContent += content;
                        }
                    } catch (e) {
                        logger.debug('Failed to parse SSE line', { 
                            line: trimmedLine,
                            error: e.message 
                        });
                    }
                }
            }
        }
        
        // 如果发现错误，抛出异常
        if (errorFound) {
            const errorMessage = errorFound.message || 'Unknown API error';
            const errorType = errorFound.type || 'unknown_error';
            const error = new Error(`API错误: ${errorMessage} (${errorType})`);
            error.apiError = errorFound;
            throw error;
        }
        
        return fullContent;
    }
    
    // 处理流式响应
    async *processStream(response) {
        let buffer = '';
        
        try {
            const stream = response.body;
            
            for await (const chunk of stream) {
                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '') continue;
                    
                    if (trimmedLine.startsWith('data:')) {
                        const data = trimmedLine.slice(5).trim();
                        
                        if (data === '[DONE]') {
                            return;
                        }
                        
                        if (data) {
                            try {
                                const json = JSON.parse(data);
                                
                                // 检查是否是错误响应
                                if (json.error) {
                                    const errorMessage = json.error.message || 'Unknown API error';
                                    const errorType = json.error.type || 'unknown_error';
                                    throw new Error(`API错误: ${errorMessage} (${errorType})`);
                                }
                                
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    yield content;
                                }
                            } catch (e) {
                                // 如果是API错误，直接抛出
                                if (e.message.startsWith('API错误:')) {
                                    throw e;
                                }
                                logger.debug('Failed to parse stream data', { 
                                    data: data.substring(0, 100), 
                                    error: e.message 
                                });
                            }
                        }
                    }
                }
            }
            
            // 处理最后剩余的buffer
            if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data:')) {
                        const data = trimmedLine.slice(5).trim();
                        if (data && data !== '[DONE]') {
                            try {
                                const json = JSON.parse(data);
                                
                                // 检查是否是错误响应
                                if (json.error) {
                                    const errorMessage = json.error.message || 'Unknown API error';
                                    const errorType = json.error.type || 'unknown_error';
                                    throw new Error(`API错误: ${errorMessage} (${errorType})`);
                                }
                                
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    yield content;
                                }
                            } catch (e) {
                                // 如果是API错误，直接抛出
                                if (e.message.startsWith('API错误:')) {
                                    throw e;
                                }
                                logger.debug('Failed to parse final buffer', { 
                                    data: data.substring(0, 100), 
                                    error: e.message 
                                });
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
    
    // 修复：正确处理流式和非流式响应，包括错误
    async chatComplete(messages, options = {}) {
        let fullContent = '';
        
        try {
            // 对于confession模式，我们总是使用非流式请求
            const forceNonStream = options.mode === 'confession' || options.forceNonStream;
            
            const response = await this.chat(messages, { 
                ...options, 
                stream: !forceNonStream 
            });
            
            // 读取完整响应文本
            const text = await response.text();
            
            // 记录响应预览，用于调试
            logger.debug('API response preview', {
                length: text.length,
                preview: text.substring(0, 200),
                hasData: text.includes('data:'),
                hasError: text.includes('error')
            });
            
            // 检查是否是SSE格式（包含"data:"）
            if (text.includes('data:')) {
                // 是SSE格式，解析它（包括错误处理）
                try {
                    fullContent = this.parseSSEText(text);
                } catch (error) {
                    // 如果是API错误，重新抛出
                    if (error.message.startsWith('API错误:')) {
                        throw error;
                    }
                    // 其他解析错误
                    logger.error('Failed to parse SSE response', { 
                        error: error.message,
                        responseText: text.substring(0, 200)
                    });
                    throw new Error('无法解析API响应');
                }
            } else {
                // 尝试作为普通JSON解析
                try {
                    const json = JSON.parse(text);
                    
                    // 检查是否是错误响应
                    if (json.error) {
                        const errorMessage = json.error.message || 'Unknown API error';
                        const errorType = json.error.type || 'unknown_error';
                        throw new Error(`API错误: ${errorMessage} (${errorType})`);
                    }
                    
                    fullContent = json.choices?.[0]?.message?.content || '';
                } catch (e) {
                    logger.error('Failed to parse response as JSON', { 
                        error: e.message,
                        responsePreview: text.substring(0, 200)
                    });
                    
                    // 如果响应看起来像是有效内容，直接使用
                    if (text.length > 0 && !text.includes('error') && !text.includes('<')) {
                        fullContent = text;
                    } else {
                        throw new Error('无法解析API响应');
                    }
                }
            }
            
            // 检查响应是否为空
            if (!fullContent || fullContent.trim() === '') {
                logger.warn('Empty response from API, response text length:', text.length);
                throw new Error('AI响应内容为空');
            }
            
            return fullContent;
            
        } catch (error) {
            logger.error('Chat completion error', { error: error.message });
            
            // 对于confession模式的特殊错误处理
            if (options.mode === 'confession' && error.message.includes('Internal server error')) {
                throw new Error('confession模式暂时不可用，请稍后再试或切换其他模式');
            }
            
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
            const { key } = this.getNextKey();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: 'nalang-xl',
                    messages: [{ role: 'user', content: 'test' }],
                    stream: false,
                    max_tokens: 1
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return response.ok;
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            return false;
        }
    }
}

module.exports = new NalangAIClient();
