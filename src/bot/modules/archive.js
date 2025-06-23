// bot/modules/archive.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const { MODE_CONFIG } = require('../../prompts');

class ArchiveModule {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
    }
    
    async showCharacterArchives(chatId, messageId) {
        const characters = database.getCharacters(chatId);
        
        if (characters.length === 0) {
            await this.bot.editMessageText('[空] 暂无人物档案\n\n使用 /summon 召唤角色后可以保存到这里', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '<- 返回', callback_data: 'show_archives' }
                    ]]
                }
            });
            return;
        }
        
        const keyboard = {
            inline_keyboard: characters.map((char, index) => [{
                text: `${index + 1}. ${char.character_name}`,
                callback_data: `load_char_${char.id}`
            }]).concat([[
                { text: '<- 返回', callback_data: 'show_archives' }
            ]])
        };
        
        await this.bot.editMessageText(`[人物] 人物档案列表 (${characters.length}/10)：`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    async showStoryArchives(chatId, messageId) {
        const stories = database.getStories(chatId);
        
        if (stories.length === 0) {
            await this.bot.editMessageText('[空] 暂无故事档案\n\n在角色扮演模式中的对话可以保存到这里', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '<- 返回', callback_data: 'show_archives' }
                    ]]
                }
            });
            return;
        }
        
        const keyboard = {
            inline_keyboard: stories.map((story, index) => [{
                text: `${index + 1}. ${story.story_title}`,
                callback_data: `load_story_${story.id}`
            }]).concat([[
                { text: '<- 返回', callback_data: 'show_archives' }
            ]])
        };
        
        await this.bot.editMessageText(`[故事] 故事档案列表 (${stories.length}/10)：`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    async handleLoadCharacter(chatId, messageId, data) {
        const characterId = parseInt(data.replace('load_char_', ''));
        const character = database.getCharacter(chatId, characterId);
        
        if (!character) {
            await this.bot.editMessageText('[X] 角色不存在', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const characterInfo = `
*${character.character_name}*

${character.character_data.response}

_创建时间: ${new Date(character.created_at).toLocaleString('zh-CN')}_
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '[角色] 使用该角色进行角色扮演', callback_data: `use_char_${characterId}` }],
                [{ text: '[删除] 删除该角色', callback_data: `del_char_${characterId}` }],
                [{ text: '<- 返回列表', callback_data: 'char_archives' }]
            ]
        };
        
        await this.bot.editMessageText(characterInfo, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleLoadStory(chatId, messageId, data) {
        const storyId = parseInt(data.replace('load_story_', ''));
        const story = database.getStory(chatId, storyId);
        
        if (!story) {
            await this.bot.editMessageText('[X] 故事不存在', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const messageCount = story.messages.length;
        const lastMessage = story.messages[story.messages.length - 1];
        
        const storyInfo = `
*${story.story_title}*

消息数量：${messageCount}条
创建时间：${new Date(story.created_at).toLocaleString('zh-CN')}
最后更新：${new Date(story.updated_at).toLocaleString('zh-CN')}
${story.character_name ? `关联角色：${story.character_name}` : ''}

最后一条消息预览：
_${lastMessage.content.substring(0, 200)}${lastMessage.content.length > 200 ? '...' : ''}_
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '[故事] 加载并继续这个故事', callback_data: `continue_story_${storyId}` }],
                [{ text: '[删除] 删除该故事', callback_data: `del_story_${storyId}` }],
                [{ text: '<- 返回列表', callback_data: 'story_archives' }]
            ]
        };
        
        await this.bot.editMessageText(storyInfo, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleUseCharacter(chatId, messageId, data) {
        const characterId = parseInt(data.replace('use_char_', ''));
        const character = database.getCharacter(chatId, characterId);
        
        if (!character) {
            await this.bot.editMessageText('[X] 角色不存在', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        // 设置为角色扮演模式
        this.stateManager.setState(chatId, { mode: 'roleplay', isProcessing: false });
        
        // 存储当前使用的角色
        this.stateManager.setActiveCharacter(chatId, {
            id: characterId,
            name: character.character_name,
            data: character.character_data
        });
        
        // 创建新的对话，包含角色信息
        const systemPrompt = MODE_CONFIG.roleplay.prompt + '\n\n' + 
            `当前角色设定：\n${character.character_data.response}`;
        
        const messages = [{ role: 'system', content: systemPrompt }];
        database.saveConversation(chatId, 'roleplay', messages);
        
        await this.bot.editMessageText(
            `[✓] 已加载角色：*${character.character_name}*\n\n` +
            `角色扮演模式已激活！请开始你们的第一句话或对话。`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );
        
        // 提供保存故事的选项
        const keyboard = {
            inline_keyboard: [[
                { text: '[保存] 保存当前故事', callback_data: 'save_story' }
            ]]
        };
        
        await this.bot.sendMessage(chatId, '提示：您可以随时保存当前的故事进度', {
            reply_markup: keyboard
        });
    }
    
    async handleContinueStory(chatId, messageId, data) {
        const storyId = parseInt(data.replace('continue_story_', ''));
        const story = database.getStory(chatId, storyId);
        
        if (!story) {
            await this.bot.editMessageText('[X] 故事不存在', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        // 恢复模式和对话历史
        this.stateManager.setState(chatId, { mode: story.mode, isProcessing: false });
        database.saveConversation(chatId, story.mode, story.messages);
        
        // 如果故事关联了角色，也恢复角色
        if (story.character_id) {
            const character = database.getCharacter(chatId, story.character_id);
            if (character) {
                this.stateManager.setActiveCharacter(chatId, {
                    id: story.character_id,
                    name: character.character_name,
                    data: character.character_data
                });
            }
        }
        
        await this.bot.editMessageText(
            `[✓] 已加载故事：*${story.story_title}*\n\n` +
            `您可以继续之前的对话了。`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );
        
        // 显示最近几条对话作为回顾
        const recentMessages = story.messages.slice(-3).filter(m => m.role !== 'system');
        if (recentMessages.length > 0) {
            let recap = '[回顾] 最近的对话：\n\n';
            
            for (const msg of recentMessages) {
                if (msg.role === 'user') {
                    recap += `你: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n\n`;
                } else if (msg.role === 'assistant') {
                    recap += `AI: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n\n`;
                }
            }
            
            await this.bot.sendMessage(chatId, recap);
        }
        
        // 提供保存按钮
        const keyboard = {
            inline_keyboard: [[
                { text: '[保存] 保存当前故事', callback_data: 'save_story' }
            ]]
        };
        
        await this.bot.sendMessage(chatId, '提示：您可以随时保存当前的故事进度', {
            reply_markup: keyboard
        });
    }
    
    async handleDeleteCharacter(chatId, messageId, data, query) {
        const characterId = parseInt(data.replace('del_char_', ''));
        const success = database.deleteCharacter(chatId, characterId);
        
        if (success) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[✓] 角色已删除',
                show_alert: true
            });
            await this.showCharacterArchives(chatId, messageId);
        } else {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[X] 删除失败',
                show_alert: true
            });
        }
    }
    
    async handleDeleteStory(chatId, messageId, data, query) {
        const storyId = parseInt(data.replace('del_story_', ''));
        const success = database.deleteStory(chatId, storyId);
        
        if (success) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[✓] 故事已删除',
                show_alert: true
            });
            await this.showStoryArchives(chatId, messageId);
        } else {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[X] 删除失败',
                show_alert: true
            });
        }
    }
    
    async handleSaveStory(chatId, messageId, query) {
        const state = this.stateManager.getState(chatId);
        if (!state || state.mode !== 'roleplay') {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[X] 只能在角色扮演模式下保存故事',
                show_alert: true
            });
            return;
        }
        
        const messages = database.getConversation(chatId, 'roleplay');
        if (!messages || messages.length <= 1) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '[X] 还没有故事内容可以保存',
                show_alert: true
            });
            return;
        }
        
        // 获取当前使用的角色
        const activeCharacter = this.stateManager.getActiveCharacter(chatId);
        const characterId = activeCharacter?.id || null;
        
        // 生成故事标题
        const firstUserMessage = messages.find(m => m.role === 'user');
        const storyTitle = firstUserMessage 
            ? firstUserMessage.content.substring(0, 30) + '...'
            : '未命名故事';
        
        const storyId = database.saveStory(
            chatId,
            storyTitle,
            characterId,
            messages,
            'roleplay'
        );
        
        if (storyId) {
            let successMsg = '[✓] 故事已保存到档案！';
            if (activeCharacter) {
                successMsg += `\n关联角色：${activeCharacter.name}`;
            }
            successMsg += '\n\n您可以随时从档案中加载继续。';
            
            await this.bot.sendMessage(chatId, successMsg);
        } else {
            await this.bot.sendMessage(chatId, '[X] 保存失败，请稍后重试');
        }
    }
}

module.exports = ArchiveModule;
