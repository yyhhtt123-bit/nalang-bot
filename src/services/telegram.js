const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const database = require('../utils/database');
const aiManager = require('./aiManager'); // 改为使用 AI 管理器
const memoryExtractor = require('./memoryExtractor');
const characterCardParser = require('./characterCardParser');
const config = require('../config');
const { MODE_CONFIG } = require('../prompts');
const path = require('path');
const fetch = require('node-fetch');

class TelegramBotService {
    constructor() {
        this.bot = new TelegramBot(config.telegram.token, { 
            polling: {
                interval: 300,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });
        
        // 用户状态管理
        this.userStates = new Map();
        
        // 临时存储召唤的角色
        this.tempCharacterData = new Map();
        
        // 当前正在使用的角色
        this.activeCharacters = new Map();
        
        // 设置命令
        this.setupCommands();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        logger.info('Telegram bot service initialized');
    }
    
    setupCommands() {
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
        
        this.bot.setMyCommands(commands).catch(err => {
            logger.error('Failed to set bot commands', { error: err.message });
        });
    }
    
    setupEventListeners() {
        // 消息处理
        this.bot.on('message', this.handleMessage.bind(this));
        
        // 文档处理（用于角色卡导入）
        this.bot.on('document', this.handleDocument.bind(this));
        
        // 回调查询处理
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        
        // 错误处理
        this.bot.on('polling_error', (error) => {
            logger.error('Telegram polling error', { error: error.message });
        });
        
        // 定期清理
        setInterval(() => {
            database.cleanup(30);
        }, 24 * 60 * 60 * 1000);
    }
    
    // 修正的 getUserSettings 方法
getUserSettings(chatId) {
    const settings = database.getUserSettings(chatId) || {
        model: 'nalang-xl',
        contextWindow: 4096,
        maxTokens: 1500,
        temperature: 0.7
    };
    
    // 删除或注释掉 modelFixes 部分
    /*
    const modelFixes = {
        'gemini-2.5-flash': 'models/gemini-2.5-flash',
        'gemini-2.0-flash': 'models/gemini-2.0-flash',
        'gemini-thinking': 'models/gemini-2.0-flash-thinking-exp',
        'gemma-27b': 'models/gemma-3-27b-it',
        'deepseek-chat': 'deepseek-v3',
        'deepseek-coder': 'deepseek-v3'
    };
    
    if (modelFixes[settings.model]) {
        settings.model = modelFixes[settings.model];
        database.saveUserSettings(chatId, settings);
    }
    */
    
    return settings;
}
    
    // 处理文档上传（角色卡导入）
    async handleDocument(msg) {
        const chatId = msg.chat.id;
        const document = msg.document;
        
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
        
        const sentMsg = await this.bot.sendMessage(chatId, '[*] 正在解析角色卡...');
        
        try {
            const file = await this.bot.getFile(document.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
            
            const response = await fetch(fileUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            
            const character = await characterCardParser.parseCharacterCard(buffer, fileName);
            
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
            
            this.tempCharacterData.set(chatId, {
                name: character.name,
                data: {
                    prompt: characterCardParser.generateCharacterPrompt(character),
                    response: preview,
                    original: character,
                    systemPrompt: MODE_CONFIG.summon.prompt,
                    timestamp: new Date().toISOString()
                }
            });
            
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
    
    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text?.trim();
        
        if (!text) return;
        
        logger.info('Message received', {
            chatId,
            userId,
            username: msg.from.username,
            text: text.substring(0, 50)
        });
        
        try {
            if (text.startsWith('/')) {
                await this.handleCommand(msg);
            } else {
                await this.handleChat(msg);
            }
            
        } catch (error) {
            logger.error('Error handling message', {
                chatId,
                error: error.message,
                stack: error.stack
            });
            await this.bot.sendMessage(chatId, '[错误] 处理消息时出错，请稍后重试。');
        }
    }
    
    async handleCommand(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const [command, ...args] = text.split(' ');
        const commandName = command.toLowerCase().replace('/', '');
        
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
    
    async handleMemory(chatId, memoryContent) {
        const state = this.userStates.get(chatId);
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
        } else if (memoryContent.includes('是我的') || memoryContent.includes('关系')) {
            memoryType = 'relationship';
            keyName = '关系定义';
        } else if (memoryContent.includes('喜欢') && (memoryContent.includes('被') || memoryContent.includes('抚摸') || memoryContent.includes('触碰'))) {
            memoryType = 'fetish';
            keyName = '特殊偏好';
        } else if (memoryContent.includes('敏感') || memoryContent.includes('弱点')) {
            memoryType = 'sensitive';
            keyName = '敏感部位';
        } else if (memoryContent.includes('兴奋') || memoryContent.includes('刺激')) {
            memoryType = 'excitement_trigger';
            keyName = '兴奋点';
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
                type: memoryType,
                content: memoryContent.substring(0, 50) 
            });
        } else {
            await this.bot.sendMessage(chatId, '[X] 添加记忆失败，请稍后重试。');
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
    
    async sendMainMenu(chatId, messageId = null) {
        const menuText = "[主菜单] 请选择您要使用的功能：";
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '[通用] 通用模式', callback_data: 'mode_general' },
                    { text: '[成人] 成人模式', callback_data: 'mode_adult' }
                ],
                [
                    { text: '[角色] 角色扮演', callback_data: 'mode_roleplay' },
                    { text: '[忏悔] 忏悔室', callback_data: 'mode_confession' }
                ],
                [
                    { text: '[档案] 档案', callback_data: 'show_archives' },
                    { text: '[设置] 设置', callback_data: 'show_settings' }
                ],
                [
                    { text: '[记忆] AI记忆', callback_data: 'show_memories' },
                    { text: '[统计] 使用统计', callback_data: 'show_stats' }
                ]
            ]
        };
        
        if (messageId) {
            await this.bot.editMessageText(menuText, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });
        } else {
            await this.bot.sendMessage(chatId, menuText, {
                reply_markup: keyboard
            });
        }
    }
    
    async handleReset(chatId) {
        const state = this.userStates.get(chatId);
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, '[!] 您还没有选择任何模式。');
            return;
        }
        
        // 清除数据库中的对话
        database.deleteConversation(chatId, state.mode);
        
        // 重置状态
        this.userStates.delete(chatId);
        this.activeCharacters.delete(chatId);
        
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
            const messages = [
                { role: 'system', content: MODE_CONFIG.summon.prompt },
                { role: 'user', content: prompt }
            ];
            
            // 获取用户设置 - 修正：使用 this.getUserSettings
            const userSettings = this.getUserSettings(chatId);
            
            const response = await aiManager.chatComplete(messages, {
                mode: MODE_CONFIG.summon.apiMode,
                model: userSettings.model || 'nalang-xl',
                maxTokens: MODE_CONFIG.summon.maxTokens,
                temperature: MODE_CONFIG.summon.temperature
            });
            
            // 检查响应是否为空
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
            
            // 新增保存按钮
            const keyboard = {
                inline_keyboard: [[
                    { text: '[保存] 保存到人物档案', callback_data: 'save_character' },
                    { text: '[X] 不保存', callback_data: 'dismiss_save' }
                ]]
            };
            
            await this.bot.sendMessage(chatId, '是否要保存这个角色到档案？', {
                reply_markup: keyboard
            });
            
            // 记录使用
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
        
        // 新增记忆统计
        const state = this.userStates.get(chatId);
        if (state?.mode) {
            const memoryCount = database.getMemoryCount(chatId, state.mode);
            statsMessage += `\n[记忆] 当前模式记忆数：${memoryCount}`;
        }
        
        // 如果是从菜单来的，提供返回按钮
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
    
    // 显示记忆
    async handleShowMemories(chatId) {
        const state = this.userStates.get(chatId);
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
    
    // 遗忘特定记忆
    async handleForget(chatId, keywords) {
        const state = this.userStates.get(chatId);
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
        
        // 显示找到的记忆，让用户选择要删除的
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
    
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        
        await this.bot.answerCallbackQuery(query.id);
        
        logger.info('Callback query', { chatId, data });
        
        try {
            if (data.startsWith('mode_')) {
                await this.handleModeSelection(chatId, messageId, data.replace('mode_', ''));
            } else if (data === 'show_stats') {
                await this.handleStats(chatId, true);
            } else if (data === 'send_new_menu') {
                await this.sendMainMenu(chatId);
            } else if (data === 'show_settings') {
                await this.showSettingsMenu(chatId, messageId);
            } else if (data === 'show_archives') {
                await this.showArchivesMenu(chatId, messageId);
            } else if (data === 'show_memories') {
                await this.handleShowMemories(chatId);
            } else if (data === 'char_archives') {
                await this.showCharacterArchives(chatId, messageId);
            } else if (data === 'story_archives') {
                await this.showStoryArchives(chatId, messageId);
            } else if (data === 'model') {
                await this.handleSettingSelection(chatId, messageId, 'model');
            } else if (data === 'model_nalang') {
                await this.showNalangModelsMenu(chatId, messageId);
            } else if (data === 'model_gemini') {
                await this.showGeminiModelsMenu(chatId, messageId);
            } else if (data === 'model_deepseek') {
                await this.showDeepseekModelsMenu(chatId, messageId);
            } else if (data.startsWith('set_model_')) {
                await this.handleModelSelection(chatId, messageId, data, query);
            } else if (data.startsWith('setting_')) {
                await this.handleSettingSelection(chatId, messageId, data.replace('setting_', ''));
            } else if (data.startsWith('set_')) {
                await this.handleSettingValue(chatId, messageId, data, query);
            } else if (data === 'back_to_menu') {
                await this.sendMainMenu(chatId, messageId);
            } else if (data === 'save_character') {
                await this.handleSaveCharacter(chatId, messageId);
            } else if (data === 'dismiss_save') {
                await this.handleDismissSave(chatId, messageId);
            } else if (data === 'save_story') {
                await this.handleSaveStory(chatId, messageId, query);
            } else if (data.startsWith('load_char_')) {
                await this.handleLoadCharacter(chatId, messageId, data);
            } else if (data.startsWith('load_story_')) {
                await this.handleLoadStory(chatId, messageId, data);
            } else if (data.startsWith('use_char_')) {
                await this.handleUseCharacter(chatId, messageId, data);
            } else if (data.startsWith('continue_story_')) {
                await this.handleContinueStory(chatId, messageId, data);
            } else if (data.startsWith('del_char_')) {
                await this.handleDeleteCharacter(chatId, messageId, data, query);
            } else if (data.startsWith('del_story_')) {
                await this.handleDeleteStory(chatId, messageId, data, query);
            } else if (data === 'clear_all_memories') {
                await this.handleClearAllMemories(chatId, query);
            } else if (data === 'reset_with_memories') {
                await this.handleResetWithMemories(chatId);
            } else if (data === 'reset_keep_memories') {
                await this.bot.sendMessage(chatId, '[✓] 对话已重置，记忆已保留。请使用 /menu 重新选择模式。');
            } else if (data.startsWith('forget_')) {
                await this.handleForgetMemory(chatId, data, query);
            } else if (data === 'cancel_forget') {
                await this.bot.sendMessage(chatId, '[取消] 已取消删除记忆。');
            } else if (data === 'export_memories') {
                await this.handleExportMemories(chatId);
            } else if (data === 'use_imported_character') {
                await this.handleUseImportedCharacter(chatId, messageId);
            } else if (data === 'export_character') {
                await this.handleExportCharacter(chatId, messageId);
            } else if (data === 'export_json') {
                await this.handleExportJSON(chatId);
            } else if (data === 'export_txt') {
                await this.handleExportTXT(chatId);
            } else if (data === 'back_to_import') {
                await this.handleBackToImport(chatId, messageId);
            } else if (data === 'close') {
                await this.bot.deleteMessage(chatId, messageId);
            } else if (data === 'back_to_model_menu') {
                await this.handleSettingSelection(chatId, messageId, 'model');
            }
        } catch (error) {
            logger.error('Callback query error', { chatId, data, error: error.message });
        }
    }
    
    // 显示 NaLang 模型菜单
    async showNalangModelsMenu(chatId, messageId) {
        const text = '[NaLang] 选择模型：';
        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'NaLang-XL (推荐)', callback_data: 'set_model_nalang-xl' }
                ],
                [
                    { text: 'NaLang-Turbo', callback_data: 'set_model_nalang-turbo' }
                ],
                [
                    { text: '<- 返回', callback_data: 'back_to_model_menu' },
                    { text: '关闭', callback_data: 'close' }
                ]
            ]
        };
        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    // 显示 Gemini 模型菜单
    async showGeminiModelsMenu(chatId, messageId) {
        const text = '[Gemini] 选择模型：';
        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Gemini 2.0 Flash', callback_data: 'set_model_models/gemini-2.0-flash' }
                ],
                [
                    { text: 'Gemini 2.5 Flash', callback_data: 'set_model_models/gemini-2.5-flash' }
                ],
                [
                    { text: 'Gemini Thinking', callback_data: 'set_model_models/gemini-2.0-flash-thinking-exp' }
                ],
                [
                    { text: 'Gemma 27B', callback_data: 'set_model_models/gemma-3-27b-it' }
                ],
                [
                    { text: '<- 返回', callback_data: 'back_to_model_menu' },
                    { text: '关闭', callback_data: 'close' }
                ]
            ]
        };
        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    // 显示 DeepSeek 模型菜单
    async showDeepseekModelsMenu(chatId, messageId) {
    const text = '[DeepSeek] 选择模型：';
    const keyboard = {
        inline_keyboard: [
            [
                { text: 'DeepSeek V3', callback_data: 'set_model_deepseek-v3' }  // 修改这里
            ],
            [
                { text: 'DeepSeek R1', callback_data: 'set_model_deepseek-r1' }  // 修改这里
            ],
            [
                { text: '<- 返回', callback_data: 'back_to_model_menu' },
                { text: '关闭', callback_data: 'close' }
            ]
        ]
    };
    await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard
    });
}    
    // 处理模型选择
    async handleModelSelection(chatId, messageId, data, query) {
        const modelMap = {
    'set_model_nalang-xl': 'nalang-xl',
    'set_model_nalang-turbo': 'nalang-turbo',
    'set_model_models/gemini-2.0-flash': 'models/gemini-2.0-flash',
    'set_model_models/gemini-2.5-flash': 'models/gemini-2.5-flash',
    'set_model_models/gemini-2.0-flash-thinking-exp': 'models/gemini-2.0-flash-thinking-exp',
    'set_model_models/gemma-3-27b-it': 'models/gemma-3-27b-it',
    'set_model_deepseek-v3': 'deepseek-v3',  // 修改这里
    'set_model_deepseek-r1': 'deepseek-r1'   // 修改这里
};
        
        const model = modelMap[data];
        if (model) {
            const settings = this.getUserSettings(chatId);
            settings.model = model;
            database.saveUserSettings(chatId, settings);
            
            const displayName = aiManager.getModelDisplayName(model);
            
            await this.bot.answerCallbackQuery(query.id, {
                text: `✓ 已切换到 ${displayName}`,
                show_alert: true
            });
            
            await this.bot.deleteMessage(chatId, messageId);
            
            const newMsg = await this.bot.sendMessage(chatId, '正在更新设置...');
            await this.showSettingsMenu(chatId, newMsg.message_id);
        }
    }
    
    // 使用导入的角色
    async handleUseImportedCharacter(chatId, messageId) {
        const tempData = this.tempCharacterData.get(chatId);
        if (!tempData) {
            await this.bot.editMessageText('[X] 没有找到角色数据', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        // 设置为角色扮演模式
        this.userStates.set(chatId, { mode: 'roleplay', isProcessing: false });
        
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
    
    // 导出角色选项
    async handleExportCharacter(chatId, messageId) {
        const tempData = this.tempCharacterData.get(chatId);
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
    
    // 导出为JSON
    async handleExportJSON(chatId) {
        const tempData = this.tempCharacterData.get(chatId);
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
    
    // 导出为TXT
    async handleExportTXT(chatId) {
        const tempData = this.tempCharacterData.get(chatId);
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
    
    // 返回导入界面
    async handleBackToImport(chatId, messageId) {
        const tempData = this.tempCharacterData.get(chatId);
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
    
    // 清空所有记忆
    async handleClearAllMemories(chatId, query) {
        const state = this.userStates.get(chatId);
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
    
    // 重置并清除记忆 - 修复此方法
    async handleResetWithMemories(chatId) {
        const state = this.userStates.get(chatId);
        if (state?.mode) {
            // 清除该模式下的所有记忆
            const deletedCount = database.deleteAllMemories(chatId, state.mode);
            logger.info('Memories cleared on reset', { chatId, mode: state.mode, deletedCount });
        }
        await this.bot.sendMessage(chatId, '[✓] 对话和记忆都已重置。请使用 /menu 重新选择模式。');
    }
    
    // 删除特定记忆
    async handleForgetMemory(chatId, data, query) {
        const state = this.userStates.get(chatId);
        
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
    
    // 导出记忆
    async handleExportMemories(chatId) {
        const state = this.userStates.get(chatId);
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
            exportText += `\n【${type}】\n`;
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
    
    // 修改后的 handleChat 方法（使用 aiManager）
    async handleChat(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const state = this.userStates.get(chatId);
        
        if (!state?.mode) {
            await this.bot.sendMessage(chatId, 
                '请先选择一个模式。使用 /menu 显示主菜单。',
                { reply_to_message_id: msg.message_id }
            );
            return;
        }
        
        // 防止并发处理
        if (state.isProcessing) {
            await this.bot.sendMessage(chatId, 
                '... 正在处理上一条消息，请稍候...',
                { reply_to_message_id: msg.message_id }
            );
            return;
        }
        
        state.isProcessing = true;
        
        const sentMsg = await this.bot.sendMessage(chatId, '... 正在思考...', {
            reply_to_message_id: msg.message_id
        });
        
        try {
            // 获取用户设置 - 修正：使用 this.getUserSettings
            const userSettings = this.getUserSettings(chatId);
            
            // 获取对话历史
            let messages = database.getConversation(chatId, state.mode) || 
                           [{ role: 'system', content: MODE_CONFIG[state.mode].prompt }];
            
            // 搜索相关记忆并加入到系统提示
            const relevantMemories = database.getRelevantMemories(chatId, state.mode, text, 10);
            
            let finalSystemPrompt = MODE_CONFIG[state.mode].prompt;
            
            if (relevantMemories.length > 0) {
                const memoryContext = this.formatMemoriesForContext(relevantMemories);
                finalSystemPrompt += '\n\n' + memoryContext;
            }
            
            // 更新系统提示
            messages[0] = {
                role: 'system',
                content: finalSystemPrompt
            };
            
            // 新增用户消息
            messages.push({ role: 'user', content: text });
            
            // 限制对话长度（基于用户设置的上下文窗口）
            const maxMessages = Math.floor(userSettings.contextWindow / 100);
            if (messages.length > maxMessages) {
                const systemMessage = messages[0];
                messages = [systemMessage, ...messages.slice(-(maxMessages - 1))];
            }
            
            // 获取AI响应（使用 aiManager）
            let fullResponse = '';
            const response = await aiManager.chat(messages, {
                mode: MODE_CONFIG[state.mode].apiMode,
                model: userSettings.model || 'nalang-xl',
                maxTokens: userSettings.maxTokens || MODE_CONFIG[state.mode].maxTokens,
                temperature: userSettings.temperature || MODE_CONFIG[state.mode].temperature,
                stream: true
            });
            
            // 流式更新消息
            let lastUpdate = Date.now();
            
            // 根据不同的AI提供商处理流式响应
            const provider = aiManager.modelProviders[userSettings.model || 'nalang-xl'];
            const client = aiManager.clients[userSettings.model || 'nalang-xl'];
            
            if (provider === 'gemini') {
                // Gemini 不支持真正的流式响应，直接获取完整响应
                fullResponse = await client.chatComplete(messages, {
                    mode: MODE_CONFIG[state.mode].apiMode,
                    model: userSettings.model,
                    maxTokens: userSettings.maxTokens || MODE_CONFIG[state.mode].maxTokens,
                    temperature: userSettings.temperature || MODE_CONFIG[state.mode].temperature
                });
                
                await this.bot.editMessageText(fullResponse, {
                    chat_id: chatId,
                    message_id: sentMsg.message_id,
                    parse_mode: 'Markdown'
                });
            } else {
                // NaLang 和 Chutes 支持流式响应
                for await (const chunk of client.processStream(response)) {
                    fullResponse += chunk;
                    
                    // 每300ms更新一次消息，避免过于频繁
                    if (Date.now() - lastUpdate > 300 && fullResponse.trim()) {
                        await this.bot.editMessageText(fullResponse + '|', {
                            chat_id: chatId,
                            message_id: sentMsg.message_id,
                            parse_mode: 'Markdown'
                        }).catch(() => {});
                        lastUpdate = Date.now();
                    }
                }
                
                // 发送最终消息
                await this.bot.editMessageText(fullResponse, {
                    chat_id: chatId,
                    message_id: sentMsg.message_id,
                    parse_mode: 'Markdown'
                });
            }
            
            // 检查最终响应是否为空
            if (!fullResponse || fullResponse.trim() === '') {
                throw new Error('AI响应为空');
            }
            
            // 提取并保存记忆（延迟调用，不阻塞响应）
            this.extractAndSaveMemories(chatId, state.mode, fullResponse, text);
            
            // 保存对话历史
            messages[0].content = MODE_CONFIG[state.mode].prompt;
            messages.push({ role: 'assistant', content: fullResponse });
            database.saveConversation(chatId, state.mode, messages);
            
            // 记录使用统计
            const estimatedTokens = aiManager.estimateTokens(text + fullResponse);
            database.recordUsage(chatId, state.mode, estimatedTokens);
            
        } catch (error) {
            logger.error('Chat processing error', {
                chatId,
                mode: state.mode,
                error: error.message
            });
            
            await this.bot.editMessageText(
                '[X] 处理请求时出错。请稍后重试或使用 /reset 重置对话。',
                {
                    chat_id: chatId,
                    message_id: sentMsg.message_id
                }
            );
        } finally {
            state.isProcessing = false;
        }
    }
    
    // 格式化记忆为上下文
    formatMemoriesForContext(memories) {
        const memoryLines = ['[相关记忆信息]'];
        
        // 按类型分组
        const grouped = {};
        memories.forEach(memory => {
            if (!grouped[memory.memory_type]) {
                grouped[memory.memory_type] = [];
            }
            grouped[memory.memory_type].push(memory);
        });
        
        // 格式化每种类型的记忆
        const typeFormatters = {
            character: (mems) => {
                memoryLines.push('\n已知角色：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            location: (mems) => {
                memoryLines.push('\n已知场景：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            item: (mems) => {
                memoryLines.push('\n已知物品：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            event: (mems) => {
                memoryLines.push('\n重要事件：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            relationship: (mems) => {
                memoryLines.push('\n关系信息：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            bodyFeatures: (mems) => {
                memoryLines.push('\n身体特征：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            clothing: (mems) => {
                memoryLines.push('\n服装信息：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            actions: (mems) => {
                memoryLines.push('\n已知动作/反应：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            sensations: (mems) => {
                memoryLines.push('\n感觉/感受：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            roles: (mems) => {
                memoryLines.push('\n角色关系：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            },
            scenarios: (mems) => {
                memoryLines.push('\n场景/设定：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            fetishes: (mems) => {
                memoryLines.push('\n特殊偏好：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            user_info: (mems) => {
                memoryLines.push('\n用户信息：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            preference: (mems) => {
                memoryLines.push('\n用户偏好：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            nickname: (mems) => {
                memoryLines.push('\n昵称偏好：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            },
            safeword: (mems) => {
                memoryLines.push('\n安全词：');
                mems.forEach(m => {
                    memoryLines.push(`- ${m.content}`);
                });
            }
        };
        
        // 应用格式化器
        for (const [type, mems] of Object.entries(grouped)) {
            const formatter = typeFormatters[type];
            if (formatter) {
                formatter(mems);
            } else {
                // 默认格式化
                memoryLines.push(`\n${type}：`);
                mems.forEach(m => {
                    memoryLines.push(`- ${m.key_name}：${m.content}`);
                });
            }
        }
        
        memoryLines.push('\n请基于以上记忆信息，保持角色和人物的连贯性。');
        
        return memoryLines.join('\n');
    }
    
    // 异步提取和保存记忆
    async extractAndSaveMemories(chatId, mode, aiResponse, userInput) {
        try {
            // 使用记忆提取器提取记忆
            const memories = await memoryExtractor.extractMemories(aiResponse, userInput, mode);
            
            // 保存每个记忆
            for (const memory of memories) {
                database.saveAutoMemory(chatId, mode, memory);
            }
            
            if (memories.length > 0) {
                logger.info('Auto memories extracted and saved', { 
                    chatId, 
                    mode, 
                    count: memories.length,
                    types: [...new Set(memories.map(m => m.memory_type))]
                });
                
                // 可选：通知用户有新记忆（仅在调试时）
                if (process.env.DEBUG === 'true') {
                    const typeCount = memories.reduce((acc, m) => {
                        acc[m.memory_type] = (acc[m.memory_type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    const summary = Object.entries(typeCount)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ');
                    
                    await this.bot.sendMessage(chatId, 
                        `_[调试] 提取了 ${memories.length} 条记忆 (${summary})_`, 
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        } catch (error) {
            logger.error('Failed to extract memories', { 
                chatId, 
                mode,
                error: error.message 
            });
        }
    }
    
    // 设置相关方法 - 修改此方法以支持模型切换
    async showSettingsMenu(chatId, messageId) {
        const settings = this.getUserSettings(chatId);
        const currentSettings = {
            contextWindow: settings.contextWindow || 4096,
            maxTokens: settings.maxTokens || 1500,
            temperature: settings.temperature || 0.7,
            model: settings.model || 'nalang-xl'
        };
        
        const modelDisplayName = aiManager.getModelDisplayName(currentSettings.model);
        
        const menuText = `[设置] *当前设置*\n\n` +
            `[窗口] 上下文窗口: ${currentSettings.contextWindow} tokens\n` +
            `[长度] 最大输出长度: ${currentSettings.maxTokens} tokens\n` +
            `[温度] Temperature: ${currentSettings.temperature}\n` +
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
        
        await this.bot.editMessageText(menuText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async handleSettingSelection(chatId, messageId, settingType) {
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
                
            case 'model':
                text = '[模型] 选择AI模型提供商：';
                keyboard = {
                    inline_keyboard: [
                        [
                            { text: 'NaLang', callback_data: 'model_nalang' }
                        ],
                        [
                            { text: 'Gemini', callback_data: 'model_gemini' }
                        ],
                        [
                            { text: 'DeepSeek', callback_data: 'model_deepseek' }
                        ],
                        [
                            { text: '<- 返回设置', callback_data: 'show_settings' }
                        ]
                    ]
                };
                break;
        }
        
        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
    
    async handleSettingValue(chatId, messageId, data, query) {
        const parts = data.split('_');
        const settingType = parts[1];
        const value = parts.slice(2).join('_'); // 使用 _ 连接以支持复杂的值
        
        const settings = this.getUserSettings(chatId);
        
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
            case 'model':
                settings.model = value;
                break;
        }
        
        database.saveUserSettings(chatId, settings);
        
        await this.bot.answerCallbackQuery(query.id, { 
            text: '[✓] 设置已保存',
            show_alert: false 
        });
        
        // 返回设置菜单
        await this.showSettingsMenu(chatId, messageId);
    }
    
    // 档案相关方法
    async showArchivesMenu(chatId, messageId) {
        const text = '[档案] 请选择档案类型：';
        const keyboard = {
            inline_keyboard: [
                [{ text: '[人物] 人物档案', callback_data: 'char_archives' }],
                [{ text: '[故事] 故事档案 (开发中)', callback_data: 'story_archives' }],
                [{ text: '<- 返回主菜单', callback_data: 'back_to_menu' }]
            ]
        };
        
        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
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
    
    async handleSaveCharacter(chatId, messageId) {
        const tempData = this.tempCharacterData.get(chatId);
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
            this.tempCharacterData.delete(chatId);
        } else {
            await this.bot.editMessageText('[X] 保存失败，请稍后重试', {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }
    
    async handleDismissSave(chatId, messageId) {
        this.tempCharacterData.delete(chatId);
        await this.bot.editMessageText('已取消保存', {
            chat_id: chatId,
            message_id: messageId
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
        this.userStates.set(chatId, { mode: 'roleplay', isProcessing: false });
        
        // 存储当前使用的角色
        this.activeCharacters.set(chatId, {
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
    
    async handleSaveStory(chatId, messageId, query) {
        const state = this.userStates.get(chatId);
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
        const activeCharacter = this.activeCharacters.get(chatId);
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
        
        // 显示故事预览
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
        this.userStates.set(chatId, { mode: story.mode, isProcessing: false });
        database.saveConversation(chatId, story.mode, story.messages);
        
        // 如果故事关联了角色，也恢复角色
        if (story.character_id) {
            const character = database.getCharacter(chatId, story.character_id);
            if (character) {
                this.activeCharacters.set(chatId, {
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
    
    async handleModeSelection(chatId, messageId, mode) {
        const modeConfig = MODE_CONFIG[mode];
        if (!modeConfig) {
            await this.bot.sendMessage(chatId, '[X] 未知的模式选择。');
            return;
        }
        
        // 更新用户状态
        this.userStates.set(chatId, { mode, isProcessing: false });
        
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
            
            // 获取用户设置 - 修正：使用 this.getUserSettings
            const userSettings = this.getUserSettings(chatId);
            
            const response = await aiManager.chatComplete(messages, {
                mode: MODE_CONFIG[mode].apiMode,
                model: userSettings.model || 'nalang-xl',
                maxTokens: MODE_CONFIG[mode].maxTokens,
                temperature: MODE_CONFIG[mode].temperature,
                forceNonStream: mode === 'confession'
            });
            
            // 检查响应是否为空
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
            
            // 发送友好的错误消息
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
    
    isAdmin(userId) {
        return config.admin.ids.includes(userId);
    }
    
    async stop() {
        await this.bot.stopPolling();
        logger.info('Telegram bot stopped');
    }
}

module.exports = TelegramBotService;
