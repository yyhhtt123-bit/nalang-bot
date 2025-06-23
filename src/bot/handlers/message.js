// bot/handlers/message.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const aiManager = require('../../services/aiManager');
const memoryExtractor = require('../../services/memoryExtractor');
const { MODE_CONFIG } = require('../../prompts');
const { UPDATE_INTERVAL } = require('../constants');

class MessageHandler {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async handle(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const state = this.stateManager.getState(chatId);
        
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, 
                '请先选择一个模式。使用 /menu 显示主菜单。',
                { reply_to_message_id: msg.message_id }
            );
            return;
        }
        
        // 防止并发处理
        if (state.isProcessing) {
            await this.bot.sendMessage(chatId, 
                '... 正在处理上一条消息，请稍候...',
                { reply_to_message_id: msg.message_id }
            );
            return;
        }
        
        await this.processChat(chatId, text, state, msg.message_id);
    }
    
    async processChat(chatId, text, state, replyToMessageId) {
        this.stateManager.setProcessing(chatId, true);
        
        const sentMsg = await this.bot.sendMessage(chatId, '... 正在思考...', {
            reply_to_message_id: replyToMessageId
        });
        
        try {
            // 获取用户设置
            const userSettings = database.getUserSettings(chatId) || {
                model: 'nalang-xl',
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
            
            // 构建消息
            const messages = await this.buildMessages(chatId, state.mode, text);
            
            // 获取AI响应
            const fullResponse = await this.getAIResponse(
                messages, 
                state.mode, 
                userSettings, 
                chatId, 
                sentMsg.message_id
            );
            
            // 保存对话和记忆
            await this.saveConversation(chatId, state.mode, messages, fullResponse);
            await this.extractAndSaveMemories(chatId, state.mode, fullResponse, text);
            
            // 记录使用统计
            const estimatedTokens = aiManager.estimateTokens(text + fullResponse);
            database.recordUsage(chatId, state.mode, estimatedTokens);
            
        } catch (error) {
            logger.error('Chat processing error', {
                chatId,
                mode: state.mode,
                error: error.message
            });
            
            await this.bot.editMessageText(
                '[X] 处理请求时出错。请稍后重试或使用 /reset 重置对话。',
                {
                    chat_id: chatId,
                    message_id: sentMsg.message_id
                }
            );
        } finally {
            this.stateManager.setProcessing(chatId, false);
        }
    }
    
    async buildMessages(chatId, mode, text) {
        // 获取对话历史
        let messages = database.getConversation(chatId, mode) || 
                       [{ role: 'system', content: MODE_CONFIG[mode].prompt }];
        
        // 搜索相关记忆并加入到系统提示
        const relevantMemories = database.getRelevantMemories(chatId, mode, text, 10);
        
        let finalSystemPrompt = MODE_CONFIG[mode].prompt;
        
        if (relevantMemories.length > 0) {
            const memoryContext = this.formatMemoriesForContext(relevantMemories);
            finalSystemPrompt += '\n\n' + memoryContext;
        }
        
        // 更新系统提示
        messages[0] = {
            role: 'system',
            content: finalSystemPrompt
        };
        
        // 新增用户消息
        messages.push({ role: 'user', content: text });
        
        // 限制对话长度
        const userSettings = database.getUserSettings(chatId);
        const maxMessages = Math.floor((userSettings?.contextWindow || 4096) / 100);
        if (messages.length > maxMessages) {
            const systemMessage = messages[0];
            messages = [systemMessage, ...messages.slice(-(maxMessages - 1))];
        }
        
        return messages;
    }
    
    async getAIResponse(messages, mode, settings, chatId, messageId) {
        let fullResponse = '';
        const response = await aiManager.chat(messages, {
            mode: MODE_CONFIG[mode].apiMode,
            model: settings.model || 'nalang-xl',
            maxTokens: settings.maxTokens || MODE_CONFIG[mode].maxTokens,
            temperature: settings.temperature || MODE_CONFIG[mode].temperature,
            stream: true
        });
        
        // 根据提供商处理流式响应
        const provider = aiManager.modelProviders[settings.model || 'nalang-xl'];
        const client = aiManager.clients[settings.model || 'nalang-xl'];
        
        if (provider === 'gemini') {
            // Gemini 不支持真正的流式响应
            fullResponse = await client.chatComplete(messages, {
                mode: MODE_CONFIG[mode].apiMode,
                model: settings.model,
                maxTokens: settings.maxTokens || MODE_CONFIG[mode].maxTokens,
                temperature: settings.temperature || MODE_CONFIG[mode].temperature
            });
            
            await this.bot.editMessageText(fullResponse, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });
        } else {
            // NaLang 和 Chutes 支持流式响应
            let lastUpdate = Date.now();
            
            for await (const chunk of client.processStream(response)) {
                fullResponse += chunk;
                
                // 每300ms更新一次消息
                if (Date.now() - lastUpdate > UPDATE_INTERVAL && fullResponse.trim()) {
                    await this.bot.editMessageText(fullResponse + '|', {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }).catch(() => {});
                    lastUpdate = Date.now();
                }
            }
            
            // 发送最终消息
            await this.bot.editMessageText(fullResponse, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });
        }
        
        if (!fullResponse || fullResponse.trim() === '') {
            throw new Error('AI响应为空');
        }
        
        return fullResponse;
    }
    
    async saveConversation(chatId, mode, messages, response) {
        messages[0].content = MODE_CONFIG[mode].prompt;
        messages.push({ role: 'assistant', content: response });
        database.saveConversation(chatId, mode, messages);
    }
    
    async extractAndSaveMemories(chatId, mode, aiResponse, userInput) {
        try {
            const memories = await memoryExtractor.extractMemories(aiResponse, userInput, mode);
            
            for (const memory of memories) {
                database.saveAutoMemory(chatId, mode, memory);
            }
            
            if (memories.length > 0) {
                logger.info('Auto memories extracted and saved', { 
                    chatId, 
                    mode, 
                    count: memories.length,
                    types: [...new Set(memories.map(m => m.memory_type))]
                });
            }
        } catch (error) {
            logger.error('Failed to extract memories', { 
                chatId, 
                mode,
                error: error.message 
            });
        }
    }
    
    formatMemoriesForContext(memories) {
        const memoryLines = ['[相关记忆信息]'];
        const grouped = {};
        
        memories.forEach(memory => {
            if (!grouped[memory.memory_type]) {
                grouped[memory.memory_type] = [];
            }
            grouped[memory.memory_type].push(memory);
        });
        
        // 格式化每种类型的记忆
        for (const [type, mems] of Object.entries(grouped)) {
            const typeName = this.getMemoryTypeName(type);
            memoryLines.push(`\n${typeName}：`);
            mems.forEach(m => {
                memoryLines.push(`- ${m.key_name}：${m.content}`);
            });
        }
        
        memoryLines.push('\n请基于以上记忆信息，保持角色和人物的连贯性。');
        
        return memoryLines.join('\n');
    }
    
    getMemoryTypeName(type) {
        const typeNames = {
            character: '已知角色',
            location: '已知场景',
            item: '已知物品',
            event: '重要事件',
            relationship: '关系信息',
            bodyFeatures: '身体特征',
            clothing: '服装信息',
            actions: '已知动作/反应',
            sensations: '感觉/感受',
            roles: '角色关系',
            scenarios: '场景/设定',
            fetishes: '特殊偏好',
            user_info: '用户信息',
            preference: '用户偏好',
            dislike: '用户厌恶',
            nickname: '昵称偏好',
            safeword: '安全词'
        };
        return typeNames[type] || type;
    }
}

module.exports = MessageHandler;
