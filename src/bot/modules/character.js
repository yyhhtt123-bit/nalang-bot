// bot/modules/character.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const characterCardParser = require('../../services/characterCardParser');
const { MODE_CONFIG } = require('../../prompts');

class CharacterModule {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async handleSaveCharacter(chatId, messageId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData) {
            await this.bot.editMessageText('[X] 没有找到待保存的角色数据', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const characterId = database.saveCharacter(chatId, tempData.name, tempData.data);
        
        if (characterId) {
            await this.bot.editMessageText('[✓] 角色已保存到档案！', {
                chat_id: chatId,
                message_id: messageId
            });
            this.stateManager.clearTempCharacter(chatId);
        } else {
            await this.bot.editMessageText('[X] 保存失败，请稍后重试', {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }
    
    async handleDismissSave(chatId, messageId) {
        this.stateManager.clearTempCharacter(chatId);
        await this.bot.editMessageText('已取消保存', {
            chat_id: chatId,
            message_id: messageId
        });
    }
    
    async handleUseImportedCharacter(chatId, messageId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData) {
            await this.bot.editMessageText('[X] 没有找到角色数据', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        // 设置为角色扮演模式
        this.stateManager.setState(chatId, { mode: 'roleplay', isProcessing: false });
        
        // 创建系统提示
        const systemPrompt = MODE_CONFIG.roleplay.prompt + '\n\n' + tempData.data.prompt;
        
        const messages = [{ role: 'system', content: systemPrompt }];
        database.saveConversation(chatId, 'roleplay', messages);
        
        await this.bot.editMessageText(
            `[✓] 已加载角色：*${tempData.name}*\n\n` +
            `角色扮演模式已启动！请开始你们的第一句话或对话。`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );
        
        // 如果有初始消息，发送出去
        if (tempData.data.original && tempData.data.original.first_mes) {
            await this.bot.sendMessage(chatId, `_${tempData.name}说：_\n\n${tempData.data.original.first_mes}`, {
                parse_mode: 'Markdown'
            });
        }
    }
    
    async handleExportCharacter(chatId, messageId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData || !tempData.data.original) {
            await this.bot.editMessageText('[X] 没有找到角色数据', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        await this.bot.editMessageText('请选择导出格式：', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '[JSON] JSON格式', callback_data: 'export_json' },
                        { text: '[TXT] 文本格式', callback_data: 'export_txt' }
                    ],
                    [
                        { text: '<- 返回', callback_data: 'back_to_import' }
                    ]
                ]
            }
        });
    }
    
    async handleExportJSON(chatId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData || !tempData.data.original) {
            await this.bot.sendMessage(chatId, '[X] 没有找到角色数据');
            return;
        }
        
        const jsonContent = characterCardParser.exportToJSON(tempData.data.original);
        const buffer = Buffer.from(jsonContent, 'utf8');
        
        await this.bot.sendDocument(chatId, buffer, {
            caption: '[导出] JSON格式角色卡',
            filename: `${tempData.name.replace(/[/\\?%*:|"<>]/g, '-')}.json`
        }, {
            filename: `${tempData.name.replace(/[/\\?%*:|"<>]/g, '-')}.json`,
            contentType: 'application/json'
        });
    }
    
    async handleExportTXT(chatId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData || !tempData.data.original) {
            await this.bot.sendMessage(chatId, '[X] 没有找到角色数据');
            return;
        }
        
        const txtContent = characterCardParser.exportToTXT(tempData.data.original);
        const buffer = Buffer.from(txtContent, 'utf8');
        
        await this.bot.sendDocument(chatId, buffer, {
            caption: '[导出] TXT格式角色卡',
            filename: `${tempData.name.replace(/[/\\?%*:|"<>]/g, '-')}.txt`
        }, {
            filename: `${tempData.name.replace(/[/\\?%*:|"<>]/g, '-')}.txt`,
            contentType: 'text/plain'
        });
    }
    
    async handleBackToImport(chatId, messageId) {
        const tempData = this.stateManager.getTempCharacter(chatId);
        if (!tempData) {
            await this.bot.editMessageText('[X] 没有找到角色数据', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        await this.bot.editMessageText('请选择操作：', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '[保存] 保存到角色档案', callback_data: 'save_character' },
                        { text: '[使用] 立即使用该角色', callback_data: 'use_imported_character' }
                    ],
                    [
                        { text: '[导出] 导出为其他格式', callback_data: 'export_character' },
                        { text: '[X] 取消', callback_data: 'dismiss_save' }
                    ]
                ]
            }
        });
    }
}

module.exports = CharacterModule;
