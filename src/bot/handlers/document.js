// bot/handlers/document.js
const logger = require('../../utils/logger');
const config = require('../../config');
const characterCardParser = require('../../services/characterCardParser');
const path = require('path');
const fetch = require('node-fetch');

class DocumentHandler {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async handle(msg) {
        const chatId = msg.chat.id;
        const document = msg.document;
        
        // 只处理特定格式的文件
        const fileName = document.file_name;
        const ext = path.extname(fileName).toLowerCase();
        
        if (!['.json', '.txt', '.png'].includes(ext)) {
            await this.bot.sendMessage(chatId, '[!] 不支持的文件格式。请上传 JSON、TXT 或 PNG 格式的角色卡。');
            return;
        }
        
        if (document.file_size > 10 * 1024 * 1024) {
            await this.bot.sendMessage(chatId, '[!] 文件太大，请上传小于10MB的文件。');
            return;
        }
        
        await this.processCharacterCard(chatId, document, fileName);
    }
    
    async processCharacterCard(chatId, document, fileName) {
        const sentMsg = await this.bot.sendMessage(chatId, '[*] 正在解析角色卡...');
        
        try {
            // 下载文件
            const file = await this.bot.getFile(document.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
            
            const response = await fetch(fileUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            
            // 解析角色卡
            const character = await characterCardParser.parseCharacterCard(buffer, fileName);
            
            // 生成预览
            let preview = `[角色卡] *${character.name}*\n\n`;
            if (character.description) preview += `*描述：*\n${character.description}\n\n`;
            if (character.personality) preview += `*性格：*\n${character.personality}\n\n`;
            if (character.scenario) preview += `*场景：*\n${character.scenario}\n\n`;
            if (character.tags.length > 0) preview += `*标签：*\n${character.tags.join('、')}\n\n`;
            if (character.nsfw) preview += `_⚠️ 包含成人内容_\n\n`;
            
            await this.bot.editMessageText(preview, {
                chat_id: chatId,
                message_id: sentMsg.message_id,
                parse_mode: 'Markdown'
            });
            
            // 临时存储角色数据
            this.stateManager.setTempCharacter(chatId, {
                name: character.name,
                data: {
                    prompt: characterCardParser.generateCharacterPrompt(character),
                    response: preview,
                    original: character,
                    systemPrompt: require('../../prompts').MODE_CONFIG.summon.prompt,
                    timestamp: new Date().toISOString()
                }
            });
            
            // 提供操作选项
            const keyboard = {
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
            };
            
            await this.bot.sendMessage(chatId, '请选择操作：', {
                reply_markup: keyboard
            });
            
        } catch (error) {
            logger.error('Document processing error', { chatId, error: error.message });
            await this.bot.editMessageText('[X] 解析角色卡失败：' + error.message, {
                chat_id: chatId,
                message_id: sentMsg.message_id
            });
        }
    }
}

module.exports = DocumentHandler;
