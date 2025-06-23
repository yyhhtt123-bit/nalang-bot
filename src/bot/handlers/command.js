// bot/handlers/command.js
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const config = require('../../config');
const { MODE_CONFIG } = require('../../prompts');
const MainMenu = require('../menus/main');

class CommandHandler {
    constructor(bot, stateManager) {
        this.bot = bot;
        this.stateManager = stateManager;
        
        // 设置命令
        this.setupCommands();
    }
    
    async setupCommands() {
        const commands = [
            { command: 'start', description: '开始使用机器人' },
            { command: 'menu', description: '显示主菜单' },
            { command: 'reset', description: '重置当前对话' },
            { command: 'summon', description: '召唤角色 (用法: /summon 角色描述)' },
            { command: 'stats', description: '查看使用统计' },
            { command: 'memories', description: '查看AI的记忆' },
            { command: 'forget', description: '清除特定记忆' },
            { command: 'memory', description: '添加记忆 (用法: /memory 内容)' },
            { command: 'help', description: '获取帮助信息' }
        ];
        
        await this.bot.setMyCommands(commands).catch(err => {
            logger.error('Failed to set bot commands', { error: err.message });
        });
    }
    
    async handle(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const [command, ...args] = text.split(' ');
        const commandName = command.toLowerCase().replace('/', '');
        
        logger.info('Command received', {
            chatId,
            command: commandName,
            args: args.length
        });
        
        switch (commandName) {
            case 'start':
                await this.handleStart(chatId);
                break;
                
            case 'menu':
            case '菜单':
                await this.sendMainMenu(chatId);
                break;
                
            case 'reset':
                await this.handleReset(chatId);
                break;
                
            case 'summon':
                await this.handleSummon(chatId, args.join(' '));
                break;
                
            case 'stats':
                await this.handleStats(chatId);
                break;
                
            case 'memories':
                await this.handleShowMemories(chatId);
                break;
                
            case 'forget':
                await this.handleForget(chatId, args.join(' '));
                break;
                
            case 'memory':
                await this.handleMemory(chatId, args.join(' '));
                break;
                
            case 'help':
                await this.handleHelp(chatId);
                break;
                
            default:
                await this.bot.sendMessage(chatId, '[?] 未知命令。使用 /help 查看可用命令。');
        }
    }
    
    async handleStart(chatId) {
        const welcomeMessage = `
[机器人] *欢迎使用多模型 AI Bot！*

我是一个强大的AI助手，支持多种模型：

[模型] *支持的AI模型*
• NaLang-XL / Turbo
• Gemini 2.0/2.5 Flash
• Gemini Thinking
• Gemma 27B
• DeepSeek V3 / R1

[功能] *核心功能*
• 通用模式 - 日常AI助手
• 成人模式 - 更开放的内容
• 角色扮演 - 沉浸式角色互动
• 召唤大师 - 创造独特角色
• 忏悔室 - 特殊角色互动

使用 /menu 显示主菜单开始使用。
使用 /help 查看详细帮助。
        `;
        
        await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    }
    
    async sendMainMenu(chatId) {
        await MainMenu.send(this.bot, chatId);
    }
    
    async handleReset(chatId) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 您还没有选择任何模式。');
            return;
        }
        
        // 清除数据库中的对话
        database.deleteConversation(chatId, state.mode);
        
        // 重置状态
        this.stateManager.clearUserState(chatId);
        this.stateManager.clearActiveCharacter(chatId);
        
        // 询问是否要清除记忆
        const keyboard = {
            inline_keyboard: [[
                { text: '[是] 清除记忆', callback_data: 'reset_with_memories' },
                { text: '[否] 保留记忆', callback_data: 'reset_keep_memories' }
            ]]
        };
        
        await this.bot.sendMessage(chatId, '[✓] 对话已重置。\n\n是否要同时清除AI在该模式下的所有记忆？', {
            reply_markup: keyboard
        });
    }
    
    async handleSummon(chatId, prompt) {
        if (!prompt) {
            await this.bot.sendMessage(chatId, 
                '[!] 请提供召唤咒语。\n\n用法示例：\n`/summon 一位温柔的猫娘管家`',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        const sentMsg = await this.bot.sendMessage(chatId, '[*] 施法中...正在解析咒语...');
        
        try {
            const aiManager = require('../../services/aiManager');
            const messages = [
                { role: 'system', content: MODE_CONFIG.summon.prompt },
                { role: 'user', content: prompt }
            ];
            
            // 获取用户设置
            const userSettings = database.getUserSettings(chatId) || {
                model: 'nalang-xl',
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
            
            const response = await aiManager.chatComplete(messages, {
                mode: MODE_CONFIG.summon.apiMode,
                model: userSettings.model || 'nalang-xl',
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
            this.stateManager.setTempCharacter(chatId, {
                name: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
                data: {
                    prompt: prompt,
                    response: response,
                    systemPrompt: MODE_CONFIG.summon.prompt,
                    timestamp: new Date().toISOString()
                }
            });
            
            // 保存按钮
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
    
    async handleStats(chatId, fromMenu = false) {
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
        
        const keyboard = fromMenu ? {
            inline_keyboard: [[
                { text: '[菜单] 返回主菜单', callback_data: 'send_new_menu' }
            ]]
        } : undefined;
        
        await this.bot.sendMessage(chatId, statsMessage, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleShowMemories(chatId) {
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
        
        const typeNames = {
            character: '角色',
            location: '场景',
            item: '物品',
            event: '事件',
            relationship: '关系',
            bodyFeatures: '身体特征',
            clothing: '服装',
            actions: '动作',
            sensations: '感觉',
            roles: '角色关系',
            scenarios: '场景设定',
            fetishes: '特殊偏好',
            user_info: '用户信息',
            preference: '用户偏好',
            dislike: '用户厌恶',
            nickname: '昵称偏好',
            safeword: '安全词'
        };
        
        for (const [type, mems] of Object.entries(grouped)) {
            message += `*${typeNames[type] || type}：*\n`;
            mems.slice(0, 5).forEach(m => {
                const content = m.content.substring(0, 50);
                message += `• ${m.key_name}: ${content}${m.content.length > 50 ? '...' : ''}\n`;
            });
            if (mems.length > 5) {
                message += `  _...还有 ${mems.length - 5} 条${typeNames[type]}记忆_\n`;
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
    
    async handleForget(chatId, keywords) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 请先选择一个模式。');
            return;
        }
        
        if (!keywords) {
            await this.bot.sendMessage(chatId, '[!] 请提供要遗忘的关键词。\n\n用法：/forget 绿萝花');
            return;
        }
        
        const memories = database.getRelevantMemories(chatId, state.mode, keywords, 10);
        
        if (memories.length === 0) {
            await this.bot.sendMessage(chatId, `[记忆] 没有找到包含 "${keywords}" 的记忆。`);
            return;
        }
        
        let message = `[记忆] 找到以下相关记忆：\n\n`;
        const keyboard = {
            inline_keyboard: memories.map((m, index) => [{
                text: `${index + 1}. ${m.key_name.substring(0, 30)}`,
                callback_data: `forget_${m.id}`
            }]).concat([[
                { text: '[全部删除] 删除所有相关记忆', callback_data: `forget_all_${keywords}` },
                { text: '[取消] 取消', callback_data: 'cancel_forget' }
            ]])
        };
        
        memories.forEach((m, index) => {
            message += `${index + 1}. *${m.key_name}*\n   ${m.content.substring(0, 80)}...\n\n`;
        });
        
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleMemory(chatId, memoryContent) {
        const state = this.stateManager.getState(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 请先选择一个模式。使用 /menu 选择模式后再添加记忆。');
            return;
        }
        
        if (!memoryContent) {
            await this.bot.sendMessage(chatId, 
                '[!] 请提供要添加的记忆内容。\n\n' +
                '用法示例：\n' +
                '`/memory 我喜欢吃甜食，尤其是巧克力`\n' +
                '`/memory 绿萝花是我的生日礼物`\n' +
                '`/memory 我的安全词是红色`\n' +
                '`/memory 我喜欢温柔的抚摸`\n' +
                '`/memory 我害怕黑暗`',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        // 确定记忆类型
        let memoryType = 'user_info';
        let keyName = memoryContent.substring(0, 30) + (memoryContent.length > 30 ? '...' : '');
        
        if (memoryContent.includes('喜欢') || memoryContent.includes('偏好') || memoryContent.includes('喜爱')) {
            memoryType = 'preference';
            keyName = '用户偏好';
        } else if (memoryContent.includes('害怕') || memoryContent.includes('不喜欢') || memoryContent.includes('讨厌')) {
            memoryType = 'dislike';
            keyName = '用户厌恶';
        } else if (memoryContent.includes('叫我') || memoryContent.includes('称呼') || memoryContent.includes('昵称')) {
            memoryType = 'nickname';
            keyName = '昵称偏好';
        } else if (memoryContent.includes('安全词') || memoryContent.includes('停止词')) {
            memoryType = 'safeword';
            keyName = '安全词';
        }
        
        const memoryData = {
            memory_type: memoryType,
            key_name: keyName,
            content: memoryContent,
            context: '用户手动添加的记忆',
            importance: 1.0
        };
        
        const memoryId = database.saveUserMemory(chatId, state.mode, memoryData);
        
        if (memoryId) {
            await this.bot.sendMessage(chatId, 
                `[✓] 记忆已成功添加！\n\n` +
                `类型：_${memoryType}_\n` +
                `内容：_${memoryContent}_\n` +
                `模式：${this.getModeName(state.mode)}\n\n` +
                `AI会在后续对话中记住这条信息。`,
                { parse_mode: 'Markdown' }
            );
            
            logger.info('User memory added', { 
                chatId, 
                mode: state.mode, 
                memoryId,
                type: memoryType
            });
        } else {
            await this.bot.sendMessage(chatId, '[X] 添加记忆失败，请稍后重试。');
        }
    }
    
    async handleHelp(chatId) {
        const helpMessage = `
[帮助] *使用帮助*

*基本命令：*
/start - 开始使用机器人
/menu - 显示功能菜单
/reset - 重置当前对话
/summon <描述> - 召唤角色
/memories - 查看AI的记忆
/forget <关键词> - 删除特定记忆
/memory <内容> - 添加记忆，让AI记住重要信息
/stats - 查看使用统计
/help - 显示该帮助

*支持的AI模型：*
• *NaLang-XL* - 功能全面，推荐使用
• *NaLang-Turbo* - 响应更快
• *Gemini 2.0/2.5 Flash* - Google最新模型
• *Gemini Thinking* - 深度思考模型
• *Gemma 27B* - 开源强大模型
• *DeepSeek V3* - 最新深度搜索模型
• *DeepSeek R1* - 推理增强版本

*功能说明：*
• *通用模式*：标准AI助手，适合日常对话
• *成人模式*：更开放内容模式（仅限成年人）
• *角色扮演*：AI扮演指定的所有NPC
• *忏悔室*：特殊的角色扮演互动
• *档案*：保存召唤的角色和故事
• *设置*：自定义参数和切换模型
• *AI记忆*：AI会自动记住重要信息

*角色卡导入：*
• 支持 JSON、TXT、PNG 格式
• 直接发送角色卡文件即可开始
• 兼容 SillyTavern 格式

*一键添加记忆：*
• 使用 /memory 可以手动新增重要信息
• 手动添加的记忆优先级最高，不会被遗忘
• 示例：
  - /memory 我喜欢吃甜食，尤其是巧克力
  - /memory 绿萝花是我的生日礼物
  - /memory 我的安全词是红色
  - /memory 我喜欢温柔的抚摸

*使用技巧：*
• 每个模式都有独立的对话历史和记忆
• 使用 /reset 可以清除当前模式的历史
• AI会自动记住角色、场景、事件等重要信息
• 记忆会影响后续对话，让互动更连贯
• 手动添加的记忆永久有效，优先级最高

*隐私安全：*
您的对话历史会被保存30天，并自动删除。

如有疑问，请联系管理员。
        `;
        
        await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
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

module.exports = CommandHandler;
