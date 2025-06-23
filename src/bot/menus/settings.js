// bot/menus/settings.js
const database = require('../../utils/database');
const aiManager = require('../../services/aiManager');

class SettingsMenu {
    static async show(bot, chatId, messageId) {
        const settings = database.getUserSettings(chatId) || {
            model: 'nalang-xl',
            contextWindow: 4096,
            maxTokens: 1500,
            temperature: 0.7
        };
        
        const modelDisplayName = aiManager.getModelDisplayName(settings.model);
        
        const menuText = `[设置] *当前设置*\n\n` +
            `[窗口] 上下文窗口: ${settings.contextWindow} tokens\n` +
            `[长度] 最大输出长度: ${settings.maxTokens} tokens\n` +
            `[温度] Temperature: ${settings.temperature}\n` +
            `[模型] 当前模型: ${modelDisplayName}\n\n` +
            `_Temperature 越高，回复越有创意_`;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '[窗口] 调整上下文窗口', callback_data: 'setting_context' }],
                [{ text: '[长度] 调整最大输出长度', callback_data: 'setting_max_tokens' }],
                [{ text: '[温度] 调整 Temperature', callback_data: 'setting_temperature' }],
                [{ text: '[模型] 更换AI模型', callback_data: 'model' }],
                [{ text: '<- 返回主菜单', callback_data: 'back_to_menu' }]
            ]
        };
        
        await bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    static async handleSettingSelection(bot, chatId, messageId, settingType) {
        let text, keyboard;
        
        switch (settingType) {
            case 'context':
                text = '[窗口] 选择上下文窗口大小（影响AI能记住多少对话历史）：';
                keyboard = {
                    inline_keyboard: [
                        [{ text: '2048 tokens', callback_data: 'set_context_2048' }],
                        [{ text: '4096 tokens (推荐)', callback_data: 'set_context_4096' }],
                        [{ text: '8192 tokens', callback_data: 'set_context_8192' }],
                        [{ text: '<- 返回设置', callback_data: 'show_settings' }]
                    ]
                };
                break;
                
            case 'max_tokens':
                text = '[长度] 选择最大输出长度（每次回复的最大长度）：';
                keyboard = {
                    inline_keyboard: [
                        [{ text: '500 tokens (简短)', callback_data: 'set_tokens_500' }],
                        [{ text: '1000 tokens', callback_data: 'set_tokens_1000' }],
                        [{ text: '1500 tokens (推荐)', callback_data: 'set_tokens_1500' }],
                        [{ text: '2000 tokens (详细)', callback_data: 'set_tokens_2000' }],
                        [{ text: '<- 返回设置', callback_data: 'show_settings' }]
                    ]
                };
                break;
                
            case 'temperature':
                text = '[温度] 选择 Temperature（创意程度）：';
                keyboard = {
                    inline_keyboard: [
                        [
                            { text: '0.5 (保守)', callback_data: 'set_temp_0.5' },
                            { text: '0.7 (平衡)', callback_data: 'set_temp_0.7' }
                        ],
                        [
                            { text: '0.8 (创意)', callback_data: 'set_temp_0.8' },
                            { text: '0.9 (更创意)', callback_data: 'set_temp_0.9' }
                        ],
                        [{ text: '<- 返回设置', callback_data: 'show_settings' }]
                    ]
                };
                break;
        }
        
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    static async handleSettingValue(bot, chatId, messageId, data, query) {
        const parts = data.split('_');
        const settingType = parts[1];
        const value = parts.slice(2).join('_');
        
        const settings = database.getUserSettings(chatId) || {
            model: 'nalang-xl',
            contextWindow: 4096,
            maxTokens: 1500,
            temperature: 0.7
        };
        
        switch (settingType) {
            case 'context':
                settings.contextWindow = parseInt(value);
                break;
            case 'tokens':
                settings.maxTokens = parseInt(value);
                break;
            case 'temp':
                settings.temperature = parseFloat(value);
                break;
        }
        
        database.saveUserSettings(chatId, settings);
        
        await bot.answerCallbackQuery(query.id, { 
            text: '[✓] 设置已保存',
            show_alert: false 
        });
        
        await this.show(bot, chatId, messageId);
    }
}

module.exports = SettingsMenu;
