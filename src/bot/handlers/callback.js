// bot/handlers/callback.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const MainMenu = require('../menus/main');
const SettingsMenu = require('../menus/settings');
const ArchiveMenu = require('../menus/archive');
const ModelMenu = require('../menus/model');
const ModeModule = require('../modules/mode');
const ArchiveModule = require('../modules/archive');
const MemoryModule = require('../modules/memory');
const CharacterModule = require('../modules/character');

class CallbackHandler {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
        
        // 初始化模块
        this.modeModule = new ModeModule(bot, stateManager);
        this.archiveModule = new ArchiveModule(bot, stateManager);
        this.memoryModule = new MemoryModule(bot, stateManager);
        this.characterModule = new CharacterModule(bot, stateManager);
    }
    
    async handle(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        
        await this.bot.answerCallbackQuery(query.id);
        
        logger.info('Callback query', { chatId, data });
        
        try {
            // 模式选择
            if (data.startsWith('mode_')) {
                await this.modeModule.handleModeSelection(chatId, messageId, data.replace('mode_', ''));
            }
            
            // 菜单导航
            else if (data === 'show_stats') {
                await this.handleShowStats(chatId, messageId);
            }
            else if (data === 'send_new_menu') {
                await MainMenu.send(this.bot, chatId);
            }
            else if (data === 'show_settings') {
                await SettingsMenu.show(this.bot, chatId, messageId);
            }
            else if (data === 'show_archives') {
                await ArchiveMenu.show(this.bot, chatId, messageId);
            }
            else if (data === 'show_memories') {
                await this.memoryModule.showMemories(chatId);
            }
            else if (data === 'back_to_menu') {
                await MainMenu.send(this.bot, chatId, messageId);
            }
            
            // 档案相关
            else if (data === 'char_archives') {
                await this.archiveModule.showCharacterArchives(chatId, messageId);
            }
            else if (data === 'story_archives') {
                await this.archiveModule.showStoryArchives(chatId, messageId);
            }
            else if (data.startsWith('load_char_')) {
                await this.archiveModule.handleLoadCharacter(chatId, messageId, data);
            }
            else if (data.startsWith('load_story_')) {
                await this.archiveModule.handleLoadStory(chatId, messageId, data);
            }
            else if (data.startsWith('use_char_')) {
                await this.archiveModule.handleUseCharacter(chatId, messageId, data);
            }
            else if (data.startsWith('continue_story_')) {
                await this.archiveModule.handleContinueStory(chatId, messageId, data);
            }
            else if (data.startsWith('del_char_')) {
                await this.archiveModule.handleDeleteCharacter(chatId, messageId, data, query);
            }
            else if (data.startsWith('del_story_')) {
                await this.archiveModule.handleDeleteStory(chatId, messageId, data, query);
            }
            else if (data === 'save_story') {
                await this.archiveModule.handleSaveStory(chatId, messageId, query);
            }
            
            // 角色相关
            else if (data === 'save_character') {
                await this.characterModule.handleSaveCharacter(chatId, messageId);
            }
            else if (data === 'dismiss_save') {
                await this.characterModule.handleDismissSave(chatId, messageId);
            }
            else if (data === 'use_imported_character') {
                await this.characterModule.handleUseImportedCharacter(chatId, messageId);
            }
            else if (data === 'export_character') {
                await this.characterModule.handleExportCharacter(chatId, messageId);
            }
            else if (data === 'export_json') {
                await this.characterModule.handleExportJSON(chatId);
            }
            else if (data === 'export_txt') {
                await this.characterModule.handleExportTXT(chatId);
            }
            else if (data === 'back_to_import') {
                await this.characterModule.handleBackToImport(chatId, messageId);
            }
            
            // 模型选择
            else if (data === 'model') {
                await ModelMenu.show(this.bot, chatId, messageId);
            }
            else if (data === 'model_nalang') {
                await ModelMenu.showNalangModels(this.bot, chatId, messageId);
            }
            else if (data === 'model_gemini') {
                await ModelMenu.showGeminiModels(this.bot, chatId, messageId);
            }
            else if (data === 'model_deepseek') {
                await ModelMenu.showDeepseekModels(this.bot, chatId, messageId);
            }
            else if (data.startsWith('set_model_')) {
                await ModelMenu.handleModelSelection(this.bot, chatId, messageId, data, query);
            }
            else if (data === 'back_to_model_menu') {
                await ModelMenu.show(this.bot, chatId, messageId);
            }
            
            // 设置相关
            else if (data.startsWith('setting_')) {
                await SettingsMenu.handleSettingSelection(this.bot, chatId, messageId, data.replace('setting_', ''));
            }
            else if (data.startsWith('set_')) {
                await SettingsMenu.handleSettingValue(this.bot, chatId, messageId, data, query);
            }
            
            // 记忆相关
            else if (data === 'clear_all_memories') {
                await this.memoryModule.handleClearAllMemories(chatId, query);
            }
            else if (data === 'export_memories') {
                await this.memoryModule.handleExportMemories(chatId);
            }
            else if (data.startsWith('forget_')) {
                await this.memoryModule.handleForgetMemory(chatId, data, query);
            }
            else if (data === 'cancel_forget') {
                await this.bot.sendMessage(chatId, '[取消] 已取消删除记忆。');
            }
            else if (data === 'reset_with_memories') {
                await this.memoryModule.handleResetWithMemories(chatId);
            }
            else if (data === 'reset_keep_memories') {
                await this.bot.sendMessage(chatId, '[✓] 对话已重置，记忆已保留。请使用 /menu 重新选择模式。');
            }
            
            // 其他
            else if (data === 'close') {
                await this.bot.deleteMessage(chatId, messageId);
            }
            
        } catch (error) {
            logger.error('Callback query error', { chatId, data, error: error.message });
            await this.bot.answerCallbackQuery(query.id, {
                text: '[错误] 处理请求时出错',
                show_alert: true
            });
        }
    }
    
    async handleShowStats(chatId, messageId) {
        const stats = database.getUsageStats(chatId);
        
        let statsMessage;
        if (!stats || stats.total_requests === 0) {
            statsMessage = '[统计] 您还没有使用记录。';
        } else {
            statsMessage = `
[统计] *您的使用统计*（最近30天）

[次数] 总请求次数：${stats.total_requests}
[消耗] 总Token使用：${stats.total_tokens || 0}
[时间] 最后使用：${new Date(stats.last_usage).toLocaleString('zh-CN')}
            `;
        }
        
        const state = this.stateManager.getState(chatId);
        if (state?.mode) {
            const memoryCount = database.getMemoryCount(chatId, state.mode);
            statsMessage += `\n[记忆] 当前模式记忆数：${memoryCount}`;
        }
        
        const keyboard = {
            inline_keyboard: [[
                { text: '[菜单] 返回主菜单', callback_data: 'send_new_menu' }
            ]]
        };
        
        await this.bot.sendMessage(chatId, statsMessage, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
}

module.exports = CallbackHandler;
