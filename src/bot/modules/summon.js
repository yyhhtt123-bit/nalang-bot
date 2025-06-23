const aiManager = require('../../services/aiManager');
const database = require('../../utils/database');
const logger = require('../../utils/logger');
const { MODE_CONFIG } = require('../../prompts');

class SummonModule {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
        this.tempCharacterData = new Map();
    }
    
    async summon(chatId, prompt) {
        const sentMsg = await this.bot.sendMessage(chatId, '[*] 施法中...正在解析咒语...');
        
        try {
            const messages = [
                { role: 'system', content: MODE_CONFIG.summon.prompt },
                { role: 'user', content: prompt }
            ];
            
            const userSettings = database.getUserSettings(chatId) || {
                model: 'nalang-xl',
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
            
            const response = await aiManager.chatComplete(messages, {
                mode: MODE_CONFIG.summon.apiMode,
                model: userSettings.model,
                maxTokens: MODE_CONFIG.summon.maxTokens,
                temperature: MODE_CONFIG.summon.temperature
            });
            
            if (!response || response.trim() === '') {
                throw new Error('AI响应为空');
            }
            
            await this.bot.editMessageText(response, {
                chat_id: chatId,
                message_id: sentMsg.message_id,
                parse_mode: 'Markdown'
            });
            
            // 临时存储角色数据
            this.tempCharacterData.set(chatId, {
                name: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
                data: {
                    prompt: prompt,
                    response: response,
                    systemPrompt: MODE_CONFIG.summon.prompt,
                    timestamp: new Date().toISOString()
                }
            });
            
            const keyboard = {
                inline_keyboard: [[
                    { text: '[保存] 保存到人物档案', callback_data: 'save_character' },
                    { text: '[X] 不保存', callback_data: 'dismiss_save' }
                ]]
            };
            
            await this.bot.sendMessage(chatId, '是否要保存这个角色到档案？', {
                reply_markup: keyboard
            });
            
            database.recordUsage(chatId, 'summon');
            
        } catch (error) {
            logger.error('Summon error', { chatId, error: error.message });
            await this.bot.editMessageText('[X] 召唤失败，请稍后重试。', {
                chat_id: chatId,
                message_id: sentMsg.message_id
            });
        }
    }
    
    getTempCharacter(chatId) {
        return this.tempCharacterData.get(chatId);
    }
    
    clearTempCharacter(chatId) {
        this.tempCharacterData.delete(chatId);
    }
}

module.exports = SummonModule;
