// bot/menus/model.js
const database = require('../../utils/database');
const aiManager = require('../../services/aiManager');

class ModelMenu {
    static async show(bot, chatId, messageId) {
        const text = '[模型] 选择AI模型提供商：';
        const keyboard = {
            inline_keyboard: [
                [{ text: 'NaLang', callback_data: 'model_nalang' }],
                [{ text: 'Gemini', callback_data: 'model_gemini' }],
                [{ text: 'DeepSeek', callback_data: 'model_deepseek' }],
                [{ text: '<- 返回设置', callback_data: 'show_settings' }]
            ]
        };
        
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    static async showNalangModels(bot, chatId, messageId) {
        const text = '[NaLang] 选择模型：';
        const keyboard = {
            inline_keyboard: [
                [{ text: 'NaLang-XL (推荐)', callback_data: 'set_model_nalang-xl' }],
                [{ text: 'NaLang-Turbo', callback_data: 'set_model_nalang-turbo' }],
                [
                    { text: '<- 返回', callback_data: 'back_to_model_menu' },
                    { text: '关闭', callback_data: 'close' }
                ]
            ]
        };
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    static async showGeminiModels(bot, chatId, messageId) {
        const text = '[Gemini] 选择模型：';
        const keyboard = {
            inline_keyboard: [
                [{ text: 'Gemini 2.0 Flash', callback_data: 'set_model_models/gemini-2.0-flash' }],
                [{ text: 'Gemini 2.5 Flash', callback_data: 'set_model_models/gemini-2.5-flash' }],
                [{ text: 'Gemini Thinking', callback_data: 'set_model_models/gemini-2.0-flash-thinking-exp' }],
                [{ text: 'Gemma 27B', callback_data: 'set_model_models/gemma-3-27b-it' }],
                [
                    { text: '<- 返回', callback_data: 'back_to_model_menu' },
                    { text: '关闭', callback_data: 'close' }
                ]
            ]
        };
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    static async showDeepseekModels(bot, chatId, messageId) {
        const text = '[DeepSeek] 选择模型：';
        const keyboard = {
            inline_keyboard: [
                [{ text: 'DeepSeek V3', callback_data: 'set_model_deepseek-v3' }],
                [{ text: 'DeepSeek R1', callback_data: 'set_model_deepseek-r1' }],
                [
                    { text: '<- 返回', callback_data: 'back_to_model_menu' },
                    { text: '关闭', callback_data: 'close' }
                ]
            ]
        };
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    static async handleModelSelection(bot, chatId, messageId, data, query) {
        const modelMap = {
            'set_model_nalang-xl': 'nalang-xl',
            'set_model_nalang-turbo': 'nalang-turbo',
            'set_model_models/gemini-2.0-flash': 'models/gemini-2.0-flash',
            'set_model_models/gemini-2.5-flash': 'models/gemini-2.5-flash',
            'set_model_models/gemini-2.0-flash-thinking-exp': 'models/gemini-2.0-flash-thinking-exp',
            'set_model_models/gemma-3-27b-it': 'models/gemma-3-27b-it',
            'set_model_deepseek-v3': 'deepseek-v3',
            'set_model_deepseek-r1': 'deepseek-r1'
        };
        
        const model = modelMap[data];
        if (model) {
            const settings = database.getUserSettings(chatId) || {
                model: 'nalang-xl',
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
            
            settings.model = model;
            database.saveUserSettings(chatId, settings);
            
            const displayName = aiManager.getModelDisplayName(model);
            
            await bot.answerCallbackQuery(query.id, {
                text: `✓ 已切换到 ${displayName}`,
                show_alert: true
            });
            
            await bot.deleteMessage(chatId, messageId);
            
            const SettingsMenu = require('./settings');
            const newMsg = await bot.sendMessage(chatId, '正在更新设置...');
            await SettingsMenu.show(bot, chatId, newMsg.message_id);
        }
    }
}

module.exports = ModelMenu;