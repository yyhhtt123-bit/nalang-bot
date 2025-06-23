// bot/modules/memory.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const { MEMORY_TYPE_NAMES } = require('../constants');

class MemoryModule {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async showMemories(chatId) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 请先选择一个模式。');
            return;
        }
        
        const memories = database.getAllMemories(chatId, state.mode);
        
        if (memories.length === 0) {
            await this.bot.sendMessage(chatId, '[记忆] 当前模式下还没有任何记忆。\n\n使用 /memory 可以手动新增记忆。');
            return;
        }
        
        // 按类型分组显示
        const grouped = {};
        memories.forEach(m => {
            if (!grouped[m.memory_type]) grouped[m.memory_type] = [];
            grouped[m.memory_type].push(m);
        });
        
        let message = `[记忆库] *${this.getModeName(state.mode)}* 的记忆：\n\n`;
        
        for (const [type, mems] of Object.entries(grouped)) {
            message += `*${MEMORY_TYPE_NAMES[type] || type}：*\n`;
            mems.slice(0, 5).forEach(m => {
                const content = m.content.substring(0, 50);
                message += `• ${m.key_name}: ${content}${m.content.length > 50 ? '...' : ''}\n`;
            });
            if (mems.length > 5) {
                message += `  _...还有 ${mems.length - 5} 条${MEMORY_TYPE_NAMES[type]}记忆_\n`;
            }
            message += '\n';
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '[搜索] 搜索记忆', callback_data: 'search_memories' },
                    { text: '[清空] 清除所有记忆', callback_data: 'clear_all_memories' }
                ],
                [
                    { text: '[导出] 导出记忆', callback_data: 'export_memories' },
                    { text: '[返回] 返回', callback_data: 'back_to_menu' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleClearAllMemories(chatId, query) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[!] 请先选择一个模式',
                show_alert: true
            });
            return;
        }
        
        const deletedCount = database.deleteAllMemories(chatId, state.mode);
        await this.bot.answerCallbackQuery(query.id, {
            text: `[✓] 已删除 ${deletedCount} 条记忆`,
            show_alert: true
        });
        
        await this.bot.sendMessage(chatId, `[记忆] 已清空${this.getModeName(state.mode)}模式下的所有记忆。`);
    }
    
    async handleResetWithMemories(chatId) {
        const state = this.stateManager.getState(chatId);
        if (state?.mode) {
            const deletedCount = database.deleteAllMemories(chatId, state.mode);
            logger.info('Memories cleared on reset', { chatId, mode: state.mode, deletedCount });
        }
        await this.bot.sendMessage(chatId, '[✓] 对话和记忆都已重置。请使用 /menu 重新选择模式。');
    }
    
    async handleForgetMemory(chatId, data, query) {
        const state = this.stateManager.getState(chatId);
        
        if (data.startsWith('forget_all_')) {
            const keywords = data.replace('forget_all_', '');
            const memories = database.getRelevantMemories(chatId, state.mode, keywords, 100);
            
            memories.forEach(m => {
                database.deleteMemory(chatId, m.id);
            });
            
            await this.bot.answerCallbackQuery(query.id, {
                text: `[✓] 已删除 ${memories.length} 条相关记忆`,
                show_alert: true
            });
        } else {
            const memoryId = parseInt(data.replace('forget_', ''));
            const success = database.deleteMemory(chatId, memoryId);
            
            await this.bot.answerCallbackQuery(query.id, {
                text: success ? '[✓] 记忆已删除' : '[X] 删除失败',
                show_alert: true
            });
        }
    }
    
    async handleExportMemories(chatId) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 请先选择一个模式。');
            return;
        }
        
        const memories = database.getAllMemories(chatId, state.mode);
        if (memories.length === 0) {
            await this.bot.sendMessage(chatId, '[记忆] 没有可导出的记忆。');
            return;
        }
        
        // 格式化记忆为文本
        let exportText = `AI记忆导出 - ${this.getModeName(state.mode)}\n`;
        exportText += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
        exportText += `记忆总数：${memories.length}\n\n`;
        
        // 按类型分组
        const grouped = {};
        memories.forEach(m => {
            if (!grouped[m.memory_type]) grouped[m.memory_type] = [];
            grouped[m.memory_type].push(m);
        });
        
        for (const [type, mems] of Object.entries(grouped)) {
            exportText += `\n【${MEMORY_TYPE_NAMES[type] || type}】\n`;
            mems.forEach(m => {
                exportText += `- ${m.key_name}: ${m.content}\n`;
                exportText += `  重要性: ${m.importance} | 最后提及: ${new Date(m.last_mentioned).toLocaleString('zh-CN')}\n\n`;
            });
        }
        
        // 发送为文件
        const buffer = Buffer.from(exportText, 'utf8');
        await this.bot.sendDocument(chatId, buffer, {
            caption: '[记忆] 导出完成',
            filename: `memories_${state.mode}_${Date.now()}.txt`
        }, {
            filename: `memories_${state.mode}_${Date.now()}.txt`,
            contentType: 'text/plain'
        });
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

module.exports = MemoryModule;
