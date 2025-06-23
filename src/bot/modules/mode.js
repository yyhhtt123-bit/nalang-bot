// bot/modules/mode.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const aiManager = require('../../services/aiManager');
const { MODE_CONFIG } = require('../../prompts');

class ModeModule {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async handleModeSelection(chatId, messageId, mode) {
        const modeConfig = MODE_CONFIG[mode];
        if (!modeConfig) {
            await this.bot.sendMessage(chatId, '[X] 未知的模式选择。');
            return;
        }
        
        // 更新用户状态
        this.stateManager.setState(chatId, { mode, isProcessing: false });
        
        // 加载或创建对话历史
        let messages = database.getConversation(chatId, mode);
        if (!messages) {
            messages = [{ role: 'system', content: modeConfig.prompt }];
            database.saveConversation(chatId, mode, messages);
        }
        
        // 发送欢迎消息
        await this.bot.editMessageText(`[✓] 已切换到${this.getModeName(mode)}`, {
            chat_id: chatId,
            message_id: messageId
        });
        
        // 检查是否有相关记忆
        const memoryCount = database.getMemoryCount(chatId, mode);
        let welcomeMsg = modeConfig.welcomeMessage;
        
        if (memoryCount > 0) {
            welcomeMsg += `\n\n_[记忆] 在该模式下有 ${memoryCount} 条记忆_`;
        }
        
        await this.bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
        
        // 如果是需要自动开始的模式（如忏悔室）
        if (modeConfig.autoStart) {
            await this.processAutoStart(chatId, mode);
        }
        
        // 如果是角色扮演模式，新增保存按钮
        if (mode === 'roleplay') {
            const keyboard = {
                inline_keyboard: [[
                    { text: '[保存] 保存当前故事', callback_data: 'save_story' }
                ]]
            };
            
            await this.bot.sendMessage(chatId, '提示：您可以随时保存当前的故事进度', {
                reply_markup: keyboard
            });
        }
    }
    
    async processAutoStart(chatId, mode) {
        const sentMsg = await this.bot.sendMessage(chatId, '... 正在准备...');
        
        try {
            const messages = database.getConversation(chatId, mode) || 
                           [{ role: 'system', content: MODE_CONFIG[mode].prompt }];
            
            const userSettings = database.getUserSettings(chatId) || {
                model: 'nalang-xl',
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
            
            const response = await aiManager.chatComplete(messages, {
                mode: MODE_CONFIG[mode].apiMode,
                model: userSettings.model || 'nalang-xl',
                maxTokens: MODE_CONFIG[mode].maxTokens,
                temperature: MODE_CONFIG[mode].temperature,
                forceNonStream: mode === 'confession'
            });
            
            if (!response || response.trim() === '') {
                throw new Error('AI响应为空');
            }
            
            await this.bot.editMessageText(response, {
                chat_id: chatId,
                message_id: sentMsg.message_id,
                parse_mode: 'Markdown'
            });
            
            // 保存AI响应
            messages.push({ role: 'assistant', content: response });
            database.saveConversation(chatId, mode, messages);
            database.recordUsage(chatId, mode);
            
        } catch (error) {
            logger.error('Auto start error', { chatId, mode, error: error.message });
            
            await this.bot.editMessageText('[!] 启动失败，请稍后重试或使用 /reset 重置对话。', {
                chat_id: chatId,
                message_id: sentMsg.message_id
            });
        }
    }
    
    getModeName(mode) {
        const names = {
            general: '通用模式',
            adult: '成人模式',
            roleplay: '角色扮演模式',
            confession: '忏悔室模式',
            summon: '召唤模式'
        };
        return names[mode] || mode;
    }
}

module.exports = ModeModule;
